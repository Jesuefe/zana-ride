
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function calcDeliveryFee(distKm: number): number {
  return Math.min(3000, Math.max(500, Math.round(500 + distKm * 150)));
}

function calcMarketDeliveryFee(distKm: number): number {
  const raw = 1000 + Math.max(0, distKm) * 250;
  return Math.min(6000, Math.max(1500, Math.round(raw / 500) * 500));
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EversendService } from '../wallet/eversend.service';
import { ZanaGateway } from '../gateway/zana.gateway';
import { OrderStatus } from '@prisma/client';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private deliveriesService: DeliveriesService,
    private eversend: EversendService,
    private gateway: ZanaGateway,
    private finance: FinanceService,
  ) {}

  // Shared by both order creation and status updates — a small, direct
  // reuse of the exact same per-user room mechanism already proven for
  // merchants and agents, not new infrastructure.
  private async notifyAdmins(event: string, payload: any) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN' as any },
        select: { id: true },
      });
      for (const a of admins) this.gateway.sendToUser(a.id, event, payload);
    } catch (e: any) {
      console.error('[ORDER] Admin notify failed:', e?.message);
    }
  }

  async create(customerId: string, data: {
    merchantId?: string;
    marketId?: string;
    items: { productId: string; quantity: number }[];
    dropoffAddress?: string;
    dropoffLat?: number;
    dropoffLng?: number;
    locationCode?: string;
    receiverPhone?: string;
    note?: string;
    paymentMethod?: 'WALLET' | 'MOBILE_MONEY' | 'CASH';
    deliveryFee?: number;
  }) {
    // Validate all products exist, are approved, and belong to the merchant.
    if (!data.merchantId && !data.marketId) {
      throw new BadRequestException('MERCHANT_OR_MARKET_REQUIRED');
    }

    // Previously only the product's own status/available flags were
    // checked here — a merchant suspended after their products were
    // already approved could still receive new orders indefinitely,
    // since nothing here ever looked at the merchant's own status at
    // all, only the individual product's.
    if (data.merchantId) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: data.merchantId }, select: { status: true },
      });
      if (!merchant || merchant.status !== 'APPROVED') {
        throw new BadRequestException('MERCHANT_NOT_AVAILABLE');
      }
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: data.items.map(i => i.productId) },
        ...(data.marketId ? { marketId: data.marketId } : { merchantId: data.merchantId }),
        status: 'APPROVED',
        available: true,
      },
    });

    if (products.length !== data.items.length) {
      throw new BadRequestException('One or more products are unavailable');
    }

    const total = data.items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId)!;
      return sum + product.price * item.quantity;
    }, 0);

    // Never trust a fee sent by the client — recompute it from the
    // merchant's own coordinates to the drop-off point.
    let originLat: number | null = null;
    let originLng: number | null = null;
    let sellerName: string | undefined;
    let prepMinutes = 20;

    if (data.marketId) {
      const market = await this.prisma.market.findUnique({
        where: { id: data.marketId },
        select: { lat: true, lng: true, name: true, prepMinutes: true },
      });
      originLat = market?.lat ?? null;
      originLng = market?.lng ?? null;
      sellerName = market?.name;
      prepMinutes = (market as any)?.prepMinutes ?? 20;
    } else {
      const merchantRecord = await this.prisma.merchant.findUnique({
        where: { id: data.merchantId! },
        select: { businessLat: true, businessLng: true, businessName: true, prepMinutes: true },
      });
      originLat = merchantRecord?.businessLat ?? null;
      originLng = merchantRecord?.businessLng ?? null;
      sellerName = merchantRecord?.businessName;
      prepMinutes = merchantRecord?.prepMinutes ?? 20;
    }

    let distKm = 3; // fallback when the seller hasn't set a location yet
    if (originLat != null && originLng != null && data.dropoffLat != null && data.dropoffLng != null) {
      distKm = haversineKm(originLat, originLng, data.dropoffLat, data.dropoffLng);
    }

    const deliveryFee = data.marketId ? calcMarketDeliveryFee(distKm) : calcDeliveryFee(distKm);
    const grandTotal = total + deliveryFee;
    const paymentMethod = data.paymentMethod ?? 'WALLET';

    // Food, shop and gift orders are online-payment only.
    if (paymentMethod === 'CASH') {
      throw new BadRequestException('CASH_NOT_ACCEPTED_FOR_ORDERS');
    }

    // ── Wallet: check the balance and debit before the order exists ────────
    if (paymentMethod === 'WALLET') {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId: customerId } });
      const balance = wallet?.balance ?? 0;
      if (!wallet || balance < grandTotal) {
        throw new BadRequestException(
          `INSUFFICIENT_WALLET_BALANCE:${balance}:${grandTotal}`,
        );
      }
    }

    const trackingCode = 'ZN' + Math.random().toString(36).slice(2, 8).toUpperCase();

    const order = await this.prisma.order.create({
      data: {
        customerId,
        merchantId: data.merchantId ?? null,
        marketId: data.marketId ?? null,
        total: grandTotal,
        deliveryFee,
        status: OrderStatus.PENDING,
        prepMinutes,
        paymentMethod,
        trackingCode,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        receiverPhone: data.receiverPhone,
        note: data.note,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: products.find(p => p.id === item.productId)!.price,
            referenceCostAtOrder: products.find(p => p.id === item.productId)!.referenceCost,
          })),
        },
      } as any,
      include: { items: { include: { product: true } }, merchant: true },
    });

    // ── Take the money ─────────────────────────────────────────────────────
    if (paymentMethod === 'WALLET') {
      await this.debitWallet(customerId, grandTotal, order.id, sellerName);
      await this.prisma.order.update({
        where: { id: order.id }, data: { paid: true } as any,
      });
      console.log(`[ORDER] ${trackingCode} paid from wallet | ${grandTotal} RWF`);
    } else if (paymentMethod === 'MOBILE_MONEY') {
      const customer = await this.prisma.user.findUnique({
        where: { id: customerId }, select: { phone: true },
      });
      if (customer?.phone) {
        try {
          const res = await this.eversend.collectMobileMoney(customer.phone, grandTotal, `ZANA-ORDER-${order.id}`);
          await this.prisma.order.update({
            where: { id: order.id }, data: { momoRef: res.ref } as any,
          });
          console.log(`[ORDER] ${trackingCode} MoMo prompt sent to ${customer.phone} | ${grandTotal} RWF`);
        } catch (e: any) {
          console.error('[ORDER] MoMo charge failed:', e?.message);
          throw new BadRequestException('MOMO_CHARGE_FAILED');
        }
      }
    }

    // Ring recipients only after wallet payment is confirmed.
    if (paymentMethod === 'WALLET') try {
      const payload = {
        orderId: order.id,
        trackingCode,
        total: grandTotal,
        itemCount: data.items.length,
      };

      if (data.marketId) {
        // Every agent staffing that market should hear it.
        const agents = await this.prisma.agent.findMany({
          where: { marketId: data.marketId, active: true },
          select: { userId: true },
        });
        for (const a of agents) this.gateway.sendToUser(a.userId, 'order:new', payload);
      } else {
        const merchant = await this.prisma.merchant.findUnique({
          where: { id: data.merchantId! }, select: { userId: true },
        });
        if (merchant?.userId) this.gateway.sendToUser(merchant.userId, 'order:new', payload);
      }

      // No admin notification mechanism existed for anything at all
      // before this — admin's order screen only ever updated on a manual
      // browser refresh. Reusing the exact same sendToUser/room
      // mechanism already proven for merchants and agents, just aimed at
      // a different set of recipients, rather than building anything new.
      await this.notifyAdmins('order:new', payload);
    } catch (e: any) {
      console.error('[ORDER] Merchant notify failed:', e?.message);
    }

    return { ...order, trackingCode };
  }

  // Debit the customer's wallet, guarded by an atomic conditional decrement
  // rather than a $transaction wrapping a plain read-then-write — the
  // latter looks safe but Postgres's default isolation does not lock the
  // row just because the statements sit inside a transaction block, so two
  // orders racing for the same wallet could otherwise both pass a stale
  // balance check and both succeed.
  private async debitWallet(userId: string, amount: number, orderId: string, merchantName?: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException('WALLET_NOT_FOUND');

    const before = wallet.balance;
    const debited = await this.prisma.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (debited.count === 0) throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');

    const updated = await this.prisma.wallet.findUnique({ where: { id: wallet.id } });
    const after = updated!.balance;

    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -amount,
        balanceBefore: before,
        balanceAfter: after,
        reference: orderId,
        description: merchantName ? `Order — ${merchantName}` : 'Marketplace order',
        status: 'COMPLETED',
      } as any,
    });
    console.log(`[WALLET] Order ${orderId} | -${amount} RWF | ${before} → ${after}`);
  }

  // Poll Eversend for a MoMo order and mark it paid once it settles.
  async checkOrderPayment(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const ref = (order as any).momoRef;
    if ((order as any).paid) return { paid: true, status: 'successful' };
    if (!ref) return { paid: false, status: 'NOT_STARTED' };

    try {
      const res = await this.eversend.getCollectionStatus(ref);
      if (res.status === 'successful') {
        await this.prisma.order.update({
          where: { id: orderId }, data: { paid: true } as any,
        });
        return { paid: true, status: res.status };
      }
      return { paid: false, status: res.status };
    } catch {
      return { paid: false, status: 'pending' };
    }
  }

  async findForCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        items: { include: { product: true } },
        merchant: true,
        delivery: {
          include: {
            driver: { select: { id: true, lastLat: true, lastLng: true, vehicle: true, plate: true, rating: true, user: { select: { firstName: true, phone: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForMerchant(merchantId: string) {
    return this.prisma.order.findMany({
      where: { merchantId },
      include: { items: { include: { product: true } }, customer: true, merchant: { select: { businessName: true, prepMinutes: true, deliveryMinutes: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForMerchantById(merchantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, merchantId },
      include: { items: { include: { product: true } }, customer: true, merchant: { select: { businessName: true, prepMinutes: true, deliveryMinutes: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, merchant: true, customer: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      include: {
        market: true,
        merchant: { include: { user: true } },
        customer: true,
        items: { include: { product: true } },
      },
    });

    // Financial settlement is idempotent and owns the merchant/agent ledger + wallet credit.\n    if (status === OrderStatus.DELIVERED) {\n      try {\n        await this.finance.settleOrder(id);\n      } catch (e: any) {\n        console.error(`[ORDER] Settlement failed for ${id}:`, e?.message);\n        throw e;\n      }\n    }\n\n    // Admin's order screen previously had no live path at all for this —
    // manual refresh only, regardless of what changed.
    await this.notifyAdmins('order:status', { orderId: id, status });

    // When merchant marks READY_FOR_PICKUP — auto-dispatch a Zana driver
    if (status === OrderStatus.READY_FOR_PICKUP) {
      try {
        const seller: any = (order as any).market ?? order.merchant;
        const isMarket = !!(order as any).marketId;
        const pickupAddress = isMarket
          ? (seller?.address ?? seller?.name ?? 'Market')
          : (seller?.businessAddress ?? seller?.businessName ?? 'Merchant');
        const pickupLat = (isMarket ? seller?.lat : seller?.businessLat) ?? -1.9536;
        const pickupLng = (isMarket ? seller?.lng : seller?.businessLng) ?? 30.0605;
        const itemDesc = order.items.map(i => `${i.product.name} ×${i.quantity}`).join(', ');
        const totalRwf = order.items.reduce((s, i) => s + i.product.price * i.quantity, 0);

        const distKm = Math.max(0.5, haversineKm(pickupLat, pickupLng, order.dropoffLat ?? -1.97, order.dropoffLng ?? 30.12));
        // The customer already paid the authoritative order delivery fee.
        // Never recalculate a second fee at dispatch time; that could make
        // the delivery ledger disagree with what the customer was charged.
        const fee = order.deliveryFee ?? 0;
        const dispatchedDelivery = await this.prisma.delivery.create({
          data: {
            customerId: order.customerId,
            orderId: order.id,
            merchantId: order.merchantId ?? null,
            status: 'REQUESTED',
            trackingCode: 'ZD' + Math.random().toString(36).slice(2, 8).toUpperCase(),
            paid: true, // the customer already paid for the order up front
            // The delivery fee is part of the already-paid marketplace
            // order. Preserve the order's payment method for the delivery
            // commission ledger; do not charge the customer again.
            paymentMethod: order.paymentMethod,
            pickupAddress,
            pickupLat,
            pickupLng,
            dropoffAddress: order.dropoffAddress ?? 'Customer location',
            dropoffLat: order.dropoffLat ?? -1.97,
            dropoffLng: order.dropoffLng ?? 30.12,
            itemDescription: itemDesc,
            receiverPhone: order.customer.phone,
            weight: 'UNDER_1KG',
            distanceKm: Math.round(distKm * 10) / 10,
            fee,
          },
        });
        await this.notifyAdmins('order:delivery-created', {
          orderId: id, deliveryId: dispatchedDelivery.id,
        });
      } catch (e) {
        // Non-fatal — delivery dispatch failure doesn't block order update
        console.error('Delivery dispatch failed:', e);
      }
    }

    return order;
  }

  // order.agentId stores the Agent model's own id, not the underlying
  // User id the wallet actually lives on — one extra lookup to reach
  // the payable account.
  private async resolveAgentPayeeUserId(agentId?: string | null): Promise<string | null> {
    if (!agentId) return null;
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId }, select: { userId: true } });
    return agent?.userId ?? null;
  }

  async cancelOrder(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestException('ORDER_CAN_NO_LONGER_BE_CANCELLED');
    }
    const result = await this.prisma.$transaction(async tx => {
      if ((order as any).paid && order.paymentMethod === 'WALLET') {
        const wallet = await tx.wallet.findUnique({ where: { userId: order.customerId } });
        if (!wallet) throw new BadRequestException('WALLET_NOT_FOUND');
        const updatedWallet = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: order.total } } });
        await tx.walletTransaction.create({ data: { walletId: wallet.id, amount: order.total, balanceBefore: wallet.balance, balanceAfter: updatedWallet.balance, reference: 'ORDER_CANCEL:' + order.id, description: 'Refund — cancelled order', status: 'COMPLETED' } as any });
      }
      return tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED, paid: false, updatedAt: new Date() } as any, include: { items: { include: { product: true } }, customer: true, market: true, merchant: true } });
    });
    await this.notifyAdmins('order:status', { orderId: id, status: OrderStatus.CANCELLED });
    if (order.marketId) {
      const agents = await this.prisma.agent.findMany({ where: { marketId: order.marketId, active: true }, select: { userId: true } });
      for (const a of agents) this.gateway.sendToUser(a.userId, 'order:cancelled', { orderId: id });
    }
    return result;
  }

  // Fetches approved products grouped by merchant for the marketplace.
  async getMarketplace(category?: string, customerLat?: number, customerLng?: number) {
    const merchants = await this.prisma.merchant.findMany({
      where: {
        status: 'APPROVED',
        products: { some: { status: 'APPROVED', available: true, ...(category ? { category: category as any } : {}) } },
      },
      include: {
        products: {
          where: { status: 'APPROVED', available: true, ...(category ? { category: category as any } : {}) },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return merchants.map(m => {
      const distKm = (customerLat && customerLng && m.businessLat && m.businessLng)
        ? haversineKm(customerLat, customerLng, m.businessLat, m.businessLng)
        : 3; // default 3km if no merchant location set
      const deliveryFee = calcDeliveryFee(distKm);
      const distanceText = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;
      return {
        ...m,
        deliveryFee,
        distanceText,
        distKm: Math.round(distKm * 10) / 10,
        prepMinutes: m.prepMinutes ?? 20,
        deliveryMinutes: m.deliveryMinutes ?? 25,
        etaMinutes: (m.prepMinutes ?? 20) + (m.deliveryMinutes ?? 25),
      };
    });
  }

  // Completed orders and what they earned. Merchants had live orders only,
  // with no way to answer "what did I make this week".
  async merchantHistory(merchantId: string, limit = 100) {
    return this.prisma.order.findMany({
      where: { merchantId, status: { in: ['DELIVERED', 'CANCELLED'] } },
      include: {
        items: { include: { product: true } },
        customer: { select: { firstName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async merchantStats(merchantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { merchantId },
      select: { status: true, total: true, deliveryFee: true, createdAt: true } as any,
    });

    const delivered = orders.filter((o: any) => o.status === 'DELIVERED');
    // The merchant keeps the goods value; the delivery fee is Zana's.
    const goodsValue = (o: any) => (o.total ?? 0) - (o.deliveryFee ?? 0);

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const today = delivered.filter((o: any) => new Date(o.createdAt) >= startOfDay);
    const week = delivered.filter((o: any) => new Date(o.createdAt) >= startOfWeek);

    return {
      totalOrders: delivered.length,
      totalRevenue: delivered.reduce((s, o: any) => s + goodsValue(o), 0),
      todayOrders: today.length,
      todayRevenue: today.reduce((s, o: any) => s + goodsValue(o), 0),
      weekOrders: week.length,
      weekRevenue: week.reduce((s, o: any) => s + goodsValue(o), 0),
      cancelled: orders.filter((o: any) => o.status === 'CANCELLED').length,
      active: orders.filter((o: any) =>
        ['PENDING','CONFIRMED','PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY'].includes(o.status)).length,
    };
  }

}