import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriversService } from '../drivers/drivers.service';
import { UserRole, UserStatus, DriverApprovalStatus, MerchantStatus, ProductStatus, DriverMode } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { StorageService } from '../deliveries/storage.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private driversService: DriversService,
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

  async getLiveOperations() {
    const activeStatuses = ['DRIVER_ASSIGNED','DRIVER_EN_ROUTE','DRIVER_ARRIVED','RIDE_IN_PROGRESS'];
    const [drivers, trips, searching, deliveries] = await Promise.all([
      this.prisma.driver.findMany({
        where: { approvalStatus: 'APPROVED', onlineStatus: { in: ['ONLINE','BUSY'] }, lastLat: { not: null }, lastLng: { not: null } },
        select: { id: true, lastLat: true, lastLng: true, lastLocationAt: true, onlineStatus: true, serviceType: true, driverMode: true, plate: true, rating: true, user: { select: { firstName: true, lastName: true, phone: true } } },
      }),
      this.prisma.trip.findMany({
        where: { status: { in: activeStatuses as any } },
        orderBy: { requestedAt: 'desc' },
        take: 200,
        include: { customer: { select: { firstName: true, lastName: true, phone: true, role: true } }, driver: { select: { id: true, lastLat: true, lastLng: true, plate: true, serviceType: true, user: { select: { firstName: true, lastName: true, phone: true } } } } },
      }),
      this.prisma.trip.count({ where: { status: 'SEARCHING_DRIVER' } }),
      this.prisma.delivery.findMany({
        where: { status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } },
        orderBy: { createdAt: 'desc' }, take: 200,
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
          driver: { select: { id: true, lastLat: true, lastLng: true, plate: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
          merchant: { select: { businessName: true, user: { select: { phone: true, firstName: true, lastName: true } } } },
          order: { include: { market: true } },
        },
      }),
    ]);

    const agentIds = (deliveries as any[]).map(d => d.order?.agentId).filter(Boolean);
    const agents = agentIds.length ? await this.prisma.agent.findMany({ where: { id: { in: agentIds } }, include: { user: { select: { firstName: true, lastName: true, phone: true } } } }) : [];
    const agentById = new Map(agents.map(a => [a.id, a]));

    const freshCutoff = Date.now() - 120000;
    const driverRows = drivers.map(d => ({
      id: d.id, lat: d.lastLat, lng: d.lastLng, status: d.onlineStatus, serviceType: d.serviceType, driverMode: d.driverMode,
      plate: d.plate, rating: d.rating, name: [d.user.firstName,d.user.lastName].filter(Boolean).join(' ') || 'Driver',
      phone: d.user.phone, locationFresh: !!d.lastLocationAt && new Date(d.lastLocationAt).getTime() >= freshCutoff,
      lastLocationAt: d.lastLocationAt,
    }));
    return {
      generatedAt: new Date(),
      kpis: {
        onlineDrivers: driverRows.filter(d => d.status === 'ONLINE').length,
        busyDrivers: driverRows.filter(d => d.status === 'BUSY').length,
        activeRides: trips.length,
        searchingRides: searching,
      },
      drivers: driverRows,
      deliveries: (deliveries as any[]).map(d => {
        const merchantName = [d.merchant?.user?.firstName, d.merchant?.user?.lastName].filter(Boolean).join(' ');
        const agent = d.order?.agentId ? agentById.get(d.order.agentId) : undefined;
        return {
          id: d.id, trackingCode: d.trackingCode, status: d.status, itemDescription: d.itemDescription,
          pickupAddress: d.pickupAddress, pickup: { lat: d.pickupLat, lng: d.pickupLng },
          dropoffAddress: d.dropoffAddress, dropoff: { lat: d.dropoffLat, lng: d.dropoffLng },
          receiverName: d.receiverName || [d.customer?.firstName,d.customer?.lastName].filter(Boolean).join(' ') || null,
          receiverPhone: d.receiverPhone,
          pickupContactName: (agent ? ([agent.user.firstName, agent.user.lastName].filter(Boolean).join(' ') || 'Market agent') : null) || d.order?.market?.pickupContactName || merchantName || d.merchant?.businessName || [d.customer?.firstName,d.customer?.lastName].filter(Boolean).join(' ') || 'Pickup contact',
          pickupPhone: agent?.user.phone || d.order?.market?.pickupPhone || d.merchant?.user?.phone || d.customer?.phone || null,
          driver: d.driver ? { id: d.driver.id, lat: d.driver.lastLat, lng: d.driver.lastLng, plate: d.driver.plate, name: [d.driver.user.firstName,d.driver.user.lastName].filter(Boolean).join(' ') || 'Driver' } : null,
        };
      }),
      rides: trips.map(t => ({
        id: t.id, status: t.status, serviceType: t.serviceType, fare: t.finalFare ?? t.estimatedFare,
        pickupAddress: t.pickupAddress, destinationAddress: t.destinationAddress,
        pickup: { lat: t.pickupLat, lng: t.pickupLng }, destination: { lat: t.destinationLat, lng: t.destinationLng },
        requestedAt: t.requestedAt, customer: t.customer,
        driver: t.driver ? { id: t.driver.id, lat: t.driver.lastLat, lng: t.driver.lastLng, plate: t.driver.plate, serviceType: t.driver.serviceType, name: [t.driver.user.firstName,t.driver.user.lastName].filter(Boolean).join(' ') || 'Driver' } : null,
      })),
    };
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


  // Production data-integrity monitor. This is intentionally read-only:
  // it surfaces reconciliation risks without mutating live financial or
  // operational records.
  async getSystemHealth() {
    const staleLocationCutoff = new Date(Date.now() - 5 * 60 * 1000);
    const pendingWalletCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      users, drivers, merchants, agents, staff,
      openSos, unverifiedDriverDocs, pendingMerchants, pendingProducts,
      pendingOrders, assignedDeliveries, onlineDrivers,
      negativeWallets, staleWalletTransactions, walletBalanceMismatches,
      orphanStaffMembers, staffUserStatusMismatches,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.driver.count(),
      this.prisma.merchant.count(),
      this.prisma.agent.count(),
      this.prisma.staffMember.count(),
      this.prisma.sosAlert.count({ where: { status: { not: 'RESOLVED' } } }),
      this.prisma.driverDocument.count({ where: { verified: false } }),
      this.prisma.merchant.count({ where: { status: 'PENDING' } }),
      this.prisma.product.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: { in: ['PENDING', 'PREPARING'] } } }),
      this.prisma.delivery.count({ where: { status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } } }),
      this.prisma.driver.count({ where: { onlineStatus: { in: ['ONLINE', 'BUSY'] } } }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "Wallet" WHERE balance < 0`,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "WalletTransaction" WHERE status = 'PENDING' AND "createdAt" < ${pendingWalletCutoff}`,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "WalletTransaction" wt JOIN "Wallet" w ON w.id = wt."walletId" WHERE wt.status = 'COMPLETED' AND wt."balanceAfter" <> wt."balanceBefore" + wt.amount`,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "StaffMember" WHERE "userId" IS NULL`,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "StaffMember" s JOIN "User" u ON u.id = s."userId" WHERE (s.active = true AND u.status <> 'ACTIVE') OR (s.active = false AND u.status = 'ACTIVE')`,
    ]);

    const staleOnlineDrivers = await this.prisma.driver.count({
      where: { onlineStatus: { in: ['ONLINE', 'BUSY'] }, OR: [{ lastLocationAt: null }, { lastLocationAt: { lt: staleLocationCutoff } }] },
    });

    const n = (v: Array<{ count: bigint }>) => Number(v[0]?.count ?? 0);
    const findings = [
      { key: 'negative_wallets', severity: 'critical', count: n(negativeWallets), title: 'Negative wallet balances', detail: 'Completed wallet activity has pushed one or more wallets below zero.' },
      { key: 'wallet_balance_mismatch', severity: 'critical', count: n(walletBalanceMismatches), title: 'Wallet ledger mismatches', detail: 'A completed transaction balanceAfter does not equal balanceBefore + amount.' },
      { key: 'orphan_staff', severity: 'high', count: n(orphanStaffMembers), title: 'Staff without user accounts', detail: 'Staff records cannot authenticate or be centrally suspended.' },
      { key: 'staff_status_mismatch', severity: 'high', count: n(staffUserStatusMismatches), title: 'Staff/user status mismatch', detail: 'Staff active state and linked user status disagree.' },
      { key: 'stale_online_drivers', severity: 'high', count: staleOnlineDrivers, title: 'Stale online drivers', detail: 'Drivers appear online/busy but have no location update in the last five minutes.' },
      { key: 'pending_wallet_transactions', severity: 'medium', count: n(staleWalletTransactions), title: 'Wallet transactions pending >24h', detail: 'Pending wallet transactions need reconciliation or expiry handling.' },
      { key: 'open_sos', severity: 'high', count: openSos, title: 'Open SOS alerts', detail: 'Safety alerts still require acknowledgement or resolution.' },
      { key: 'unverified_driver_docs', severity: 'medium', count: unverifiedDriverDocs, title: 'Unverified driver documents', detail: 'Driver documents remain pending review.' },
      { key: 'pending_merchants', severity: 'medium', count: pendingMerchants, title: 'Pending merchants', detail: 'Merchant applications are waiting for approval.' },
      { key: 'pending_products', severity: 'medium', count: pendingProducts, title: 'Pending products', detail: 'Products are waiting for admin review.' },
      { key: 'pending_orders', severity: 'medium', count: pendingOrders, title: 'Pending/preparing orders', detail: 'Orders are still in operational processing states.' },
      { key: 'active_deliveries', severity: 'info', count: assignedDeliveries, title: 'Active deliveries', detail: 'Deliveries are assigned or picked up and need operational monitoring.' },
    ];

    return {
      generatedAt: new Date(),
      healthy: findings.filter(f => f.severity === 'critical' || f.severity === 'high').every(f => f.count === 0),
      summary: { users, drivers, merchants, agents, staff, onlineDrivers },
      findings,
    };
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

  async adminResetUserPassword(actorId: string, userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) throw new BadRequestException('PASSWORD_TOO_SHORT');
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, email: true, firstName: true, lastName: true, role: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === actorId) throw new BadRequestException('USE_ACCOUNT_PASSWORD_CHANGE');
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_USER_PASSWORD_RESET',
        entityType: 'User',
        entityId: userId,
        metadataJson: JSON.stringify({ targetRole: target.role, targetPhone: target.phone, targetEmail: target.email }),
      },
    });
    return { reset: true, user: { id: target.id, firstName: target.firstName, lastName: target.lastName, phone: target.phone, email: target.email, role: target.role } };
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

  async getMediaLibrary() {
    const [products, markets, merchants, deliveries, documents] = await Promise.all([
      this.prisma.product.findMany({ where: { imageUrl: { not: null } }, select: { id: true, name: true, imageUrl: true, createdAt: true, merchant: { select: { businessName: true } } }, orderBy: { createdAt: 'desc' }, take: 300 }),
      this.prisma.market.findMany({ where: { OR: [{ imageUrl: { not: null } }, { coverUrl: { not: null } }] }, select: { id: true, name: true, imageUrl: true, coverUrl: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.merchant.findMany({ where: { OR: [{ logoUrl: { not: null } }, { coverUrl: { not: null } }] }, select: { id: true, businessName: true, logoUrl: true, coverUrl: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.delivery.findMany({ where: { OR: [{ imageUrl: { not: null } }, { pickupPhotoUrl: { not: null } }, { dropoffPhotoUrl: { not: null } }] }, select: { id: true, itemDescription: true, imageUrl: true, pickupPhotoUrl: true, dropoffPhotoUrl: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
      this.prisma.driverDocument.findMany({ where: { fileUrl: { not: null } }, select: { id: true, label: true, fileUrl: true, createdAt: true, driver: { select: { user: { select: { firstName: true, lastName: true, phone: true } } } } }, orderBy: { createdAt: 'desc' }, take: 300 }),
    ]);
    const media: any[] = [];
    for (const p of products) if (p.imageUrl) media.push({ id: 'product:' + p.id, url: p.imageUrl, type: 'product', title: p.name, owner: p.merchant?.businessName ?? 'Product', createdAt: p.createdAt });
    for (const m of markets) {
      if (m.imageUrl) media.push({ id: 'market:' + m.id + ':image', url: m.imageUrl, type: 'market', title: m.name, owner: 'Market', createdAt: m.createdAt });
      if (m.coverUrl) media.push({ id: 'market:' + m.id + ':cover', url: m.coverUrl, type: 'market-cover', title: m.name, owner: 'Market', createdAt: m.createdAt });
    }
    for (const m of merchants) {
      if (m.logoUrl) media.push({ id: 'merchant:' + m.id + ':logo', url: m.logoUrl, type: 'merchant-logo', title: m.businessName, owner: 'Merchant', createdAt: m.createdAt });
      if (m.coverUrl) media.push({ id: 'merchant:' + m.id + ':cover', url: m.coverUrl, type: 'merchant-cover', title: m.businessName, owner: 'Merchant', createdAt: m.createdAt });
    }
    for (const d of deliveries) {
      if (d.imageUrl) media.push({ id: 'delivery:' + d.id + ':package', url: d.imageUrl, type: 'delivery-package', title: d.itemDescription, owner: 'Delivery', createdAt: d.createdAt });
      if (d.pickupPhotoUrl) media.push({ id: 'delivery:' + d.id + ':pickup', url: d.pickupPhotoUrl, type: 'delivery-pickup', title: d.itemDescription, owner: 'Delivery', createdAt: d.createdAt });
      if (d.dropoffPhotoUrl) media.push({ id: 'delivery:' + d.id + ':dropoff', url: d.dropoffPhotoUrl, type: 'delivery-dropoff', title: d.itemDescription, owner: 'Delivery', createdAt: d.createdAt });
    }
    for (const d of documents) if (d.fileUrl) media.push({ id: 'document:' + d.id, url: d.fileUrl, type: 'driver-document', title: d.label, owner: [d.driver.user.firstName, d.driver.user.lastName].filter(Boolean).join(' ') || d.driver.user.phone, createdAt: d.createdAt });
    return media.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getProducts(status?: ProductStatus) {
    return this.prisma.product.findMany({
      where: status ? { status, merchantId: { not: null } } : { merchantId: { not: null } },
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

  async getMarketDashboard(marketId: string) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        agents: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
        _count: { select: { products: true, orders: true } },
      },
    });
    if (!market) throw new NotFoundException('Market not found');
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const orders = await this.prisma.order.findMany({
      where: { marketId },
      select: { id: true, agentId: true, status: true, total: true, deliveryFee: true, createdAt: true, items: { select: { quantity: true, status: true } } },
      orderBy: { createdAt: 'desc' }, take: 500,
    });
    const activeStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];
    const processingStatuses = ['CONFIRMED', 'PREPARING'];
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status));
    const processingOrders = orders.filter(o => processingStatuses.includes(o.status));
    const deliveredToday = orders.filter(o => o.status === 'DELIVERED' && new Date(o.createdAt) >= startOfDay);
    const cancelledToday = orders.filter(o => o.status === 'CANCELLED' && new Date(o.createdAt) >= startOfDay);
    const todayOrders = orders.filter(o => new Date(o.createdAt) >= startOfDay);
    const activeAgentIds = new Set(activeOrders.map(o => o.agentId).filter(Boolean) as string[]);
    const shoppingAgentIds = new Set(processingOrders.map(o => o.agentId).filter(Boolean) as string[]);
    const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
    const processingItems = processingOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
    return {
      market: { id: market.id, name: market.name, description: market.description, address: market.address, lat: market.lat, lng: market.lng, pickupContactName: market.pickupContactName, pickupPhone: market.pickupPhone, prepMinutes: market.prepMinutes, active: market.active },
      metrics: {
        totalAgents: market.agents.length, activeAgents: market.agents.filter(a => a.active).length,
        agentsWithActiveOrders: activeAgentIds.size, agentsShopping: shoppingAgentIds.size,
        totalProducts: market._count.products, totalOrders: market._count.orders, ordersToday: todayOrders.length,
        activeOrders: activeOrders.length, processingOrders: processingOrders.length,
        readyForPickup: orders.filter(o => o.status === 'READY_FOR_PICKUP').length,
        outForDelivery: orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length,
        deliveredToday: deliveredToday.length, cancelledToday: cancelledToday.length,
        totalItems, processingItems,
      },
      agents: market.agents.map(a => ({ id: a.id, userId: a.userId, firstName: a.user.firstName, lastName: a.user.lastName, phone: a.user.phone, active: a.active, working: activeAgentIds.has(a.id), shopping: shoppingAgentIds.has(a.id) })),
      recentOrders: orders.slice(0, 25),
    };
  }

  async createMarket(data: { name: string; description?: string; address: string; lat: number; lng: number; pickupContactName?: string; pickupPhone: string; imageUrl?: string }) {
    if (!data.pickupPhone?.trim()) throw new BadRequestException('PICKUP_PHONE_REQUIRED');
    return this.prisma.market.create({ data });
  }

  async updateMarket(id: string, data: Partial<{ name: string; description: string; address: string; lat: number; lng: number; pickupContactName: string; pickupPhone: string; active: boolean }>) {
    if (data.pickupPhone !== undefined && !data.pickupPhone?.trim()) throw new BadRequestException('PICKUP_PHONE_REQUIRED');
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
  async addMarketProduct(marketId: string, data: { name: string; description?: string; referenceCost: number; imageBase64?: string; stock?: number; available?: boolean }) {
    const market = await this.prisma.market.findUnique({ where: { id: marketId } });
    if (!market) throw new NotFoundException('Market not found');
    const config = await this.prisma.marketPriceConfig.findFirst();
    const markupPercent = config?.markupPercent ?? 20;
    const referenceCost = Number(data.referenceCost);
    if (!Number.isInteger(referenceCost) || referenceCost <= 0) throw new BadRequestException('INVALID_MARKET_REFERENCE_COST');
    const expectedPrice = Math.round(referenceCost * (1 + markupPercent / 100));
    let imageUrl: string | undefined;
    if (data.imageBase64) {
      try { const uploaded = await this.storage.uploadImage(data.imageBase64, 'market-products'); if (uploaded) imageUrl = uploaded; }
      catch (e: any) { console.error('[ADMIN] Market product image upload failed:', e?.message); }
    }
    return this.prisma.product.create({
      data: { marketId, name: data.name.trim(), description: data.description?.trim(), price: expectedPrice, referenceCost, category: 'GOODS', imageUrl, stock: data.stock ?? 0, status: 'APPROVED', available: data.available ?? true } as any,
    });
  }

  async updateMarketProduct(marketId: string, productId: string, data: { name?: string; description?: string; referenceCost?: number; imageBase64?: string; stock?: number; available?: boolean }) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, marketId, category: 'GOODS' } });
    if (!product) throw new NotFoundException('Market product not found');
    const config = await this.prisma.marketPriceConfig.findFirst();
    const markupPercent = config?.markupPercent ?? 20;
    const nextReference = data.referenceCost ?? product.referenceCost;
    if (!Number.isInteger(Number(nextReference)) || Number(nextReference) <= 0) throw new BadRequestException('INVALID_MARKET_REFERENCE_COST');
    const update: any = { referenceCost: Number(nextReference), price: Math.round(Number(nextReference) * (1 + markupPercent / 100)) };
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.description !== undefined) update.description = data.description.trim();
    if (data.stock !== undefined) {
      if (!Number.isInteger(Number(data.stock)) || Number(data.stock) < 0) throw new BadRequestException('INVALID_STOCK');
      update.stock = Number(data.stock);
    }
    if (data.available !== undefined) update.available = Boolean(data.available);
    if (data.imageBase64) {
      try { const uploaded = await this.storage.uploadImage(data.imageBase64, 'market-products'); if (uploaded) update.imageUrl = uploaded; }
      catch (e: any) { console.error('[ADMIN] Market product image upload failed:', e?.message); }
    }
    return this.prisma.product.update({ where: { id: productId }, data: update });
  }

  async disableMarketProduct(marketId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, marketId, category: 'GOODS' } });
    if (!product) throw new NotFoundException('Market product not found');
    return this.prisma.product.update({ where: { id: productId }, data: { available: false, status: 'DISABLED' } as any });
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
    if ((lat === null) !== (lng === null)) throw new BadRequestException('TEST_LOCATION_LAT_LNG_REQUIRED');
    const updated = await this.prisma.driver.update({ where: { id: driverId }, data: { testOverrideLat: lat, testOverrideLng: lng } });
    if (lat !== null && lng !== null) await this.driversService.updateLocation(driverId, lat, lng);
    return updated;
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

  async getStaffSecurity() {
    return this.prisma.staffMember.findMany({
      include: { user: { select: { id: true, phone: true, email: true, status: true, createdAt: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getAuditLog(limit = 100, action?: string, entityType?: string) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const rows = await this.prisma.auditLog.findMany({
      where: { ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}), ...(entityType ? { entityType } : {}) },
      orderBy: { createdAt: 'desc' }, take: safeLimit,
    });
    const actorIds = [...new Set(rows.map(r => r.actorId).filter(Boolean) as string[])];
    const actors = actorIds.length ? await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, role: true },
    }) : [];
    const actorById = new Map(actors.map(a => [a.id, a]));
    return rows.map(r => ({ ...r, actor: r.actorId ? actorById.get(r.actorId) || null : null }));
  }
}
