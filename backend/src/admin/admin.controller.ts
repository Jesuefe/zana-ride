import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AdminService } from './admin.service';
import { CommissionService } from './commission.service';
import { FinancialService } from './financial.service';
import { ImpactFundDisbursementService } from './impact-fund-disbursement.service';
import { FinanceExtensionsService } from './finance-extensions.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaypackService } from '../wallet/paypack.service';
import { ZanaAiService } from '../zana-ai/zana-ai.service';
import { UserRole, UserStatus, DriverApprovalStatus, MerchantStatus, ProductStatus } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Roles('ADMIN', 'STAFF')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private commissionService: CommissionService,
    private financialService: FinancialService,
    private impactFundDisbursements: ImpactFundDisbursementService,
    private financeExtensions: FinanceExtensionsService,
    private prisma: PrismaService,
    private paypackService: PaypackService,
    private zanaAiService: ZanaAiService,
    private emailService: EmailService,
  ) {}

  @Roles('ADMIN', 'STAFF')
  @Get('me')
  getAdminSession(@CurrentUser() user: JwtPayload) { return { role: user.role, accessRole: user.accessRole || (user.role === 'ADMIN' ? 'ADMIN' : 'OPERATIONS') }; }



  @Post('onboarding/:userId/resend-credentials')
  async resendAssistedOnboardingCredentials(@CurrentUser() actor: JwtPayload, @Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { driver: true, merchant: true } });
    if (!user || !['DRIVER', 'MERCHANT'].includes(user.role) || !user.email) throw new BadRequestException('Assisted driver or merchant account with an email address not found.');
    const temporaryPassword = randomBytes(18).toString('base64url');
    const password = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { password, mustChangePassword: true } });
    const emailSent = await this.emailService.sendAssistedOnboardingCredentials(user.email, user.firstName || 'there', user.role as 'DRIVER' | 'MERCHANT', user.email, temporaryPassword);
    await this.prisma.auditLog.create({ data: {
      actorId: actor.sub, action: 'ASSISTED_ONBOARDING_CREDENTIALS_RESENT', entityType: 'User', entityId: user.id,
      metadataJson: JSON.stringify({ emailSent, role: user.role }),
    } });
    return { emailSent, message: emailSent ? 'A new temporary password has been emailed. The previous password no longer works.' : 'Email delivery failed again. Check the transactional email configuration.' };
  }

  @Post('onboarding/driver')
  async assistedDriverOnboarding(@CurrentUser() actor: JwtPayload, @Body() body: any) {
    const email = String(body.email ?? '').trim().toLowerCase();
    const phone = String(body.phone ?? '').trim();
    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const vehicle = String(body.vehicle ?? '').trim();
    const plate = String(body.plate ?? '').trim().toUpperCase();
    const serviceType = String(body.serviceType ?? '').trim().toUpperCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address.');
    if (!/^\+?[0-9]{9,15}$/.test(phone)) throw new BadRequestException('Enter a valid international phone number.');
    if (!firstName || !vehicle || !plate || !['BIKE', 'ECONOMY', 'COMFORT'].includes(serviceType)) throw new BadRequestException('Driver name, vehicle, plate and valid service type are required.');
    const [existingPhone, existingEmail] = await Promise.all([
      this.prisma.user.findUnique({ where: { phone }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (existingPhone || existingEmail) throw new BadRequestException('An account already exists with this phone number or email.');
    const temporaryPassword = randomBytes(18).toString('base64url');
    const password = await bcrypt.hash(temporaryPassword, 12);
    const user = await this.prisma.user.create({
      data: {
        phone, email, password, mustChangePassword: true, phoneVerified: false,
        firstName, lastName: lastName || null, role: UserRole.DRIVER, status: UserStatus.ACTIVE,
        wallet: { create: { balance: 0 } },
        driver: { create: {
          vehicle, plate, serviceType: serviceType as any,
          driverMode: ['RIDES', 'DELIVERIES', 'BOTH'].includes(body.driverMode) ? body.driverMode : 'BOTH',
          approvalStatus: DriverApprovalStatus.PENDING,
          vehicles: { create: { vehicleType: serviceType === 'BIKE' ? 'MOTORCYCLE' : 'CAR', make: vehicle, plate, status: 'PENDING' } },
        } },
      },
      include: { driver: true },
    });
    await this.prisma.auditLog.create({ data: {
      actorId: actor.sub, action: 'ASSISTED_DRIVER_ACCOUNT_CREATED', entityType: 'User', entityId: user.id,
      afterJson: JSON.stringify({ role: user.role, email, phone, driverId: user.driver?.id }),
    } });
    const emailSent = await this.emailService.sendAssistedOnboardingCredentials(email, firstName, 'DRIVER', email, temporaryPassword);
    return { created: true, accountId: user.id, role: user.role, emailSent, message: emailSent ? 'Driver account created and login details emailed.' : 'Account created, but email delivery failed. Do not ask the driver to guess the password; retry credential delivery.' };
  }

  @Post('onboarding/merchant')
  async assistedMerchantOnboarding(@CurrentUser() actor: JwtPayload, @Body() body: any) {
    const email = String(body.email ?? '').trim().toLowerCase();
    const phone = String(body.phone ?? '').trim();
    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const businessName = String(body.businessName ?? '').trim();
    const category = String(body.category ?? 'GOODS').trim().toUpperCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address.');
    if (!/^\+?[0-9]{9,15}$/.test(phone)) throw new BadRequestException('Enter a valid international phone number.');
    if (!firstName || !businessName || !['FOOD', 'GIFTS', 'GOODS'].includes(category)) throw new BadRequestException('Contact name, business name and a valid category are required.');
    const [existingPhone, existingEmail] = await Promise.all([
      this.prisma.user.findUnique({ where: { phone }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (existingPhone || existingEmail) throw new BadRequestException('An account already exists with this phone number or email.');
    const temporaryPassword = randomBytes(18).toString('base64url');
    const password = await bcrypt.hash(temporaryPassword, 12);
    const user = await this.prisma.user.create({
      data: {
        phone, email, password, mustChangePassword: true, phoneVerified: false,
        firstName, lastName: lastName || null, role: UserRole.MERCHANT, status: UserStatus.ACTIVE,
        wallet: { create: { balance: 0 } },
        merchant: { create: {
          businessName, category: category as any, branch: String(body.branch ?? '').trim() || null,
          whatsappPhone: String(body.whatsappPhone ?? '').trim() || phone,
          status: MerchantStatus.PENDING,
        } },
      },
      include: { merchant: true },
    });
    await this.prisma.auditLog.create({ data: {
      actorId: actor.sub, action: 'ASSISTED_MERCHANT_ACCOUNT_CREATED', entityType: 'User', entityId: user.id,
      afterJson: JSON.stringify({ role: user.role, email, phone, merchantId: user.merchant?.id, businessName }),
    } });
    const emailSent = await this.emailService.sendAssistedOnboardingCredentials(email, firstName, 'MERCHANT', email, temporaryPassword);
    return { created: true, accountId: user.id, role: user.role, emailSent, message: emailSent ? 'Merchant account created and login details emailed.' : 'Account created, but email delivery failed. Retry credential delivery before handing over access.' };
  }


  @Get('promotions')
  async listMerchantPromotions(@Query('status') status?: string) {
    return this.prisma.merchantPromotion.findMany({
      where: status && ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ACTIVE'].includes(status) ? { status } : {},
      include: { merchant: { select: { id: true, businessName: true, promoExempt: true, user: { select: { email: true, phone: true } } } }, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }, take: 500,
    });
  }

  @Roles('ADMIN')
  @Patch('merchants/:id/promotion-exemption')
  async setMerchantPromotionExemption(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: { exempt: boolean; reason?: string }) {
    if (typeof body.exempt !== 'boolean') throw new BadRequestException('Exemption must be true or false.');
    const reason = String(body.reason ?? '').trim();
    if (body.exempt && reason.length < 5) throw new BadRequestException('A reason of at least 5 characters is required to grant an exemption.');
    const current = await this.prisma.merchant.findUnique({ where: { id }, select: { id: true, promoExempt: true, promoExemptionReason: true } });
    if (!current) throw new BadRequestException('Merchant not found.');
    const updated = await this.prisma.merchant.update({ where: { id }, data: { promoExempt: body.exempt, promoExemptionReason: body.exempt ? reason : null } });
    await this.prisma.auditLog.create({ data: {
      actorId: actor.sub, action: body.exempt ? 'MERCHANT_PROMOTION_EXEMPTION_GRANTED' : 'MERCHANT_PROMOTION_EXEMPTION_REVOKED',
      entityType: 'Merchant', entityId: id, beforeJson: JSON.stringify(current),
      afterJson: JSON.stringify({ promoExempt: updated.promoExempt, promoExemptionReason: updated.promoExemptionReason }),
    } });
    return { id: updated.id, promoExempt: updated.promoExempt, promoExemptionReason: updated.promoExemptionReason };
  }

  @Roles('ADMIN', 'STAFF')
  @Patch('promotions/:id/status')
  async reviewMerchantPromotion(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: { status: string; reason?: string }) {
    if (!['APPROVED', 'REJECTED', 'SUSPENDED'].includes(body.status)) throw new BadRequestException('Promotion status must be APPROVED, REJECTED or SUSPENDED.');
    const current = await this.prisma.merchantPromotion.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!current) throw new BadRequestException('Promotion not found.');
    const updated = await this.prisma.merchantPromotion.update({ where: { id }, data: { status: body.status } });
    await this.prisma.auditLog.create({ data: {
      actorId: actor.sub, action: 'MERCHANT_PROMOTION_REVIEWED', entityType: 'MerchantPromotion', entityId: id,
      beforeJson: JSON.stringify(current), afterJson: JSON.stringify({ status: updated.status }),
      metadataJson: JSON.stringify({ reason: String(body.reason ?? '').trim() }),
    } });
    return updated;
  }

  @Roles('ADMIN')
  @Get('rider-registrations')
  async getRiderRegistrations(@Query('status') status?: string, @Query('search') search?: string) {
    const where: any = {};
    if (status && ['NEW', 'CONTACTED', 'APPROVED', 'REJECTED'].includes(status)) where.status = status;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.riderRegistration.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
  }

  @Roles('ADMIN')
  @Get('rider-registrations/daily')
  async getRiderRegistrationDailyStats() {
    return this.prisma.$queryRaw<Array<{ day: string; count: number }>>`
      SELECT TO_CHAR(("createdAt" AT TIME ZONE 'Africa/Kigali')::date, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM "RiderRegistration"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY ("createdAt" AT TIME ZONE 'Africa/Kigali')::date
      ORDER BY ("createdAt" AT TIME ZONE 'Africa/Kigali')::date ASC
    `;
  }

  @Roles('ADMIN')
  @Patch('rider-registrations/:id/status')
  async updateRiderRegistrationStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    if (!body.status || !['NEW', 'CONTACTED', 'APPROVED', 'REJECTED'].includes(body.status)) {
      throw new BadRequestException('Status must be NEW, CONTACTED, APPROVED, or REJECTED.');
    }
    return this.prisma.riderRegistration.update({ where: { id }, data: { status: body.status } });
  }

  @Roles('ADMIN', 'STAFF')
  @Get('merchant-leads')
  async getMerchantLeads(@Query('status') status?: string, @Query('search') search?: string) {
    const where: any = {};
    const allowed = ['NEW', 'CONTACTED', 'INTERESTED', 'MEETING_SCHEDULED', 'ONBOARDED', 'NOT_INTERESTED'];
    if (status && allowed.includes(status)) where.status = status;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { businessName: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { whatsappPhone: { contains: q } },
        { businessAddress: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.merchantLead.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
  }

  @Roles('ADMIN', 'STAFF')
  @Patch('merchant-leads/:id')
  async updateMerchantLead(@Param('id') id: string, @Body() body: { status?: string; internalNotes?: string }) {
    const allowed = ['NEW', 'CONTACTED', 'INTERESTED', 'MEETING_SCHEDULED', 'ONBOARDED', 'NOT_INTERESTED'];
    if (body.status && !allowed.includes(body.status)) throw new BadRequestException('Invalid merchant lead status.');
    if (body.internalNotes !== undefined && typeof body.internalNotes !== 'string') throw new BadRequestException('Internal notes must be text.');
    return this.prisma.merchantLead.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status, ...(body.status === 'CONTACTED' ? { contactedAt: new Date() } : {}) } : {}),
        ...(body.internalNotes !== undefined ? { internalNotes: body.internalNotes.slice(0, 3000) } : {}),
      },
    });
  }

  @Roles('ADMIN')
  @Get('overview')
  overview() { return this.adminService.getOverview(); }

  @Get('search')
  search(@Query('q') q: string) { return this.adminService.globalSearch(q ?? ''); }


  // Customer support tickets. Financial changes are deliberately not exposed
  // through these routes; payment issues are recorded and escalated as cases.
  @Roles('ADMIN', 'STAFF')
  @Get('support/tickets')
  getSupportTickets(@Query('status') status?: string, @Query('search') search?: string) {
    return this.adminService.getSupportTickets(status, search);
  }

  @Roles('ADMIN', 'STAFF')
  @Post('support/tickets')
  createSupportTicket(@CurrentUser() user: JwtPayload, @Body() body: any) {
    return this.adminService.createSupportTicket(body, user.sub);
  }

  @Roles('ADMIN', 'STAFF')
  @Patch('support/tickets/:id')
  updateSupportTicket(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateSupportTicket(id, body, user.sub);
  }


  @Post('notifications')
  sendNotification(@Body() body: { audience: string; channel: string; targetId?: string; title?: string; message: string }) {
    return this.adminService.sendNotification(body);
  }

  @Roles('ADMIN')
  @Post('email/send')
  sendCustomEmail(@Body() body: { to: string; subject: string; message: string }) {
    return this.adminService.sendCustomEmail(body.to, body.subject, body.message);
  }

  @Get('delivery-kpis')
  deliveryKpis(@Query('period') period?: 'today' | 'week' | 'month') {
    return this.adminService.getDeliveryKpis(period);
  }

  // Live operations control feed
  @Get('operations/live')
  liveOperations() { return this.adminService.getLiveOperations(); }

  // Unified accounting ledger for the operations/AI accounting layer.
  @Roles('ADMIN', 'STAFF')
  @Get('accounting/ledger')
  accountingLedger(@Query('limit') limit?: string) {
    return this.financialService.getAccountingLedger(limit ? Number(limit) : 500);
  }

  // Financial snapshot
  @Roles('ADMIN', 'STAFF')
  @Get('financial')
  financial() { return this.financialService.getFinancialSnapshot(); }

  @Roles('ADMIN', 'STAFF')
  @Get('financial/monthly-profit')
  monthlyProfit(@Query('month') month: string) { return this.financialService.getMonthlyProfitability(month); }

  @Roles('ADMIN')
  @Post('financial/monthly-profit/close')
  closeMonthlyProfit(@CurrentUser() user: JwtPayload, @Body() body: { month: string; confirm?: boolean }) {
    if (body.confirm !== true) throw new BadRequestException('Explicit confirmation is required to close a financial month.');
    return this.financialService.closeMonthlyProfit(body.month, user.sub);
  }

  // Driver settlement monitor — reads the same existing ledger, not a
  // separate financial system.
  @Roles('ADMIN', 'STAFF')
  @Get('settlements/overview')
  settlementOverview() { return this.financialService.getSettlementOverview(); }

  @Roles('ADMIN', 'STAFF')
  @Get('settlements/drivers')
  driverSettlements() { return this.financialService.getDriverSettlements(); }

  // Zana Impact Funds — separate append-only ledger funded from Zana's recognized commission only.
  @Roles('ADMIN', 'STAFF')
  @Get('impact-funds')
  async getImpactFunds(@Query('from') from?: string, @Query('to') to?: string, @Query('sourceType') sourceType?: string) {
    const where: any = {};
    if (from) { const date = new Date(from); if (!Number.isNaN(date.getTime())) where.createdAt = { ...(where.createdAt ?? {}), gte: date }; }
    if (to) { const date = new Date(to); if (!Number.isNaN(date.getTime())) { date.setHours(23, 59, 59, 999); where.createdAt = { ...(where.createdAt ?? {}), lte: date }; } }
    if (sourceType && ['RIDE', 'DELIVERY', 'FOOD_ORDER', 'SHOPPING_ORDER', 'NET_PROFIT'].includes(sourceType)) where.sourceType = sourceType;
    const config = await this.prisma.impactFundConfig.upsert({ where: { id: 'default' }, create: { id: 'default', ratePercent: 3 }, update: {} });
    const [entries, allRows, rideDeliveryCommission, foodCommission, shoppingRows] = await Promise.all([
      this.prisma.impactFundEntry.findMany({ where, orderBy: { createdAt: 'desc' }, take: 2000 }),
      this.prisma.impactFundEntry.findMany({ select: { sourceType: true, sourceId: true, contributionAmount: true, platformCommission: true, createdAt: true, eventType: true } }),
      this.prisma.commission.aggregate({ where: { createdAt: { gte: config.createdAt, lt: config.profitBasedFrom } }, _sum: { amount: true } }),
      this.prisma.merchantSettlement.aggregate({ where: { createdAt: { gte: config.createdAt, lt: config.profitBasedFrom }, status: { not: 'CANCELLED' } }, _sum: { commissionAmount: true } }),
      this.prisma.agentSettlement.findMany({ where: { createdAt: { gte: config.createdAt, lt: config.profitBasedFrom }, status: { not: 'CANCELLED' } }, select: { zanaEarning: true } }),
    ]);
    const currentBalance = allRows.reduce((sum, row) => sum + row.contributionAmount, 0);
    const allAccruals = allRows.filter(row => row.eventType === 'ACCRUAL');
    const commissionAccruals = allAccruals.filter(row => row.sourceType !== 'NET_PROFIT' && row.createdAt < config.profitBasedFrom);
    const sourceCommissionTotal = (rideDeliveryCommission._sum.amount ?? 0) + (foodCommission._sum.commissionAmount ?? 0) + shoppingRows.reduce((sum, row) => sum + Math.max(0, row.zanaEarning), 0);
    const ledgerCommissionTotal = commissionAccruals.reduce((sum, row) => sum + row.platformCommission, 0);
    const reconciliation = {
      sourceCommissionTotal,
      ledgerCommissionTotal,
      difference: sourceCommissionTotal - ledgerCommissionTotal,
      status: sourceCommissionTotal === ledgerCommissionTotal ? 'RECONCILED' : 'REVIEW_REQUIRED',
      since: config.createdAt,
      legacyCommissionLedgerThrough: config.profitBasedFrom,
    };
    const lifetimeContributions = allAccruals.reduce((sum, row) => sum + row.contributionAmount, 0);
    const monthKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit' }).format(date);
    const monthMap = new Map<string, { month: string; contributions: number; transactions: number }>();
    for (const row of allRows) {
      const key = row.sourceType === 'NET_PROFIT' && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.sourceId) ? row.sourceId : monthKey(row.createdAt);
      const item = monthMap.get(key) ?? { month: key, contributions: 0, transactions: 0 };
      item.contributions += row.contributionAmount;
      if (row.eventType === 'ACCRUAL') item.transactions += 1;
      monthMap.set(key, item);
    }
    const thisMonth = monthKey(new Date());
    return {
      ratePercent: config.ratePercent,
      currentBalance,
      lifetimeContributions,
      thisMonthContributions: monthMap.get(thisMonth)?.contributions ?? 0,
      thisMonthTransactions: monthMap.get(thisMonth)?.transactions ?? 0,
      lifetimeTransactions: allAccruals.length,
      reconciliation,
      monthly: [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month)),
      entries,
    };
  }

  @Roles('ADMIN', 'STAFF')
  @Get('impact-funds/disbursements')
  listImpactFundDisbursements() { return this.impactFundDisbursements.list(); }

  @Roles('ADMIN', 'STAFF')
  @Post('impact-funds/disbursements')
  requestImpactFundDisbursement(@CurrentUser() user: JwtPayload, @Body() body: { amount: number; recipientName: string; recipientType?: string; purpose: string }) {
    return this.impactFundDisbursements.request(user.sub, body);
  }

  @Roles('ADMIN')
  @Post('impact-funds/disbursements/:id/approve')
  approveImpactFundDisbursement(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.impactFundDisbursements.approve(user.sub, id);
  }

  @Roles('ADMIN')
  @Post('impact-funds/disbursements/:id/reject')
  rejectImpactFundDisbursement(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.impactFundDisbursements.reject(user.sub, id, body.reason);
  }

  @Roles('ADMIN')
  @Post('impact-funds/disbursements/:id/paid')
  markImpactFundDisbursementPaid(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { paymentMethod: string; paymentReference: string; evidenceUrl?: string }) {
    return this.impactFundDisbursements.markPaid(user.sub, id, body);
  }

  @Roles('ADMIN')
  @Patch('impact-funds/rate')
  async updateImpactFundsRate(@CurrentUser() user: JwtPayload, @Body() body: { ratePercent?: number; confirm?: boolean }) {
    if (body.confirm !== true) throw new BadRequestException('Explicit confirmation is required to change the Impact Funds rate.');
    if (body.ratePercent !== 3) throw new BadRequestException('The monthly ZIF allocation is fixed at 3% of positive net profit.');
    return this.prisma.$transaction(async tx => {
      const before = await tx.impactFundConfig.upsert({ where: { id: 'default' }, create: { id: 'default', ratePercent: 3 }, update: {} });
      const after = await tx.impactFundConfig.update({ where: { id: 'default' }, data: { ratePercent: body.ratePercent! } });
      await tx.auditLog.create({ data: {
        actorId: user.sub, action: 'IMPACT_FUNDS_RATE_CHANGED', entityType: 'ImpactFundConfig', entityId: 'default',
        beforeJson: JSON.stringify({ ratePercent: before.ratePercent }), afterJson: JSON.stringify({ ratePercent: after.ratePercent }),
        metadataJson: JSON.stringify({ confirmed: true }),
      }});
      return after;
    });
  }

  @Roles('ADMIN')
  @Post('impact-funds/:id/reverse')
  async reverseImpactFundsEntry(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { reason?: string }) {
    const reason = body.reason?.trim();
    if (!reason || reason.length < 5 || reason.length > 500) throw new BadRequestException('Provide a reversal reason between 5 and 500 characters.');
    try {
      return await this.prisma.$transaction(async tx => {
        const original = await tx.impactFundEntry.findUnique({ where: { id } });
        if (!original || original.eventType !== 'ACCRUAL') throw new BadRequestException('Only original accrual entries can be reversed.');
        const idempotencyKey = `REVERSAL:${original.id}`;
        const existing = await tx.impactFundEntry.findUnique({ where: { idempotencyKey } });
        if (existing) return existing;
        const reversal = await tx.impactFundEntry.create({ data: {
          sourceType: original.sourceType, sourceId: original.sourceId, eventType: 'REVERSAL',
          grossAmount: -original.grossAmount, platformCommission: -original.platformCommission,
          contributionAmount: -original.contributionAmount, ratePercent: original.ratePercent,
          status: 'REVERSED', idempotencyKey, description: reason,
        }});
        await tx.auditLog.create({ data: {
          actorId: user.sub, action: 'IMPACT_FUNDS_ENTRY_REVERSED', entityType: 'ImpactFundEntry', entityId: original.id,
          beforeJson: JSON.stringify(original), afterJson: JSON.stringify(reversal), metadataJson: JSON.stringify({ reason }),
        }});
        return reversal;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existing = await this.prisma.impactFundEntry.findUnique({ where: { idempotencyKey: `REVERSAL:${id}` } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  // Commissions
  @Roles('ADMIN', 'STAFF')
  @Get('commissions')
  commissions() { return this.commissionService.getAll(); }

  @Roles('ADMIN', 'STAFF')
  @Get('commissions/summary')
  commissionSummary() { return this.commissionService.getSummary(); }

  // Expenses
  @Roles('ADMIN', 'STAFF')
  @Get('expenses')
  getExpenses(@Query('from') from?: string, @Query('to') to?: string) { return this.financialService.getExpenses(from, to); }

  @Roles('ADMIN')
  @Post('expenses')
  createExpense(@CurrentUser() admin: JwtPayload, @Body() body: { title: string; amount: number; category: string; description?: string; vendor?: string; invoiceNumber?: string; dueDate?: string; date?: string; paymentReference?: string; amountPaid?: number }) {
    return this.financialService.createExpense(body, admin.sub);
  }

  @Roles('ADMIN')
  @Post('expenses/:id/approve')
  approveExpense(@CurrentUser() admin: JwtPayload, @Param('id') id: string) { return this.financialService.approveExpense(id, admin.sub); }

  @Roles('ADMIN')
  @Patch('expenses/:id/payment')
  updateExpensePayment(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { amountPaid: number; paymentReference?: string }) { return this.financialService.updateExpensePayment(id, Number(body.amountPaid), body.paymentReference, admin.sub); }

  @Roles('ADMIN')
  @Post('expenses/:id/void')
  voidExpense(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { reason: string }) { return this.financialService.voidExpense(id, body.reason, admin.sub); }

  // Service-zone management. Boundaries are stored as validated GeoJSON.
  private validateServiceZoneBoundary(boundary: any) {
    if (!boundary || !['Polygon', 'MultiPolygon'].includes(boundary.type) || !Array.isArray(boundary.coordinates)) {
      throw new BadRequestException('SERVICE_ZONE_BOUNDARY_MUST_BE_GEOJSON_POLYGON_OR_MULTIPOLYGON');
    }
    const rings = boundary.type === 'Polygon' ? boundary.coordinates : boundary.coordinates.flat(1);
    if (!rings.length || rings.some((ring: any) => !Array.isArray(ring) || ring.length < 4)) {
      throw new BadRequestException('SERVICE_ZONE_BOUNDARY_REQUIRES_CLOSED_RINGS_WITH_AT_LEAST_3_POINTS');
    }
    for (const ring of rings) {
      const valid = ring.every((point: any) => Array.isArray(point) && point.length >= 2 &&
        Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])) &&
        Number(point[0]) >= -180 && Number(point[0]) <= 180 &&
        Number(point[1]) >= -90 && Number(point[1]) <= 90);
      if (!valid) throw new BadRequestException('SERVICE_ZONE_BOUNDARY_CONTAINS_INVALID_LONGITUDE_OR_LATITUDE');
      const first = ring[0], last = ring[ring.length - 1];
      if (Number(first[0]) !== Number(last[0]) || Number(first[1]) !== Number(last[1])) {
        throw new BadRequestException('SERVICE_ZONE_POLYGON_RING_MUST_BE_CLOSED');
      }
    }
    return boundary;
  }

  private validateServiceZoneTypes(values: any) {
    const allowed = ['ALL', 'BIKE', 'ECONOMY', 'COMFORT', 'DELIVERIES'];
    if (values === undefined) return ['ALL'];
    if (!Array.isArray(values) || values.length === 0 || values.some((v: any) => !allowed.includes(v))) {
      throw new BadRequestException('SERVICE_ZONE_TYPES_INVALID');
    }
    return values.includes('ALL') ? ['ALL'] : [...new Set(values)];
  }

  @Roles('ADMIN', 'STAFF')
  @Get('service-zones')
  async getServiceZones(@Query('city') city?: string) {
    return this.prisma.serviceZone.findMany({
      where: city?.trim() ? { city: { equals: city.trim(), mode: 'insensitive' } } : {},
      orderBy: [{ zoneLevel: 'asc' }, { name: 'asc' }],
    });
  }

  @Roles('ADMIN')
  @Post('service-zones')
  async createServiceZone(@CurrentUser() admin: JwtPayload, @Body() body: any) {
    const name = String(body?.name ?? '').trim();
    const city = String(body?.city ?? '').trim();
    if (!name || !city) throw new BadRequestException('SERVICE_ZONE_NAME_AND_CITY_REQUIRED');
    const boundary = this.validateServiceZoneBoundary(body.boundary);
    const serviceTypes = this.validateServiceZoneTypes(body.serviceTypes);
    const zoneLevel = body.zoneLevel === 'MAIN' ? 'MAIN' : 'MINI';
    const parentZoneId = zoneLevel === 'MAIN' ? null : (body.parentZoneId || null);
    const nearbyZoneIds: string[] = Array.isArray(body.nearbyZoneIds) ? Array.from(new Set<string>(body.nearbyZoneIds.map((value: any) => String(value)))) : [];
    if (nearbyZoneIds.some((id: string) => !id.trim())) throw new BadRequestException('SERVICE_ZONE_NEIGHBOUR_IDS_INVALID');
    if (parentZoneId) {
      const parent = await this.prisma.serviceZone.findUnique({ where: { id: parentZoneId } });
      if (!parent || parent.zoneLevel !== 'MAIN' || parent.city.toLowerCase() !== city.toLowerCase()) {
        throw new BadRequestException('SERVICE_ZONE_PARENT_MUST_BE_A_MAIN_ZONE_IN_THE_SAME_CITY');
      }
    }
    const linked = nearbyZoneIds.length ? await this.prisma.serviceZone.findMany({ where: { id: { in: nearbyZoneIds }, city: { equals: city, mode: 'insensitive' } }, select: { id: true } }) : [];
    if (linked.length !== nearbyZoneIds.length) throw new BadRequestException('SERVICE_ZONE_NEIGHBOURS_MUST_EXIST_IN_THE_SAME_CITY');
    const id = randomBytes(12).toString('hex');
    return this.prisma.$transaction(async tx => {
      const zone = await tx.serviceZone.create({ data: { id, name, city, boundary, serviceTypes, nearbyZoneIds, active: body.active === true, zoneLevel, parentZoneId } as any });
      for (const neighbourId of nearbyZoneIds) {
        const neighbour = await tx.serviceZone.findUnique({ where: { id: neighbourId } });
        if (neighbour && !neighbour.nearbyZoneIds.includes(id)) {
          await tx.serviceZone.update({ where: { id: neighbourId }, data: { nearbyZoneIds: [...neighbour.nearbyZoneIds, id] } });
        }
      }
      await tx.auditLog.create({ data: { actorId: admin.sub, action: 'SERVICE_ZONE_CREATED', entityType: 'ServiceZone', entityId: id, afterJson: JSON.stringify(zone) } });
      return zone;
    });
  }

  @Roles('ADMIN')
  @Patch('service-zones/:id')
  async updateServiceZone(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: any) {
    const before = await this.prisma.serviceZone.findUnique({ where: { id } });
    if (!before) throw new BadRequestException('SERVICE_ZONE_NOT_FOUND');
    const name = body.name === undefined ? before.name : String(body.name).trim();
    const city = body.city === undefined ? before.city : String(body.city).trim();
    if (!name || !city) throw new BadRequestException('SERVICE_ZONE_NAME_AND_CITY_REQUIRED');
    const zoneLevel = body.zoneLevel === undefined ? before.zoneLevel : (body.zoneLevel === 'MAIN' ? 'MAIN' : body.zoneLevel === 'MINI' ? 'MINI' : null);
    if (!zoneLevel) throw new BadRequestException('SERVICE_ZONE_LEVEL_INVALID');
    const parentZoneId = zoneLevel === 'MAIN' ? null : (body.parentZoneId === undefined ? before.parentZoneId : body.parentZoneId || null);
    if (parentZoneId === id) throw new BadRequestException('SERVICE_ZONE_CANNOT_BE_ITS_OWN_PARENT');
    if (parentZoneId) {
      const parent = await this.prisma.serviceZone.findUnique({ where: { id: parentZoneId } });
      if (!parent || parent.zoneLevel !== 'MAIN' || parent.city.toLowerCase() !== city.toLowerCase()) {
        throw new BadRequestException('SERVICE_ZONE_PARENT_MUST_BE_A_MAIN_ZONE_IN_THE_SAME_CITY');
      }
    }
    const nearbyZoneIds: string[] = body.nearbyZoneIds === undefined ? before.nearbyZoneIds : Array.from(new Set<string>((Array.isArray(body.nearbyZoneIds) ? body.nearbyZoneIds : []).map((value: any) => String(value))));
    if (nearbyZoneIds.includes(id)) throw new BadRequestException('SERVICE_ZONE_CANNOT_NEIGHBOUR_ITSELF');
    const linked = nearbyZoneIds.length ? await this.prisma.serviceZone.findMany({ where: { id: { in: nearbyZoneIds }, city: { equals: city, mode: 'insensitive' } }, select: { id: true } }) : [];
    if (linked.length !== nearbyZoneIds.length) throw new BadRequestException('SERVICE_ZONE_NEIGHBOURS_MUST_EXIST_IN_THE_SAME_CITY');
    const data: any = { name, city, zoneLevel, parentZoneId, nearbyZoneIds };
    if (body.boundary !== undefined) data.boundary = this.validateServiceZoneBoundary(body.boundary);
    if (body.serviceTypes !== undefined) data.serviceTypes = this.validateServiceZoneTypes(body.serviceTypes);
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') throw new BadRequestException('SERVICE_ZONE_ACTIVE_MUST_BE_BOOLEAN');
      data.active = body.active;
    }
    return this.prisma.$transaction(async tx => {
      const zone = await tx.serviceZone.update({ where: { id }, data });
      const changed = new Set<string>([...before.nearbyZoneIds, ...nearbyZoneIds]);
      for (const neighbourId of changed) {
        const neighbour = await tx.serviceZone.findUnique({ where: { id: neighbourId } });
        if (!neighbour) continue;
        const next = nearbyZoneIds.includes(neighbourId)
          ? [...new Set([...neighbour.nearbyZoneIds, id])]
          : neighbour.nearbyZoneIds.filter((value: string) => value !== id);
        if (JSON.stringify(next) !== JSON.stringify(neighbour.nearbyZoneIds)) {
          await tx.serviceZone.update({ where: { id: neighbourId }, data: { nearbyZoneIds: next } });
        }
      }
      await tx.auditLog.create({ data: { actorId: admin.sub, action: 'SERVICE_ZONE_UPDATED', entityType: 'ServiceZone', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(zone) } });
      return zone;
    });
  }

  // Staff
  @Roles('ADMIN', 'STAFF')
  @Get('staff')
  getStaff(@Query('month') month?: string) { return this.financialService.getStaff(month); }

  @Roles('ADMIN')
  @Post('staff')
  createStaff(@CurrentUser() admin: JwtPayload, @Body() body: { name: string; role: string; accessRole?: string; phone: string; email?: string; password: string; salary: number; department?: string; employmentType?: string }) {
    return this.financialService.createStaff(body, admin.sub);
  }

  @Roles('ADMIN')
  @Patch('staff/:id')
  updateStaff(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: any) {
    return this.financialService.updateStaff(id, body, admin.sub);
  }

  @Roles('ADMIN')
  @Get('security/staff')
  getStaffSecurity() { return this.adminService.getStaffSecurity(); }

  @Roles('ADMIN')
  @Get('system-health')
  getSystemHealth() { return this.adminService.getSystemHealth(); }

  @Roles('ADMIN', 'STAFF')
  @Get('financial/reconciliation')
  getFinancialReconciliation() { return this.adminService.getFinancialReconciliation(); }

  @Roles('ADMIN', 'STAFF')
  @Get('audit')
  getAudit(@Query('limit') limit?: string, @Query('action') action?: string, @Query('entityType') entityType?: string) {
    return this.adminService.getAuditLog(Number(limit) || 100, action, entityType);
  }

  @Roles('ADMIN', 'STAFF')
  @Get('payroll/run')
  getPayrollRun(@Query('month') month: string) { return this.financialService.getPayrollRun(month); }

  @Roles('ADMIN')
  @Post('payroll/run')
  createPayrollRun(@CurrentUser() admin: JwtPayload, @Body() body: { month: string; adjustments?: any[] }) {
    return this.financialService.createPayrollRun(body.month, body.adjustments || [], admin.sub);
  }

  @Roles('ADMIN')
  @Post('payroll/run/:id/discard-draft')
  discardDraftPayrollRun(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.financialService.discardDraftPayrollRun(id, body.reason, admin.sub);
  }

  @Roles('ADMIN')
  @Post('payroll/run/:id/approve')
  approvePayrollRun(@CurrentUser() admin: JwtPayload, @Param('id') id: string) {
    return this.financialService.approvePayrollRun(id, admin.sub);
  }

  @Roles('ADMIN')
  @Post('payroll/lines/:id/payment')
  recordPayrollLinePayment(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { amount: number; paymentReference: string; paymentMethod: string }) {
    return this.financialService.recordPayrollPayment(id, Number(body.amount), body.paymentReference, body.paymentMethod, admin.sub);
  }

  @Roles('ADMIN', 'STAFF')
  @Get('payroll/preview')
  payrollPreview(@Query('month') month: string) { return this.financialService.getPayrollPreview(month); }

  // Salary payments
  @Roles('ADMIN', 'STAFF')
  @Get('salary-payments')
  getSalaryPayments(@Query('month') month?: string) {
    return this.financialService.getSalaryPayments(month);
  }

  @Roles('ADMIN')
  @Post('salary-payments')
  recordPayment(@CurrentUser() admin: JwtPayload, @Body() body: { staffMemberId: string; month: string; amount?: number; note?: string; paymentReference?: string; paymentMethod?: string }) {
    return this.financialService.recordSalaryPayment(body.staffMemberId, body.month, body.amount, body.note, body.paymentReference, body.paymentMethod, admin.sub);
  }

  // Salary advances: issue/cancel is administrator-only; payroll recovers approved schedules automatically.
  @Roles('ADMIN', 'STAFF')
  @Get('payroll/advances')
  listSalaryAdvances(@Query('staffMemberId') staffMemberId?: string) { return this.financeExtensions.listAdvances(staffMemberId); }

  @Roles('ADMIN')
  @Post('payroll/advances')
  issueSalaryAdvance(@CurrentUser() admin: JwtPayload, @Body() body: any) { return this.financeExtensions.issueAdvance(admin.sub, body); }

  @Roles('ADMIN')
  @Post('payroll/advances/:id/approve')
  approveSalaryAdvance(@CurrentUser() admin: JwtPayload, @Param('id') id: string) { return this.financeExtensions.approveAdvance(admin.sub, id); }

  @Roles('ADMIN')
  @Post('payroll/advances/:id/payment')
  paySalaryAdvance(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: any) { return this.financeExtensions.payAdvance(admin.sub, id, body); }

  @Roles('ADMIN')
  @Post('payroll/advances/:id/cancel')
  cancelSalaryAdvance(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { reason: string }) { return this.financeExtensions.cancelAdvance(admin.sub, id, body.reason); }

  // Contractor invoices: withholding rate is explicitly entered and must be verified by Finance/accountant.
  @Roles('ADMIN', 'STAFF')
  @Get('contractor-invoices')
  listContractorInvoices(@Query('status') status?: string) { return this.financeExtensions.listContractorInvoices(status); }

  @Roles('ADMIN')
  @Post('contractor-invoices')
  createContractorInvoice(@CurrentUser() admin: JwtPayload, @Body() body: any) { return this.financeExtensions.createContractorInvoice(admin.sub, body); }

  @Roles('ADMIN')
  @Post('contractor-invoices/:id/approve')
  approveContractorInvoice(@CurrentUser() admin: JwtPayload, @Param('id') id: string) { return this.financeExtensions.reviewContractorInvoice(admin.sub, id, true); }

  @Roles('ADMIN')
  @Post('contractor-invoices/:id/reject')
  rejectContractorInvoice(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { reason: string }) { return this.financeExtensions.reviewContractorInvoice(admin.sub, id, false, body.reason); }

  @Roles('ADMIN')
  @Post('contractor-invoices/:id/payment')
  payContractorInvoice(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: any) { return this.financeExtensions.payContractorInvoice(admin.sub, id, body); }

  // Statutory remittances are calculated from approved payroll snapshots, then approved and marked paid separately.
  @Roles('ADMIN', 'STAFF')
  @Get('statutory-remittances')
  listStatutoryRemittances(@Query('period') period?: string) { return this.financeExtensions.listRemittances(period); }

  @Roles('ADMIN')
  @Post('statutory-remittances/generate')
  generateStatutoryRemittances(@CurrentUser() admin: JwtPayload, @Body() body: { period: string }) { return this.financeExtensions.generatePayrollRemittances(admin.sub, body.period); }

  @Roles('ADMIN')
  @Patch('statutory-remittances/:id')
  updateStatutoryRemittance(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: any) { return this.financeExtensions.updateRemittanceDraft(admin.sub, id, body); }

  @Roles('ADMIN')
  @Post('statutory-remittances/:id/verify')
  verifyStatutoryRemittance(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { verificationNote: string }) { return this.financeExtensions.verifyRemittance(admin.sub, id, body.verificationNote); }

  @Roles('ADMIN')
  @Post('statutory-remittances/:id/approve')
  approveStatutoryRemittance(@CurrentUser() admin: JwtPayload, @Param('id') id: string) { return this.financeExtensions.approveRemittance(admin.sub, id); }

  @Roles('ADMIN')
  @Post('statutory-remittances/:id/payment')
  payStatutoryRemittance(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: any) { return this.financeExtensions.payRemittance(admin.sub, id, body); }

  // Users
  @Get('users')
  getUsers(@Query('role') role?: UserRole, @Query('status') status?: UserStatus, @Query('search') search?: string) {
    // A defensive backend shouldn't crash from a malformed query param
    // regardless of what any frontend sends — this genuinely happened
    // when a client library stringified an omitted filter as the
    // literal text "undefined" rather than leaving it out, and Prisma
    // correctly rejected that as an invalid enum value.
    const clean = (v?: string) => (v && v !== 'undefined' ? v : undefined);
    return this.adminService.getUsers(clean(role) as UserRole, clean(status) as UserStatus, clean(search));
  }

  @Roles('ADMIN')
  @Patch('users/:id/status')
  updateUserStatus(@Param('id') id: string, @Body() body: { status: UserStatus }) {
    return this.adminService.updateUserStatus(id, body.status);
  }

  @Roles('ADMIN')
  @Post('users/:id/reset-password')
  resetUserPassword(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.adminService.adminResetUserPassword(admin.sub, id, body.newPassword);
  }

  @Get('users/:id/detail')
  userDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  // Drivers — moved to DriversController's AdminDriversController
  // (/admin/drivers) to remove a duplicate route registration; that
  // controller also owns document review, so it is the natural single
  // owner of admin driver management.

  // Merchants
  @Get('merchants')
  getMerchants(@Query('status') status?: MerchantStatus) {
    return this.adminService.getMerchants(status);
  }

  @Get('merchants/:id/detail')
  merchantDetail(@Param('id') id: string) {
    return this.adminService.getMerchantDetail(id);
  }

  @Roles('ADMIN')
  @Patch('merchants/:id/approve')
  approveMerchant(@Param('id') id: string) { return this.adminService.approveMerchant(id); }

  @Roles('ADMIN')
  @Patch('merchants/:id/suspend')
  suspendMerchant(@Param('id') id: string) { return this.adminService.suspendMerchant(id); }

  // Media library — all currently referenced images uploaded through Zana storage.
  @Get('media')
  getMediaLibrary() { return this.adminService.getMediaLibrary(); }

  // Products
  @Get('products')
  getProducts(@Query('status') status?: ProductStatus) {
    return this.adminService.getProducts(status);
  }

  @Roles('ADMIN')
  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.adminService.deleteProduct(id);
  }

  @Roles('ADMIN')
  @Patch('products/:id/review')
  reviewProduct(@Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED'; adminNote?: string }) {
    return this.adminService.reviewProduct(id, body.status, body.adminNote);
  }

  // Trips & Deliveries
  @Get('trips')
  getTrips() { return this.adminService.getTrips(); }

  @Get('deliveries')
  getDeliveries() { return this.adminService.getDeliveries(); }

  // Orders
  @Get('orders')
  getOrders() { return this.adminService.getOrders(); }

  @Get('orders/:id/detail')
  orderDetail(@Param('id') id: string) { return this.adminService.getOrderDetail(id); }

  // Markets
  @Get('markets')
  getMarkets() { return this.adminService.getMarkets(); }

  @Get('markets/:id/dashboard')
  marketDashboard(@Param('id') id: string) { return this.adminService.getMarketDashboard(id); }

  @Roles('ADMIN')
  @Post('markets')
  createMarket(@Body() body: { name: string; description?: string; address: string; lat: number; lng: number; pickupContactName?: string; pickupPhone: string }) {
    return this.adminService.createMarket(body);
  }

  @Roles('ADMIN')
  @Patch('markets/:id')
  updateMarket(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateMarket(id, body);
  }

  @Roles('ADMIN')
  @Delete('markets/:id')
  deactivateMarket(@Param('id') id: string) {
    return this.adminService.deactivateMarket(id);
  }

  @Roles('ADMIN')
  @Post('markets/:id/products')
  addMarketProduct(
    @Param('id') id: string,
    @Body() body: { name: string; description?: string; referenceCost: number; imageBase64?: string; stock?: number; available?: boolean },
  ) {
    return this.adminService.addMarketProduct(id, body);
  }

  @Roles('ADMIN')
  @Patch('markets/:marketId/products/:productId')
  updateMarketProduct(
    @Param('marketId') marketId: string,
    @Param('productId') productId: string,
    @Body() body: { name?: string; description?: string; referenceCost?: number; imageBase64?: string; stock?: number; available?: boolean },
  ) {
    return this.adminService.updateMarketProduct(marketId, productId, body);
  }

  @Roles('ADMIN')
  @Delete('markets/:marketId/products/:productId')
  disableMarketProduct(
    @Param('marketId') marketId: string,
    @Param('productId') productId: string,
  ) {
    return this.adminService.disableMarketProduct(marketId, productId);
  }


  // Agents
  @Get('agents')
  getAgents() { return this.adminService.getAgents(); }

  @Get('agents/:id/detail')
  agentDetail(@Param('id') id: string) { return this.adminService.getAgentDetail(id); }

  @Roles('ADMIN')
  @Post('agents')
  createAgent(@Body() body: any) { return this.adminService.createAgent(body); }

  @Roles('ADMIN')
  @Patch('agents/:id/assign-market')
  assignAgent(@Param('id') id: string, @Body() body: { marketId: string }) {
    return this.adminService.assignAgentToMarket(id, body.marketId);
  }

  @Roles('ADMIN')
  @Patch('agents/:id/toggle')
  toggleAgent(@Param('id') id: string, @Body() body: { active: boolean }) {
    return this.adminService.toggleAgent(id, body.active);
  }

  // Centralised policy settings used by the admin Settings page.
  @Roles('ADMIN')
  @Get('settings/marketplace')
  async getMarketplaceSettings() {
    const config = await this.prisma.marketPriceConfig.findFirst();
    return config ?? this.prisma.marketPriceConfig.create({ data: {} });
  }

  @Roles('ADMIN')
  @Patch('settings/marketplace')
  async updateMarketplaceSettings(
    @CurrentUser() user: JwtPayload,
    @Body() body: { autoApprovePercent?: number; hardRejectPercent?: number; markupPercent?: number; agentEarningRate?: number; zanaMarkupShare?: number; agentMarkupShare?: number },
  ) {
    const current = await this.prisma.marketPriceConfig.findFirst() ?? await this.prisma.marketPriceConfig.create({ data: {} });
    const next = {
      autoApprovePercent: body.autoApprovePercent ?? current.autoApprovePercent,
      hardRejectPercent: body.hardRejectPercent ?? current.hardRejectPercent,
      markupPercent: body.markupPercent ?? current.markupPercent,
      agentEarningRate: body.agentEarningRate ?? current.agentEarningRate,
      agentMarkupShare: body.agentMarkupShare ?? current.agentMarkupShare,
      zanaMarkupShare: body.zanaMarkupShare ?? current.zanaMarkupShare,
    };
    for (const [key, value] of Object.entries(next)) {
      if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100) throw new BadRequestException('INVALID_MARKETPLACE_SETTING:' + key);
    }
    if (Math.abs(Number(next.agentMarkupShare) + Number(next.zanaMarkupShare) - 100) > 0.001) throw new BadRequestException('MARKUP_SPLIT_MUST_EQUAL_100');
    const updated = await this.prisma.marketPriceConfig.update({ where: { id: current.id }, data: next });
    await this.prisma.auditLog.create({ data: { actorId: user.sub, action: 'MARKETPLACE_SETTINGS_UPDATED', entityType: 'MarketPriceConfig', entityId: updated.id, beforeJson: JSON.stringify(current), afterJson: JSON.stringify(updated) } });
    return updated;
  }

  // Fares
  @Roles('ADMIN')
  @Get('fares')
  getFares() { return this.adminService.getFares(); }

  @Roles('ADMIN')
  @Patch('fares/:serviceType')
  updateFare(
    @CurrentUser() user: JwtPayload,
    @Param('serviceType') serviceType: string,
    @Body() body: any,
  ) {
    return this.adminService.updateFare(serviceType, body, user.sub);
  }

  // Live-testing only — see setDriverTestLocation in admin.service.ts
  // for what this actually does and why it's safe by default.
  @Roles('ADMIN')
  @Patch('drivers/:id/test-location')
  setDriverTestLocation(@Param('id') id: string, @Body() body: { lat: number | null; lng: number | null }) {
    return this.adminService.setDriverTestLocation(id, body.lat, body.lng);
  }

  @Roles('ADMIN')
  @Get('drivers/test-locations')
  listDriverTestLocations() {
    return this.adminService.listDriverTestLocations();
  }

  // DANGEROUS — see scatterAllDriverTestLocations in admin.service.ts.
  @Roles('ADMIN')
  @Post('drivers/test-locations/scatter')
  scatterAllDriverTestLocations(@Body() body: { centerLat: number; centerLng: number; radiusMeters?: number }) {
    return this.adminService.scatterAllDriverTestLocations(body.centerLat, body.centerLng, body.radiusMeters);
  }

  @Roles('ADMIN')
  @Post('drivers/test-locations/clear-all')
  clearAllDriverTestLocations() {
    return this.adminService.clearAllDriverTestLocations();
  }

  // ---- Same set of endpoints, for customer accounts ----

  @Roles('ADMIN')
  @Patch('customers/:id/test-location')
  setCustomerTestLocation(@Param('id') id: string, @Body() body: { lat: number | null; lng: number | null }) {
    return this.adminService.setCustomerTestLocation(id, body.lat, body.lng);
  }

  @Roles('ADMIN')
  @Get('customers/test-locations')
  listCustomerTestLocations() {
    return this.adminService.listCustomerTestLocations();
  }

  // DANGEROUS
  @Roles('ADMIN')
  @Post('customers/test-locations/scatter')
  scatterAllCustomerTestLocations(@Body() body: { centerLat: number; centerLng: number; radiusMeters?: number }) {
    return this.adminService.scatterAllCustomerTestLocations(body.centerLat, body.centerLng, body.radiusMeters);
  }

  @Roles('ADMIN')
  @Post('customers/test-locations/clear-all')
  clearAllCustomerTestLocations() {
    return this.adminService.clearAllCustomerTestLocations();
  }

  // "Destroy the session" — clears every driver AND customer test
  // location in one call, once a live test has wrapped up.
  @Roles('ADMIN')
  @Post('test-locations/clear-all')
  clearAllTestLocations() {
    return this.adminService.clearAllTestLocations();
  }

  @Roles('ADMIN')
  @Post('merchant-invites')
  generateInvite(@CurrentUser() user: JwtPayload) {
    return this.adminService.generateMerchantInvite(user.sub);
  }

  @Roles('ADMIN')
  @Get('merchant-invites')
  getInvites() {
    return this.adminService.getMerchantInvites();
  }


  @Roles('ADMIN')
  @Get('settings/payments/paypack')
  async getPaypackSettings() {
    try { return await this.paypackService.getPublicSettings(); }
    catch { return { enabled: false, configured: false, provider: 'PAYPACK', environment: 'production', baseUrl: 'https://payments.paypack.rw/api', mobileMoney: ['mtn', 'airtel'], cashin: true, cashout: true, webhookConfigured: false }; }
  }

  @Post('settings/payments/paypack/test')
  async testPaypack(@CurrentUser() user: JwtPayload) {
    const result = await this.paypackService.testConnection();
    await this.prisma.auditLog.create({ data: { actorId: user.sub, action: 'PAYPACK_CONNECTION_TESTED', entityType: 'PAYMENT_SETTINGS', entityId: 'PAYPACK', afterJson: JSON.stringify({ ok: true, at: new Date().toISOString(), environment: result.environment }) } });
    return result;
  }

  @Get('settings/ai')
  async getAiSettings() {
    const providers = ['gemini', 'groq', 'openrouter'] as const;
    const defaults: Record<string, string> = { gemini: 'gemini-3.8-flash', groq: 'openai/gpt-oss-120b', openrouter: 'openrouter/free' };
    const rows = await this.prisma.auditLog.findMany({ where: { entityType: 'AI_SETTINGS', action: 'ZANA_AI_PROVIDER_UPDATED' }, orderBy: { createdAt: 'desc' } });
    const byProvider: any = {};
    for (const provider of providers) {
      let row: any = rows.find(r => r.entityId === provider.toUpperCase());
      if (!row && provider === 'gemini') row = await this.prisma.auditLog.findFirst({ where: { entityType: 'AI_SETTINGS', entityId: 'GEMINI', action: 'ZANA_AI_SETTINGS_UPDATED' }, orderBy: { createdAt: 'desc' } });
      const data = row?.afterJson ? JSON.parse(row.afterJson) : {};
      byProvider[provider] = { enabled: Boolean(data.enabled), model: data.model || defaults[provider], configured: Boolean(data.apiKeyEncrypted), apiKeyHint: data.apiKeyHint || null, features: data.features || { customerChat: true, rideBooking: true, foodOrdering: true, marketShopping: true, deliveryBooking: true, placeDiscovery: true }, updatedAt: row?.createdAt || null };
    }
    const primaryRow = await this.prisma.auditLog.findFirst({ where: { entityType: 'AI_SETTINGS', entityId: 'PRIMARY', action: 'ZANA_AI_PRIMARY_UPDATED' }, orderBy: { createdAt: 'desc' } });
    const primary = primaryRow?.afterJson ? JSON.parse(primaryRow.afterJson)?.provider : 'gemini';
    return { enabled: Object.values(byProvider).some((x: any) => x.enabled && x.configured), provider: primary, providers: byProvider, model: byProvider[primary]?.model, configured: byProvider[primary]?.configured, apiKeyHint: byProvider[primary]?.apiKeyHint, features: byProvider[primary]?.features, updatedAt: primaryRow?.createdAt || null };
  }

  @Roles('ADMIN')
  @Patch('settings/ai')
  async saveAiSettings(@CurrentUser() user: JwtPayload, @Body() body: {
    provider?: 'gemini' | 'groq' | 'openrouter'; enabled?: boolean; model?: string; apiKey?: string; clearApiKey?: boolean; features?: Record<string, boolean>;
  }) {
    const provider = body.provider || 'gemini';
    const defaults: Record<string, string> = { gemini: 'gemini-3.8-flash', groq: 'openai/gpt-oss-120b', openrouter: 'openrouter/free' };
    const master = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!master) throw new BadRequestException('SETTINGS_ENCRYPTION_KEY_NOT_CONFIGURED');
    const key = createHash('sha256').update(master).digest();
    const encrypt = (value: string) => { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return iv.toString('hex') + ':' + cipher.getAuthTag().toString('hex') + ':' + ciphertext.toString('hex'); };
    const previous = await this.prisma.auditLog.findFirst({ where: { entityType: 'AI_SETTINGS', entityId: provider.toUpperCase(), action: 'ZANA_AI_PROVIDER_UPDATED' }, orderBy: { createdAt: 'desc' } });
    const old = previous?.afterJson ? JSON.parse(previous.afterJson) : {};
    const defaultFeatures = { customerChat: true, rideBooking: true, foodOrdering: true, marketShopping: true, deliveryBooking: true, placeDiscovery: true };
    const features = { ...defaultFeatures, ...(old.features || {}), ...(body.features || {}) };
    const model = String(body.model || old.model || defaults[provider]).trim();
    if (!model) throw new BadRequestException('INVALID_AI_MODEL');
    const keyChanged = Boolean(body.apiKey?.trim());
    const record = { enabled: body.enabled ?? old.enabled ?? false, provider, model, apiKeyEncrypted: body.clearApiKey ? null : (keyChanged ? encrypt(body.apiKey!.trim()) : old.apiKeyEncrypted || null), apiKeyHint: body.clearApiKey ? null : (keyChanged ? body.apiKey!.trim().slice(0, 8) + '…' + body.apiKey!.trim().slice(-4) : old.apiKeyHint || null), features };
    const updated = await this.prisma.auditLog.create({ data: { actorId: user.sub, action: 'ZANA_AI_PROVIDER_UPDATED', entityType: 'AI_SETTINGS', entityId: provider.toUpperCase(), afterJson: JSON.stringify(record) } });
    if (body.enabled !== undefined) await this.prisma.auditLog.create({ data: { actorId: user.sub, action: 'ZANA_AI_PRIMARY_UPDATED', entityType: 'AI_SETTINGS', entityId: 'PRIMARY', afterJson: JSON.stringify({ provider }) } });
    return { saved: true, provider, enabled: record.enabled, model: record.model, configured: Boolean(record.apiKeyEncrypted), apiKeyHint: record.apiKeyHint, features: record.features, updatedAt: updated.createdAt };
  }

  @Roles('ADMIN')
  @Post('settings/ai/test')
  async testAiConnection(@CurrentUser() user: JwtPayload) {
    const result = await this.zanaAiService.testConnection();
    await this.prisma.auditLog.create({ data: { actorId: user.sub, action: 'ZANA_AI_CONNECTION_TESTED', entityType: 'AI_SETTINGS', entityId: 'PRIMARY', afterJson: JSON.stringify({ ok: true, provider: result.provider, model: result.model, at: new Date().toISOString() }) } });
    return result;
  }

}