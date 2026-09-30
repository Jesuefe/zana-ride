import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../deliveries/storage.service';
import { haversineKm } from '../trips/fare.util';
import { PushService } from '../push/push.service';
import { ZanaGateway } from '../gateway/zana.gateway';
import { FinanceService } from '../finance/finance.service';

// Market orders use the exact same delivery pricing engine as normal
// marketplace deliveries: 500 RWF base + 150 RWF/km, min 500, max 3000.
function calcDeliveryFee(distKm: number): number {
  return Math.min(3000, Math.max(500, Math.round(500 + distKm * 150)));
}

@Injectable()
export class MarketsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private push: PushService,
    private gateway: ZanaGateway,
    private finance: FinanceService,
  ) {}

  // ── Customer-facing ───────────────────────────────────────────────────────

  // Markets a customer can shop from, with distance-based delivery fee.
  async listForCustomer(customerLat?: number, customerLng?: number) {
    const markets = await this.prisma.market.findMany({
      where: { active: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });

    return markets.map(m => {
      const distKm = (customerLat != null && customerLng != null)
        ? haversineKm(customerLat, customerLng, m.lat, m.lng)
        : 3;
      return {
        ...m,
        productCount: (m as any)._count?.products ?? 0,
        deliveryFee: calcDeliveryFee(distKm),
        distKm: Math.round(distKm * 10) / 10,
        distanceText: distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`,
        etaMinutes: m.prepMinutes + Math.round(distKm * 4),
      };
    });
  }

  async getMarketWithProducts(marketId: string) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        products: {
          where: { status: 'APPROVED', available: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!market) throw new NotFoundException('Market not found');
    return market;
  }

  // ── Agent-facing ──────────────────────────────────────────────────────────

  private async marketMarkupPercent() {
    const config = await this.prisma.marketPriceConfig.findFirst();
    return config?.markupPercent ?? 20;
  }

  private async requireAgent(userId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { userId },
      include: { market: true },
    });
    if (!agent) throw new ForbiddenException('NOT_AN_AGENT');
    if (!agent.active) throw new ForbiddenException('AGENT_DEACTIVATED');
    if (!agent.marketId) throw new BadRequestException('AGENT_HAS_NO_MARKET');
    return agent;
  }

  async getMyMarket(userId: string) {
    const agent = await this.requireAgent(userId);
    return { agent, market: agent.market };
  }

  // Agent-safe view: only operational information needed to shop and hand
  // the package to Zana. Customer contact details, exact coordinates,
  // internal timeline metadata and payment/delivery internals stay private.
  private agentSafeOrder(order: any) {
    const shoppingTotal = (order.items ?? []).reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    return {
      id: order.id,
      trackingCode: order.trackingCode,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shoppingTotal,
      items: (order.items ?? []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        status: item.status,
        product: item.product ? { id: item.product.id, name: item.product.name } : null,
      })),
      delivery: order.delivery ? {
        id: order.delivery.id,
        status: order.delivery.status,
        trackingCode: order.delivery.trackingCode,
        driver: order.delivery.driver ? {
          vehicle: order.delivery.driver.vehicle,
          plate: order.delivery.driver.plate,
          user: order.delivery.driver.user ? {
            firstName: order.delivery.driver.user.firstName,
            lastName: order.delivery.driver.user.lastName,
          } : null,
        } : null,
      } : null,
    };
  }

  // The agent's queue — everything needed to fulfill this market's orders,
  // without exposing customer PII or exact destination data.
  async getMyOrders(userId: string) {
    const agent = await this.requireAgent(userId);
    const orders = await this.prisma.order.findMany({
      where: { marketId: agent.marketId! },
      include: { items: { include: { product: true } }, delivery: { include: { driver: { include: { user: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return orders.map(o => this.agentSafeOrder(o));
  }

  async getMyOrderDetail(userId: string, orderId: string) {
    const agent = await this.requireAgent(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, marketId: agent.marketId! },
      include: { items: { include: { product: true } }, delivery: { include: { driver: { include: { user: true } } } } },
    });
    if (!order) throw new NotFoundException('Order not found in your market');
    return this.agentSafeOrder(order);
  }

  async getMyDeliveries(userId: string) {
    const agent = await this.requireAgent(userId);
    const rows = await this.prisma.delivery.findMany({
      where: { order: { marketId: agent.marketId! }, status: { in: ['REQUESTED','COURIER_ASSIGNED','PICKED_UP','DELIVERED'] } },
      include: { driver: { include: { user: true } }, order: { select: { trackingCode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(d => ({
      id: d.id,
      trackingCode: d.trackingCode,
      status: d.status,
      driver: d.driver ? {
        vehicle: d.driver.vehicle,
        plate: d.driver.plate,
        user: d.driver.user ? { firstName: d.driver.user.firstName, lastName: d.driver.user.lastName } : null,
      } : null,
      order: d.order,
    }));
  }

  async markItemUnavailable(userId: string, orderId: string, itemId: string) {
    const agent = await this.requireAgent(userId);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, marketId: agent.marketId! }, include: { customer: { select: { id: true } }, items: true } });
    if (!order) throw new NotFoundException('Order not found in your market');
    if (!['PENDING','CONFIRMED','PREPARING'].includes(order.status)) throw new BadRequestException('ITEM_CAN_NO_LONGER_BE_CHANGED');
    if (!(order as any).paid) throw new BadRequestException('ORDER_NOT_PAID');
    const item = order.items.find(i => i.id === itemId);
    if (!item) throw new NotFoundException('Order item not found');
    if ((item as any).status !== 'AVAILABLE') return this.getMyOrderDetail(userId, orderId);
    const product = await this.prisma.product.findUnique({ where: { id: item.productId }, select: { name: true } });
    const marketName = agent.market?.name ?? 'the market';
    await this.prisma.orderItem.update({ where: { id: item.id }, data: { status: 'UNAVAILABLE_PENDING', unavailableAt: new Date() } as any });
    await this.prisma.auditLog.create({ data: { actorId: userId, action: 'ORDER_ITEM_UNAVAILABLE_PENDING_CUSTOMER_CHOICE', entityType: 'ORDER_ITEM', entityId: item.id, metadataJson: JSON.stringify({ orderId, productId: item.productId, productName: product?.name ?? 'Item', marketName }) } });
    const message = `${product?.name ?? 'Item'} is currently unavailable at ${marketName}. What would you like us to do?`;
    await this.push.sendToUser(order.customerId, { title: 'Item unavailable — action needed', body: message }, { type: 'ORDER_ITEM_AVAILABILITY_CHOICE', orderId, itemId: item.id });
    this.gateway.sendToUser(order.customerId, 'order:item-availability-choice', { orderId, itemId: item.id, productName: product?.name ?? 'Item', marketName, message, options: ['REFUND', 'REPLACE', 'REMOVE'] });
    return this.getMyOrderDetail(userId, orderId);
  }

  async getReplacementProducts(customerId: string, orderId: string, itemId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    const item = order.items.find(i => i.id === itemId);
    if (!item || (item as any).status !== 'UNAVAILABLE_PENDING') throw new BadRequestException('ITEM_NOT_WAITING_FOR_CUSTOMER_CHOICE');
    if (!order.marketId) throw new BadRequestException('MARKET_ORDER_REQUIRED');
    return this.prisma.product.findMany({ where: { marketId: order.marketId, status: 'APPROVED', available: true, id: { not: item.productId } }, orderBy: { name: 'asc' }, take: 100 });
  }

  async resolveUnavailableItem(customerId: string, orderId: string, itemId: string, action: 'REFUND' | 'REPLACE' | 'REMOVE', replacementProductId?: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (!['PENDING','CONFIRMED','PREPARING'].includes(order.status)) throw new BadRequestException('ITEM_CAN_NO_LONGER_BE_CHANGED');
    const item = order.items.find(i => i.id === itemId);
    if (!item) throw new NotFoundException('Order item not found');
    if ((item as any).status !== 'UNAVAILABLE_PENDING') throw new BadRequestException('ITEM_NOT_WAITING_FOR_CUSTOMER_CHOICE');
    if (!(order as any).paid) throw new BadRequestException('ORDER_NOT_PAID');

    if (action === 'REPLACE') {
      if (!replacementProductId) throw new BadRequestException('REPLACEMENT_PRODUCT_REQUIRED');
      if (!order.marketId) throw new BadRequestException('MARKET_ORDER_REQUIRED');
      const replacement = await this.prisma.product.findFirst({ where: { id: replacementProductId, marketId: order.marketId, status: 'APPROVED', available: true } });
      if (!replacement) throw new NotFoundException('Replacement item is no longer available');
      const oldAmount = item.price * item.quantity;
      const newAmount = replacement.price * item.quantity;
      const difference = newAmount - oldAmount;
      await this.prisma.$transaction(async tx => {
        if (difference > 0) {
          const wallet = await tx.wallet.findUnique({ where: { userId: customerId } });
          if (!wallet) throw new BadRequestException('CUSTOMER_WALLET_NOT_FOUND');
          const debited = await tx.wallet.updateMany({ where: { id: wallet.id, balance: { gte: difference } }, data: { balance: { decrement: difference } } });
          if (debited.count !== 1) throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE_FOR_REPLACEMENT');
          const after = await tx.wallet.findUnique({ where: { id: wallet.id } });
          await tx.walletTransaction.create({ data: { walletId: wallet.id, amount: -difference, balanceBefore: wallet.balance, balanceAfter: after!.balance, reference: 'ORDER_ITEM_REPLACEMENT:' + orderId + ':' + item.id, description: 'Replacement item price difference', status: 'COMPLETED' } as any });
        } else if (difference < 0) {
          const wallet = await tx.wallet.findUnique({ where: { userId: customerId } });
          if (!wallet) throw new BadRequestException('CUSTOMER_WALLET_NOT_FOUND');
          const refund = -difference;
          const after = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: refund } } });
          await tx.walletTransaction.create({ data: { walletId: wallet.id, amount: refund, balanceBefore: wallet.balance, balanceAfter: after.balance, reference: 'ORDER_ITEM_REPLACEMENT_REFUND:' + orderId + ':' + item.id, description: 'Replacement item price difference refund', status: 'COMPLETED' } as any });
        }
        await tx.orderItem.update({ where: { id: item.id }, data: { productId: replacement.id, price: replacement.price, status: 'REPLACED', refundedAmount: difference < 0 ? -difference : 0 } as any });
        if (difference !== 0) await tx.order.update({ where: { id: orderId }, data: { total: { increment: difference }, updatedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: customerId, action: 'ORDER_ITEM_REPLACED', entityType: 'ORDER_ITEM', entityId: item.id, metadataJson: JSON.stringify({ orderId, oldProductId: item.productId, replacementProductId: replacement.id, oldAmount, newAmount, difference }) } });
      }, { isolationLevel: 'Serializable' });
      if (order.agentId) {
        const agent = await this.prisma.agent.findUnique({ where: { id: order.agentId }, select: { userId: true } });
        if (agent) this.gateway.sendToUser(agent.userId, 'order:item-resolved', { orderId, itemId, action: 'REPLACE', productName: replacement.name });
      }
      return this.prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } }, market: true, delivery: true } });
    }

    const refund = item.price * item.quantity;
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: customerId } });
    if (!wallet) throw new BadRequestException('CUSTOMER_WALLET_NOT_FOUND');
    await this.prisma.$transaction(async tx => {
      const claimed = await tx.orderItem.updateMany({ where: { id: item.id, orderId, status: 'UNAVAILABLE_PENDING' } as any, data: { status: action === 'REFUND' ? 'REFUNDED' : 'REMOVED', refundedAmount: refund, unavailableAt: item.unavailableAt ?? new Date() } as any });
      if (claimed.count !== 1) throw new BadRequestException('ITEM_ALREADY_RESOLVED');
      const updatedWallet = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: refund } } });
      await tx.order.update({ where: { id: orderId }, data: { total: { decrement: refund }, updatedAt: new Date() } });
      await tx.walletTransaction.create({ data: { walletId: wallet.id, amount: refund, balanceBefore: wallet.balance, balanceAfter: updatedWallet.balance, reference: 'ORDER_ITEM_' + action + ':' + orderId + ':' + item.id, description: action === 'REFUND' ? 'Refund — unavailable market item' : 'Refund — removed unavailable market item', status: 'COMPLETED' } as any });
      await tx.auditLog.create({ data: { actorId: customerId, action: action === 'REFUND' ? 'ORDER_ITEM_REFUNDED' : 'ORDER_ITEM_REMOVED', entityType: 'ORDER_ITEM', entityId: item.id, metadataJson: JSON.stringify({ orderId, refund, productId: item.productId }) } });
    }, { isolationLevel: 'Serializable' });
    if (order.agentId) {
      const agent = await this.prisma.agent.findUnique({ where: { id: order.agentId }, select: { userId: true } });
      if (agent) this.gateway.sendToUser(agent.userId, 'order:item-resolved', { orderId, itemId, action });
    }
    return this.prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } }, market: true, delivery: true } });
  }

  async updateOrderStatus(
    userId: string,
    orderId: string,
    status: string,
    actualPrices?: Record<string, number>,
  ) {
    const agent = await this.requireAgent(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, marketId: agent.marketId! },
    });
    if (!order) throw new NotFoundException('Order not found in your market');

    // Agents may only move their market orders through the fulfillment
    // states they control. Rider/customer delivery states stay outside
    // the agent workflow.
    const allowedNext: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'PREPARING'],
      CONFIRMED: ['PREPARING'],
      PREPARING: ['READY_FOR_PICKUP'],
    };
    if (status === 'READY_FOR_PICKUP') {
      const pendingItems = await this.prisma.orderItem.count({ where: { orderId, status: 'UNAVAILABLE_PENDING' } as any });
      if (pendingItems > 0) throw new BadRequestException('CUSTOMER_ITEM_DECISION_REQUIRED');
    }

    if (!allowedNext[order.status]?.includes(status)) {
      throw new BadRequestException('INVALID_AGENT_ORDER_TRANSITION');
    }

    // Record the actual amount paid at the stall. It can never exceed the
    // immutable underlying reference cost captured when the order was made.
    if (actualPrices) {
      const items = await this.prisma.orderItem.findMany({ where: { orderId }, include: { product: true } });
      const itemMap = new Map(items.map(i => [i.id, i]));
      for (const [orderItemId, rawPrice] of Object.entries(actualPrices)) {
        const item = itemMap.get(orderItemId);
        const actualPurchasePrice = Number(rawPrice);
        if (!item) throw new BadRequestException('ORDER_ITEM_NOT_FOUND');
        if (!Number.isFinite(actualPurchasePrice) || !Number.isInteger(actualPurchasePrice) || actualPurchasePrice < 0) {
          throw new BadRequestException('INVALID_PURCHASE_PRICE');
        }
        // Older market orders may predate referenceCostAtOrder. Recover the
        // purchase reference from the product so legacy orders remain fulfillable.
        const underlying = Number(item.referenceCostAtOrder ?? (item.product as any)?.referenceCost ?? 0);
        if (!Number.isFinite(underlying) || underlying <= 0) {
          throw new BadRequestException('MISSING_MARKET_REFERENCE_COST');
        }
        if (actualPurchasePrice > underlying) {
          throw new BadRequestException('PURCHASE_PRICE_EXCEEDS_REFERENCE_COST');
        }
        await this.prisma.orderItem.update({
          where: { id: item.id },
          data: {
            actualPurchasePrice,
            referenceCostAtOrder: item.referenceCostAtOrder ?? underlying,
          } as any,
        });
      }
    }

    // READY_FOR_PICKUP is the handoff boundary between the market agent
    // and the driver network. The order alone is not enough for the driver
    // pool: riders discover REQUESTED Delivery records. Create that record
    // atomically with the order transition so an order can never become
    // "ready" without a corresponding rider job.
    if (status === 'READY_FOR_PICKUP') {
      const readyOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          customer: { select: { id: true, firstName: true, phone: true } },
          market: true,
          delivery: true,
        },
      });
      if (!readyOrder) throw new NotFoundException('Order not found');

      const dropoffLat = readyOrder.dropoffLat;
      const dropoffLng = readyOrder.dropoffLng;
      if (dropoffLat == null || dropoffLng == null) {
        throw new BadRequestException('ORDER_DROP_OFF_LOCATION_REQUIRED');
      }
      const pickupMarket = readyOrder.market;
      if (!pickupMarket || pickupMarket.lat == null || pickupMarket.lng == null) {
        throw new BadRequestException('MARKET_PICKUP_LOCATION_REQUIRED');
      }
      if (!readyOrder.paid) {
        throw new BadRequestException('ORDER_NOT_PAID');
      }

      const receiverPhone = readyOrder.receiverPhone?.trim() || readyOrder.customer.phone;
      if (!receiverPhone) {
        throw new BadRequestException('RECEIVER_PHONE_REQUIRED');
      }

      const itemDescription = readyOrder.items
        .filter((item: any) => !['REFUNDED', 'REMOVED'].includes(item.status))
        .map((item: any) => `${item.product?.name ?? 'Item'} ×${item.quantity}`)
        .join(', ') || 'Market order';

      const deliveryFee = Number(readyOrder.deliveryFee ?? 0);
      if (!Number.isInteger(deliveryFee) || deliveryFee < 0) {
        throw new BadRequestException('INVALID_DELIVERY_FEE');
      }

      const result = await this.prisma.$transaction(async tx => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          include: { delivery: true },
        });
        if (!current) throw new NotFoundException('Order not found');
        if (current.status !== 'PREPARING') {
          throw new BadRequestException('INVALID_AGENT_ORDER_TRANSITION');
        }
        if (current.delivery) {
          throw new BadRequestException('DELIVERY_ALREADY_CREATED');
        }

        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { status: 'READY_FOR_PICKUP', agentId: agent.id } as any,
        });

        const delivery = await tx.delivery.create({
          data: {
            orderId,
            customerId: readyOrder.customerId,
            itemDescription,
            weight: 'UNDER_1KG' as any,
            pickupAddress: pickupMarket.name,
            pickupLat: pickupMarket.lat,
            pickupLng: pickupMarket.lng,
            dropoffAddress: readyOrder.dropoffAddress ?? 'Customer location',
            dropoffLat,
            dropoffLng,
            receiverName: readyOrder.customer.firstName || 'Customer',
            receiverPhone,
            distanceKm: haversineKm(pickupMarket.lat, pickupMarket.lng, dropoffLat, dropoffLng),
            fee: deliveryFee,
            status: 'REQUESTED' as any,
            trackingCode: 'ZD' + Math.random().toString(36).slice(2, 8).toUpperCase(),
            paymentMethod: readyOrder.paymentMethod,
            paid: readyOrder.paid,
          } as any,
        });

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'ORDER_STATUS_CHANGED',
            entityType: 'ORDER',
            entityId: orderId,
            metadataJson: JSON.stringify({
              from: order.status,
              to: status,
              deliveryId: delivery.id,
              deliveryStatus: 'REQUESTED',
            }),
          },
        });

        return { order: updatedOrder, delivery };
      }, { isolationLevel: 'Serializable' });

      return result.order;
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as any, agentId: agent.id } as any,
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'ORDER',
        entityId: orderId,
        metadataJson: JSON.stringify({ from: order.status, to: status }),
      },
    });
    return updated;
  }
}
