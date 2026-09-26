import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../deliveries/storage.service';
import { haversineKm } from '../trips/fare.util';
import { PushService } from '../push/push.service';
import { ZanaGateway } from '../gateway/zana.gateway';

// Same shape as the merchant delivery fee so pricing stays consistent
// across the whole marketplace.
function calcDeliveryFee(distKm: number): number {
  const base = 700;
  const perKm = 250;
  return Math.max(700, Math.round((base + distKm * perKm) / 50) * 50);
}

@Injectable()
export class MarketsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private push: PushService,
    private gateway: ZanaGateway,
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

  // Agents stock the market themselves — they walk the stalls and list
  // what is actually available today.
  async addProduct(userId: string, data: {
    name: string; description?: string; price: number; referenceCost?: number;
    imageBase64?: string; stock?: number;
  }) {
    const agent = await this.requireAgent(userId);

    let imageUrl: string | undefined;
    if (data.imageBase64) {
      try {
        const uploaded = await this.storage.uploadImage(data.imageBase64, 'market-products');
        if (uploaded) imageUrl = uploaded;
      } catch (e: any) {
        console.error('[MARKET] Product image upload failed:', e?.message);
      }
    }

    const referenceCost = Number(data.referenceCost ?? data.price);
    if (!Number.isInteger(referenceCost) || referenceCost <= 0) {
      throw new BadRequestException('INVALID_MARKET_PRICE');
    }
    const markupPercent = await this.marketMarkupPercent();
    const customerPrice = Math.round(referenceCost * (1 + markupPercent / 100));

    return this.prisma.product.create({
      data: {
        marketId: agent.marketId!,
        name: data.name,
        description: data.description,
        price: customerPrice,
        referenceCost,
        category: 'GOODS',
        imageUrl,
        stock: data.stock ?? 0,
        status: 'PENDING', // new market listings are not customer-visible until admin approves them
        available: false,
      } as any,
    });
  }

  async getMyProducts(userId: string) {
    const agent = await this.requireAgent(userId);
    return this.prisma.product.findMany({
      where: { marketId: agent.marketId! },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProduct(userId: string, productId: string, data: any) {
    const agent = await this.requireAgent(userId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, marketId: agent.marketId! },
    });
    if (!product) throw new NotFoundException('Product not found in your market');
    // Agents may maintain operational fields, but price/reference cost are
    // protected financial fields and must go through the price-review endpoint.
    const allowed: any = {};
    for (const key of ['name', 'description', 'imageUrl', 'stock', 'available']) {
      if (Object.prototype.hasOwnProperty.call(data, key)) allowed[key] = data[key];
    }
    if (Object.prototype.hasOwnProperty.call(data, 'stock') && (!Number.isInteger(data.stock) || data.stock < 0)) {
      throw new BadRequestException('INVALID_STOCK');
    }
    if (Object.prototype.hasOwnProperty.call(data, 'name') && (!data.name || String(data.name).trim().length < 2)) {
      throw new BadRequestException('INVALID_PRODUCT_NAME');
    }
    return this.prisma.product.update({ where: { id: productId }, data: allowed });
  }

  async deleteProduct(userId: string, productId: string) {
    const agent = await this.requireAgent(userId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, marketId: agent.marketId! },
    });
    if (!product) throw new NotFoundException('Product not found in your market');
    // Preserve products referenced by historical orders; disable instead of deleting financial history.\n    return this.prisma.product.update({ where: { id: productId }, data: { available: false, status: 'DISABLED' } });
  }

  // The agent's queue — everything customers have ordered from this market.
  async getMyOrders(userId: string) {
    const agent = await this.requireAgent(userId);
    return this.prisma.order.findMany({
      where: { marketId: agent.marketId! },
      include: {
        items: { include: { product: true } },
        customer: { select: { firstName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getMyOrderDetail(userId: string, orderId: string) {
    const agent = await this.requireAgent(userId);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, marketId: agent.marketId! }, include: { items: { include: { product: true } }, customer: { select: { id: true, firstName: true, lastName: true, phone: true } }, market: true, delivery: { include: { driver: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } } } } } });
    if (!order) throw new NotFoundException('Order not found in your market');
    const timeline = await this.prisma.auditLog.findMany({ where: { entityType: { in: ['ORDER','ORDER_ITEM'] }, entityId: orderId }, orderBy: { createdAt: 'asc' }, take: 100 });
    return { ...order, timeline };
  }

  async getMyDeliveries(userId: string) {
    const agent = await this.requireAgent(userId);
    return this.prisma.delivery.findMany({ where: { order: { marketId: agent.marketId! }, status: { in: ['COURIER_ASSIGNED','PICKED_UP','DELIVERED'] } }, include: { order: { select: { id: true, trackingCode: true, total: true, customer: { select: { firstName: true, lastName: true, phone: true } } } }, driver: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } } }, orderBy: { createdAt: 'desc' }, take: 100 });
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
      const items = await this.prisma.orderItem.findMany({ where: { orderId } });
      const itemMap = new Map(items.map(i => [i.id, i]));
      for (const [orderItemId, rawPrice] of Object.entries(actualPrices)) {
        const item = itemMap.get(orderItemId);
        const actualPurchasePrice = Number(rawPrice);
        if (!item) throw new BadRequestException('ORDER_ITEM_NOT_FOUND');
        if (!Number.isFinite(actualPurchasePrice) || !Number.isInteger(actualPurchasePrice) || actualPurchasePrice < 0) {
          throw new BadRequestException('INVALID_PURCHASE_PRICE');
        }
        const underlying = item.referenceCostAtOrder;
        if (underlying == null || underlying <= 0) {
          throw new BadRequestException('MISSING_MARKET_REFERENCE_COST');
        }
        if (actualPurchasePrice > underlying) {
          throw new BadRequestException('PURCHASE_PRICE_EXCEEDS_REFERENCE_COST');
        }
        await this.prisma.orderItem.update({
          where: { id: item.id },
          data: { actualPurchasePrice },
        });
      }
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
