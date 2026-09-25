import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus, DriverApprovalStatus, MerchantStatus, ProductStatus, DriverMode } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { StorageService } from '../deliveries/storage.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private emailService: EmailService,
    private smsService: SmsService,
  ) {}

  // ─── OVERVIEW ────────────────────────────────────────────────────────────

  // Genuinely never existed on the backend at all — the dashboard UI for
  // this (volume, GMV, commission, completion rate, cash/digital split,
  // outstanding commission debt) was already built and calling this,
  // but nothing here ever answered it.
  // Previously a UI shell with nothing behind it — the admin
  // Notifications page called this endpoint and got a 404 every time.
  // Resolves the chosen audience to real recipients, then sends via
  // the requested channel. Capped per audience so a slip of the finger
  // ("All customers") can't silently fire off an unbounded number of
  // real SMS sends — a genuine cost risk, not just a UX guardrail.
  private readonly NOTIFICATION_AUDIENCE_CAP = 500;

  // Previously the only way to email anyone was through the audience
  // system, which requires a registered Zana user — no way to just
  // type an arbitrary address and send something (a partner, a press
  // contact, a foreign applicant before they're in the system at all).
  async sendCustomEmail(to: string, subject: string, message: string) {
    const ok = await this.emailService.sendCustom(to, subject, message);
    return { to, subject, sent: ok };
  }

  async sendNotification(data: { audience: string; channel: string; targetId?: string; title?: string; message: string }) {
    let recipients: { id: string; phone: string; email: string | null }[] = [];

    if (data.audience === 'Specific user') {
      if (!data.targetId) throw new BadRequestException('targetId is required for a specific user');
      const user = await this.prisma.user.findFirst({
        where: { OR: [{ id: data.targetId }, { phone: data.targetId }] },
        select: { id: true, phone: true, email: true },
      });
      if (!user) throw new NotFoundException('User not found');
      recipients = [user];
    } else {
      const roleMap: Record<string, UserRole> = {
        'All customers': 'CUSTOMER' as UserRole,
        'All drivers': 'DRIVER' as UserRole,
        'All merchants': 'MERCHANT' as UserRole,
      };
      const role = roleMap[data.audience];
      if (!role) throw new BadRequestException('Unknown audience');
      recipients = await this.prisma.user.findMany({
        where: { role },
        select: { id: true, phone: true, email: true },
        take: this.NOTIFICATION_AUDIENCE_CAP,
      });
    }

    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      let ok = false;
      if (data.channel === 'Email') {
        if (r.email) ok = await this.emailService.sendCustom(r.email, data.title || 'Zana Ride', data.message);
      } else if (data.channel === 'SMS') {
        ok = await this.smsService.send(r.phone, data.message);
      } else if (data.channel === 'Push') {
        // Push genuinely isn't wired up yet — Firebase Cloud Messaging
        // needs its own setup, same shape as today's LiveKit work.
        // Reporting this honestly as a failure rather than pretending
        // to send is the whole point of not silently no-opping here.
        ok = false;
      }
      if (ok) sent++; else failed++;
    }

    return { audience: data.audience, channel: data.channel, recipientCount: recipients.length, sent, failed };
  }

  async getDeliveryKpis(period: 'today' | 'week' | 'month' = 'today') {
    const now = new Date();
    const since = new Date(now);
    if (period === 'today') since.setHours(0, 0, 0, 0);
    else if (period === 'week') since.setDate(since.getDate() - 7);
    else since.setMonth(since.getMonth() - 1);

    const [created, delivered, cashDelivered, digitalDelivered, commissions, outstandingDebt] = await Promise.all([
      this.prisma.delivery.count({ where: { createdAt: { gte: since } } }),
      this.prisma.delivery.findMany({ where: { deliveredAt: { gte: since } }, select: { fee: true, paymentMethod: true } }),
      this.prisma.delivery.aggregate({ where: { deliveredAt: { gte: since }, paymentMethod: 'CASH' }, _sum: { fee: true } }),
      this.prisma.delivery.aggregate({ where: { deliveredAt: { gte: since }, paymentMethod: { not: 'CASH' } }, _sum: { fee: true } }),
      this.prisma.commission.aggregate({ where: { createdAt: { gte: since }, deliveryId: { not: null } }, _sum: { amount: true } }),
      // Outstanding debt is a current balance, not a period metric — it
      // always reflects everything unpaid right now, regardless of when
      // it was created.
      this.prisma.commissionDebt.aggregate({ where: { paidAt: null }, _sum: { amount: true } }),
    ]);

    const gmv = delivered.reduce((s, d) => s + d.fee, 0);

    return {
      volume: { delivered: delivered.length },
      performance: { completionRate: created > 0 ? Math.round((delivered.length / created) * 100) : 0 },
      financial: {
        gmv,
        zanaCommission: commissions._sum.amount ?? 0,
        cashGmv: cashDelivered._sum.fee ?? 0,
        digitalGmv: digitalDelivered._sum.fee ?? 0,
        outstandingCommissionDebt: outstandingDebt._sum.amount ?? 0,
      },
    };
  }

  // Previously an admin who wanted to find "that driver with plate
  // RAD 123" or "order for +250788..." had to already know which page
  // to look on and scroll through it manually. One query now checks
  // people (by name/phone/email/plate), merchants, products, and the
  // three transaction types by their id or tracking code.
  async globalSearch(q: string) {
    const query = q.trim();
    if (!query) return { people: [], merchants: [], products: [], trips: [], deliveries: [], orders: [] };

    const [people, merchants, products, trips, deliveries, orders] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
            { email: { contains: query, mode: 'insensitive' } },
            { driver: { plate: { contains: query, mode: 'insensitive' } } },
          ],
        },
        include: { driver: true, merchant: true, agent: true },
        take: 15,
      }),
      this.prisma.merchant.findMany({
        where: { businessName: { contains: query, mode: 'insensitive' } },
        include: { user: true },
        take: 10,
      }),
      this.prisma.product.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        include: { merchant: true, market: true },
        take: 10,
      }),
      this.prisma.trip.findMany({
        where: { id: { contains: query, mode: 'insensitive' } },
        include: { customer: true, driver: { include: { user: true } } },
        take: 10,
      }),
      this.prisma.delivery.findMany({
        where: {
          OR: [
            { id: { contains: query, mode: 'insensitive' } },
            { trackingCode: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: { customer: true, driver: { include: { user: true } } },
        take: 10,
      }),
      this.prisma.order.findMany({
        where: { id: { contains: query, mode: 'insensitive' } },
        include: { customer: true, merchant: true, market: true },
        take: 10,
      }),
    ]);

    return { people, merchants, products, trips, deliveries, orders };
  }

  async getOverview() {
    const [
      totalUsers, customers, merchants, drivers, agents,
      activeRides, activeDeliveries,
      pendingDrivers, pendingMerchants, pendingProducts,
      totalRevenue, totalDeliveries, deliveryRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { role: 'MERCHANT' } }),
      this.prisma.user.count({ where: { role: 'DRIVER' } }),
      this.prisma.user.count({ where: { role: 'AGENT' } }),
      this.prisma.trip.count({ where: { status: { in: ['DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_IN_PROGRESS'] } } }),
      this.prisma.delivery.count({ where: { status: { in: ['REQUESTED', 'COURIER_ASSIGNED', 'PICKED_UP'] } } }),
      this.prisma.driver.count({ where: { approvalStatus: 'PENDING' } }),
      this.prisma.merchant.count({ where: { status: 'PENDING' } }),
      this.prisma.product.count({ where: { status: 'PENDING' } }),
      this.prisma.trip.aggregate({ where: { status: 'RIDE_COMPLETED' }, _sum: { finalFare: true, estimatedFare: true } }),
      // Previously entirely absent from this overview — only rides had a
      // total count and revenue figure at all, even though deliveries
      // are a genuine, separate revenue stream this dashboard is
      // supposed to answer "where is the money" for.
      this.prisma.delivery.count({ where: { status: 'DELIVERED' } }),
      this.prisma.delivery.aggregate({ where: { status: 'DELIVERED' }, _sum: { fee: true } }),
    ]);

    return {
      totalUsers, customers, merchants, drivers, agents,
      activeRides, activeDeliveries,
      pendingDrivers, pendingMerchants, pendingProducts,
      totalRevenue: totalRevenue._sum.finalFare ?? totalRevenue._sum.estimatedFare ?? 0,
      totalDeliveries,
      deliveryRevenue: deliveryRevenue._sum.fee ?? 0,
    };
  }

  // ─── USERS ────────────────────────────────────────────────────────────────

  async getUsers(role?: UserRole, status?: UserStatus, search?: string) {
    return this.prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(search ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: { wallet: true, driver: true, merchant: true, agent: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    return this.prisma.user.update({ where: { id: userId }, data: { status } });
  }

  // Same drill-down gap as drivers — a customer's join date and ride
  // history had no view at all beyond the flat list.
  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        driver: { include: { documents: true } },
        merchant: true,
        agent: true,
        tripsAsCustomer: { orderBy: { requestedAt: 'desc' }, take: 20, include: { driver: { include: { user: { select: { firstName: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ─── DRIVERS ──────────────────────────────────────────────────────────────

  async getDrivers(approvalStatus?: DriverApprovalStatus) {
    return this.prisma.driver.findMany({
      where: approvalStatus ? { approvalStatus } : {},
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveDriver(driverId: string) {
    return this.prisma.driver.update({ where: { id: driverId }, data: { approvalStatus: 'APPROVED' } });
  }

  async rejectDriver(driverId: string, reason?: string) {
    return this.prisma.driver.update({ where: { id: driverId }, data: { approvalStatus: 'REJECTED' } });
  }

  async suspendDriver(driverId: string) {
    return this.prisma.driver.update({ where: { id: driverId }, data: { approvalStatus: 'SUSPENDED' } });
  }

  // ─── MERCHANTS ────────────────────────────────────────────────────────────

  async getMerchants(status?: MerchantStatus) {
    return this.prisma.merchant.findMany({
      where: status ? { status } : {},
      include: { user: true, products: { take: 5 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Previously there was no drill-down at all for merchants — the list
  // was the only view admin ever had, with no way to see their full
  // product catalog, order history, or revenue in one place.
  async getMerchantDetail(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        user: true,
        products: { orderBy: { createdAt: 'desc' } },
        orders: { orderBy: { createdAt: 'desc' }, take: 20, include: { customer: { select: { firstName: true } } } },
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const revenue = merchant.orders.reduce((s, o) => s + o.total, 0);
    return { ...merchant, revenue };
  }

  async approveMerchant(merchantId: string) {
    return this.prisma.merchant.update({ where: { id: merchantId }, data: { status: 'APPROVED' } });
  }

  async suspendMerchant(merchantId: string) {
    return this.prisma.merchant.update({ where: { id: merchantId }, data: { status: 'SUSPENDED' } });
  }

  // ─── PRODUCTS ─────────────────────────────────────────────────────────────

  async getProducts(status?: ProductStatus) {
    return this.prisma.product.findMany({
      where: status ? { status } : {},
      include: { merchant: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async reviewProduct(productId: string, status: 'APPROVED' | 'REJECTED', adminNote?: string) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { status, adminNote },
    });
  }

  // ─── RIDES ────────────────────────────────────────────────────────────────

  async getTrips() {
    return this.prisma.trip.findMany({
      include: { customer: true, driver: { include: { user: true } } },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
  }

  // ─── DELIVERIES ───────────────────────────────────────────────────────────

  async getDeliveries() {
    return this.prisma.delivery.findMany({
      include: {
        customer: true,
        merchant: { include: { user: true } },
        driver: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ─── MARKETS ──────────────────────────────────────────────────────────────

  async getMarkets() {
    return this.prisma.market.findMany({
      include: { agents: { include: { user: true } }, products: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMarket(data: { name: string; description?: string; address: string; lat: number; lng: number; imageUrl?: string }) {
    return this.prisma.market.create({ data });
  }

  async updateMarket(id: string, data: Partial<{ name: string; description: string; address: string; lat: number; lng: number; active: boolean }>) {
    return this.prisma.market.update({ where: { id }, data });
  }

  async deactivateMarket(id: string) {
    const market = await this.prisma.market.findUnique({ where: { id } });
    if (!market) throw new NotFoundException('Market not found');
    return this.prisma.market.update({ where: { id }, data: { active: false } });
  }

  // Previously the only way to list a market item at all was through an
  // agent's own app — admin had no upload path of their own for market
  // inventory, despite already having one for merchant products.
  async addMarketProduct(marketId: string, data: { name: string; description?: string; price: number; referenceCost?: number; imageBase64?: string; stock?: number }) {
    const config = await this.prisma.marketPriceConfig.findFirst();
    const markupPercent = config?.markupPercent ?? 20;
    const referenceCost = Number(data.referenceCost ?? data.price);
    if (!Number.isInteger(referenceCost) || referenceCost <= 0) {
      throw new BadRequestException('INVALID_MARKET_REFERENCE_COST');
    }
    const expectedPrice = Math.round(referenceCost * (1 + markupPercent / 100));
    if (data.price !== expectedPrice) {
      throw new BadRequestException('PRICE_MUST_MATCH_MARKUP');
    }

    let imageUrl: string | undefined;
    if (data.imageBase64) {
      try {
        const uploaded = await this.storage.uploadImage(data.imageBase64, 'market-products');
        if (uploaded) imageUrl = uploaded;
      } catch (e: any) {
        console.error('[ADMIN] Market product image upload failed:', e?.message);
      }
    }
    return this.prisma.product.create({
      data: {
        marketId,
        name: data.name,
        description: data.description,
        price: expectedPrice,
        referenceCost,
        category: 'GOODS',
        imageUrl,
        stock: data.stock ?? 0,
        status: 'APPROVED',
      } as any,
    });
  }

  // Edit and delete for market products didn't exist for admin at all —
  // a listing could only ever be created, never corrected or removed,
  // once it existed.
  async updateMarketProduct(productId: string, data: { name?: string; description?: string; price?: number; referenceCost?: number; imageBase64?: string; stock?: number }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.marketId) throw new NotFoundException('Market product not found');

    const config = await this.prisma.marketPriceConfig.findFirst();
    const markupPercent = config?.markupPercent ?? 20;
    const nextReference = data.referenceCost ?? product.referenceCost;
    if (!nextReference || !Number.isInteger(nextReference) || nextReference <= 0) {
      throw new BadRequestException('INVALID_MARKET_REFERENCE_COST');
    }
    const expectedPrice = Math.round(nextReference * (1 + markupPercent / 100));
    if (data.price != null && data.price !== expectedPrice) {
      throw new BadRequestException('PRICE_MUST_MATCH_MARKUP');
    }

    const update: any = { price: expectedPrice, referenceCost: nextReference };
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.stock !== undefined) update.stock = data.stock;
    if (data.imageBase64) {
      try {
        const uploaded = await this.storage.uploadImage(data.imageBase64, 'market-products');
        if (uploaded) update.imageUrl = uploaded;
      } catch (e: any) {
        console.error('[ADMIN] Market product image upload failed:', e?.message);
      }
    }
    return this.prisma.product.update({ where: { id: productId }, data: update });
  }

  // ─── AGENTS ───────────────────────────────────────────────────────────────

  async getAgents() {
    return this.prisma.agent.findMany({
      include: { user: true, market: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Previously there was no drill-down at all for agents — the list was
  // the only view admin ever had. order.agentId is a plain string, not
  // a Prisma relation (it stores the Agent model's own id), so this
  // needs a direct query rather than an include.
  async getAgentDetail(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { user: true, market: { include: { products: true } } },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    const orders = await this.prisma.order.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { customer: { select: { firstName: true } } },
    });
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    return { ...agent, orders, revenue };
  }

  async createAgent(data: { phone: string; firstName: string; lastName: string; email?: string; password: string; marketId?: string }) {
    const byPhone = await this.prisma.user.findUnique({ where: { phone: data.phone } });
    if (byPhone) throw new BadRequestException('A user with that phone number already exists');

    // Email is unique across every account, so an address already used by an
    // admin, driver or customer cannot be reused for an agent.
    const email = data.email?.trim() || undefined;
    if (email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        throw new BadRequestException(`${email} is already used by another account`);
      }
    }

    if (!data.password || data.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        password: passwordHash,
        role: UserRole.AGENT,
        wallet: { create: { balance: 0 } },
        agent: {
          create: {
            marketId: data.marketId ?? null,
            active: true,
          },
        },
      },
      include: { agent: true },
    });
  }

  async assignAgentToMarket(agentId: string, marketId: string) {
    return this.prisma.agent.update({ where: { id: agentId }, data: { marketId } });
  }

  async toggleAgent(agentId: string, active: boolean) {
    return this.prisma.agent.update({ where: { id: agentId }, data: { active } });
  }

  // ─── FARE CONFIG ──────────────────────────────────────────────────────────

  async getFares() {
    return this.prisma.fareConfig.findMany();
  }

  async updateFare(
    serviceType: string,
    data: Partial<{
      base: number;
      perKm: number;
      perMin: number;
      minimum: number;
      bookingFee: number;
      commissionRate: number;
      freeWaitingMinutes: number;
      waitingPerMinute: number;
    }>,
    actorId?: string,
  ) {
    const current = await this.prisma.fareConfig.findUnique({
      where: { serviceType: serviceType as any },
    });
    if (!current) throw new NotFoundException('Fare configuration not found');

    const numeric = Object.entries(data).filter(([, value]) => value !== undefined)
      .reduce((out, [key, value]) => ({ ...out, [key]: Number(value) }), {} as Record<string, number>);

    for (const [key, value] of Object.entries(numeric)) {
      if (!Number.isFinite(value)) throw new BadRequestException(`Invalid fare value: ${key}`);
    }
    if (numeric.commissionRate !== undefined && (numeric.commissionRate < 0 || numeric.commissionRate > 100)) {
      throw new BadRequestException('Commission rate must be between 0 and 100');
    }
    if (numeric.freeWaitingMinutes !== undefined && (numeric.freeWaitingMinutes < 0 || !Number.isInteger(numeric.freeWaitingMinutes))) {
      throw new BadRequestException('Free waiting time must be a whole number of minutes');
    }
    if (numeric.waitingPerMinute !== undefined && (numeric.waitingPerMinute < 0 || !Number.isInteger(numeric.waitingPerMinute))) {
      throw new BadRequestException('Waiting charge must be a whole number of RWF per minute');
    }

    const updated = await this.prisma.fareConfig.update({
      where: { serviceType: serviceType as any },
      data: numeric,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'FARE_CONFIG_UPDATED',
        entityType: 'FareConfig',
        entityId: current.id,
        beforeJson: JSON.stringify(current),
        afterJson: JSON.stringify(updated),
        metadataJson: JSON.stringify({ serviceType }),
      },
    }).catch(() => {});

    return updated;
  }

  async getOrders() {
    // Was already correctly returning both merchant and market orders —
    // no where-clause was ever excluding market orders. The actual gap
    // was narrower: market orders came back with nothing to identify
    // them by, since the market relation itself was never fetched, only
    // merchant. The agent who handled it is left as the plain agentId
    // scalar rather than a fetched relation, since Order has no direct
    // agent relation defined in the schema — just the raw ID.
    return this.prisma.order.findMany({
      include: {
        customer: true,
        merchant: true,
        market: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // Previously there was no drill-down at all for a single order — the
  // list row was the only view, with no delivery link, no timestamps
  // beyond creation, and the handling agent's name never resolved.
  async getOrderDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        merchant: { include: { user: true } },
        market: true,
        items: { include: { product: true } },
        delivery: { include: { driver: { include: { user: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    let agentName: string | null = null;
    if ((order as any).agentId) {
      const agent = await this.prisma.agent.findUnique({ where: { id: (order as any).agentId }, include: { user: true } });
      agentName = agent?.user ? `${agent.user.firstName} ${agent.user.lastName}` : null;
    }
    return { ...order, agentName };
  }

  async generateMerchantInvite(adminId: string) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    return this.prisma.merchantInvite.create({
      data: { createdBy: adminId, expiresAt },
    });
  }

  async getMerchantInvites() {
    return this.prisma.merchantInvite.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  }


  async deleteProduct(productId: string) {
    return this.prisma.product.delete({ where: { id: productId } });
  }

  async getExpenses() {
    return this.prisma.expense.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async addExpense(data: { title?: string; description?: string; amount: number; category: string }) {
    return this.prisma.expense.create({
      data: {
        title: data.title ?? data.description ?? 'Expense',
        description: data.description,
        amount: data.amount,
        category: data.category,
      } as any,
    });
  }

  async deleteExpense(id: string) {
    return this.prisma.expense.delete({ where: { id } });
  }

  // Live-testing only: overrides a specific driver's reported GPS with
  // fixed coordinates, so testers in another country (or anyone) can
  // use the real app normally while ride matching sees a controlled
  // Kigali-area position instead of their actual location. Off (null)
  // by default for every driver — this never affects a real account
  // unless explicitly set here.
  async setDriverTestLocation(driverId: string, lat: number | null, lng: number | null) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { testOverrideLat: lat, testOverrideLng: lng },
    });
  }

  async listDriverTestLocations() {
    return this.prisma.driver.findMany({
      where: { testOverrideLat: { not: null } },
      select: {
        id: true, vehicle: true, plate: true,
        testOverrideLat: true, testOverrideLng: true,
        user: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
  }

  // DANGEROUS — touches every driver account at once, not a single
  // one like the methods above. Always clears every existing override
  // first, so each run starts from a clean slate rather than layering
  // on top of whatever was set before — the point is a fresh, known
  // cluster for the test that's about to run, not an accumulation of
  // however many individual overrides happened to exist already.
  async scatterAllDriverTestLocations(centerLat: number, centerLng: number, radiusMeters = 500) {
    await this.prisma.driver.updateMany({
      data: { testOverrideLat: null, testOverrideLng: null },
    });

    const drivers = await this.prisma.driver.findMany({ select: { id: true } });
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos((centerLat * Math.PI) / 180);

    for (const d of drivers) {
      // A uniformly-distributed random point inside the circle — sqrt
      // on the radius fraction, not a plain linear scale, so points
      // don't bunch up near the center.
      const angle = Math.random() * 2 * Math.PI;
      const r = radiusMeters * Math.sqrt(Math.random());
      const dLat = (r * Math.sin(angle)) / metersPerDegreeLat;
      const dLng = (r * Math.cos(angle)) / metersPerDegreeLng;
      await this.prisma.driver.update({
        where: { id: d.id },
        data: { testOverrideLat: centerLat + dLat, testOverrideLng: centerLng + dLng },
      });
    }
    return { scattered: drivers.length, centerLat, centerLng, radiusMeters };
  }

  async clearAllDriverTestLocations() {
    const result = await this.prisma.driver.updateMany({
      data: { testOverrideLat: null, testOverrideLng: null },
    });
    return { cleared: result.count };
  }

  // ---- Same set of operations, for customer accounts ----

  async setCustomerTestLocation(userId: string, lat: number | null, lng: number | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { testOverrideLat: lat, testOverrideLng: lng },
    });
  }

  async listCustomerTestLocations() {
    return this.prisma.user.findMany({
      where: { role: 'CUSTOMER' as any, testOverrideLat: { not: null } },
      select: { id: true, firstName: true, lastName: true, phone: true, testOverrideLat: true, testOverrideLng: true },
    });
  }

  // DANGEROUS — touches every customer account at once. See
  // scatterAllDriverTestLocations above for the same pattern.
  async scatterAllCustomerTestLocations(centerLat: number, centerLng: number, radiusMeters = 500) {
    await this.prisma.user.updateMany({
      where: { role: 'CUSTOMER' as any },
      data: { testOverrideLat: null, testOverrideLng: null },
    });

    const customers = await this.prisma.user.findMany({ where: { role: 'CUSTOMER' as any }, select: { id: true } });
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos((centerLat * Math.PI) / 180);

    for (const c of customers) {
      const angle = Math.random() * 2 * Math.PI;
      const r = radiusMeters * Math.sqrt(Math.random());
      const dLat = (r * Math.sin(angle)) / metersPerDegreeLat;
      const dLng = (r * Math.cos(angle)) / metersPerDegreeLng;
      await this.prisma.user.update({
        where: { id: c.id },
        data: { testOverrideLat: centerLat + dLat, testOverrideLng: centerLng + dLng },
      });
    }
    return { scattered: customers.length, centerLat, centerLng, radiusMeters };
  }

  async clearAllCustomerTestLocations() {
    const result = await this.prisma.user.updateMany({
      where: { role: 'CUSTOMER' as any },
      data: { testOverrideLat: null, testOverrideLng: null },
    });
    return { cleared: result.count };
  }

  // Clears BOTH drivers and customers in one call — "destroy the test
  // session" once a live test wraps up, rather than needing to run
  // the driver and customer clears separately.
  async clearAllTestLocations() {
    const [drivers, customers] = await Promise.all([
      this.prisma.driver.updateMany({ data: { testOverrideLat: null, testOverrideLng: null } }),
      this.prisma.user.updateMany({ where: { role: 'CUSTOMER' as any }, data: { testOverrideLat: null, testOverrideLng: null } }),
    ]);
    return { driversCleared: drivers.count, customersCleared: customers.count };
  }
}
