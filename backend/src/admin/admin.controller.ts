import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AdminService } from './admin.service';
import { CommissionService } from './commission.service';
import { FinancialService } from './financial.service';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EversendService } from '../wallet/eversend.service';
import { UserRole, UserStatus, DriverApprovalStatus, MerchantStatus, ProductStatus } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private commissionService: CommissionService,
    private financialService: FinancialService,
    private prisma: PrismaService,
    private eversendService: EversendService,
  ) {}

  @Get('overview')
  overview() { return this.adminService.getOverview(); }

  @Get('search')
  search(@Query('q') q: string) { return this.adminService.globalSearch(q ?? ''); }

  @Post('notifications')
  sendNotification(@Body() body: { audience: string; channel: string; targetId?: string; title?: string; message: string }) {
    return this.adminService.sendNotification(body);
  }

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
  @Get('accounting/ledger')
  accountingLedger(@Query('limit') limit?: string) {
    return this.financialService.getAccountingLedger(limit ? Number(limit) : 500);
  }

  // Financial snapshot
  @Get('financial')
  financial() { return this.financialService.getFinancialSnapshot(); }

  // Driver settlement monitor — reads the same existing ledger, not a
  // separate financial system.
  @Get('settlements/overview')
  settlementOverview() { return this.financialService.getSettlementOverview(); }

  @Get('settlements/drivers')
  driverSettlements() { return this.financialService.getDriverSettlements(); }

  // Commissions
  @Get('commissions')
  commissions() { return this.commissionService.getAll(); }

  @Get('commissions/summary')
  commissionSummary() { return this.commissionService.getSummary(); }

  // Expenses
  @Get('expenses')
  getExpenses() { return this.financialService.getExpenses(); }

  @Post('expenses')
  createExpense(@Body() body: { title: string; amount: number; category: string; description?: string }) {
    return this.financialService.createExpense(body);
  }

  @Delete('expenses/:id')
  deleteExpense(@Param('id') id: string) { return this.financialService.deleteExpense(id); }

  // Staff
  @Get('staff')
  getStaff() { return this.financialService.getStaff(); }

  @Post('staff')
  createStaff(@Body() body: { name: string; role: string; phone?: string; email?: string; salary: number }) {
    return this.financialService.createStaff(body);
  }

  @Patch('staff/:id')
  updateStaff(@Param('id') id: string, @Body() body: any) {
    return this.financialService.updateStaff(id, body);
  }

  // Salary payments
  @Get('salary-payments')
  getSalaryPayments(@Query('month') month?: string) {
    return this.financialService.getSalaryPayments(month);
  }

  @Post('salary-payments')
  recordPayment(@Body() body: { staffMemberId: string; month: string; amount?: number; note?: string }) {
    return this.financialService.recordSalaryPayment(body.staffMemberId, body.month, body.amount, body.note);
  }

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

  @Patch('users/:id/status')
  updateUserStatus(@Param('id') id: string, @Body() body: { status: UserStatus }) {
    return this.adminService.updateUserStatus(id, body.status);
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

  @Patch('merchants/:id/approve')
  approveMerchant(@Param('id') id: string) { return this.adminService.approveMerchant(id); }

  @Patch('merchants/:id/suspend')
  suspendMerchant(@Param('id') id: string) { return this.adminService.suspendMerchant(id); }

  // Products
  @Get('products')
  getProducts(@Query('status') status?: ProductStatus) {
    return this.adminService.getProducts(status);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.adminService.deleteProduct(id);
  }

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

  @Post('markets')
  createMarket(@Body() body: { name: string; description?: string; address: string; lat: number; lng: number; pickupContactName?: string; pickupPhone: string }) {
    return this.adminService.createMarket(body);
  }

  @Patch('markets/:id')
  updateMarket(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateMarket(id, body);
  }

  @Delete('markets/:id')
  deactivateMarket(@Param('id') id: string) {
    return this.adminService.deactivateMarket(id);
  }

  @Post('markets/:id/products')
  addMarketProduct(
    @Param('id') id: string,
    @Body() body: { name: string; description?: string; referenceCost: number; imageBase64?: string; stock?: number; available?: boolean },
  ) {
    return this.adminService.addMarketProduct(id, body);
  }

  @Patch('markets/:marketId/products/:productId')
  updateMarketProduct(
    @Param('marketId') marketId: string,
    @Param('productId') productId: string,
    @Body() body: { name?: string; description?: string; referenceCost?: number; imageBase64?: string; stock?: number; available?: boolean },
  ) {
    return this.adminService.updateMarketProduct(marketId, productId, body);
  }

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

  @Post('agents')
  createAgent(@Body() body: any) { return this.adminService.createAgent(body); }

  @Patch('agents/:id/assign-market')
  assignAgent(@Param('id') id: string, @Body() body: { marketId: string }) {
    return this.adminService.assignAgentToMarket(id, body.marketId);
  }

  @Patch('agents/:id/toggle')
  toggleAgent(@Param('id') id: string, @Body() body: { active: boolean }) {
    return this.adminService.toggleAgent(id, body.active);
  }

  // Centralised policy settings used by the admin Settings page.
  @Get('settings/marketplace')
  async getMarketplaceSettings() {
    const config = await this.prisma.marketPriceConfig.findFirst();
    return config ?? this.prisma.marketPriceConfig.create({ data: {} });
  }

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
  @Get('fares')
  getFares() { return this.adminService.getFares(); }

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
  @Patch('drivers/:id/test-location')
  setDriverTestLocation(@Param('id') id: string, @Body() body: { lat: number | null; lng: number | null }) {
    return this.adminService.setDriverTestLocation(id, body.lat, body.lng);
  }

  @Get('drivers/test-locations')
  listDriverTestLocations() {
    return this.adminService.listDriverTestLocations();
  }

  // DANGEROUS — see scatterAllDriverTestLocations in admin.service.ts.
  @Post('drivers/test-locations/scatter')
  scatterAllDriverTestLocations(@Body() body: { centerLat: number; centerLng: number; radiusMeters?: number }) {
    return this.adminService.scatterAllDriverTestLocations(body.centerLat, body.centerLng, body.radiusMeters);
  }

  @Post('drivers/test-locations/clear-all')
  clearAllDriverTestLocations() {
    return this.adminService.clearAllDriverTestLocations();
  }

  // ---- Same set of endpoints, for customer accounts ----

  @Patch('customers/:id/test-location')
  setCustomerTestLocation(@Param('id') id: string, @Body() body: { lat: number | null; lng: number | null }) {
    return this.adminService.setCustomerTestLocation(id, body.lat, body.lng);
  }

  @Get('customers/test-locations')
  listCustomerTestLocations() {
    return this.adminService.listCustomerTestLocations();
  }

  // DANGEROUS
  @Post('customers/test-locations/scatter')
  scatterAllCustomerTestLocations(@Body() body: { centerLat: number; centerLng: number; radiusMeters?: number }) {
    return this.adminService.scatterAllCustomerTestLocations(body.centerLat, body.centerLng, body.radiusMeters);
  }

  @Post('customers/test-locations/clear-all')
  clearAllCustomerTestLocations() {
    return this.adminService.clearAllCustomerTestLocations();
  }

  // "Destroy the session" — clears every driver AND customer test
  // location in one call, once a live test has wrapped up.
  @Post('test-locations/clear-all')
  clearAllTestLocations() {
    return this.adminService.clearAllTestLocations();
  }

  @Post('merchant-invites')
  generateInvite(@CurrentUser() user: JwtPayload) {
    return this.adminService.generateMerchantInvite(user.sub);
  }

  @Get('merchant-invites')
  getInvites() {
    return this.adminService.getMerchantInvites();
  }


  @Get('settings/payments/eversend')
  async getEversendSettings() {
    const row = await this.prisma.auditLog.findFirst({
      where: { entityType: 'PAYMENT_SETTINGS', entityId: 'EVERSEND', action: 'EVERSEND_SETTINGS_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    if (!row?.afterJson) {
      return { enabled: false, environment: 'sandbox', baseUrl: 'https://api.eversend.co/v1', rail: 'mtn_momo', minWithdrawal: 1000, configured: false, webhookConfigured: false };
    }
    const data = JSON.parse(row.afterJson);
    return {
      enabled: Boolean(data.enabled),
      environment: data.environment === 'production' ? 'production' : 'sandbox',
      baseUrl: data.baseUrl || 'https://api.eversend.co/v1',
      rail: data.rail === 'airtel_money' ? 'airtel_money' : 'mtn_momo',
      minWithdrawal: Number(data.minWithdrawal || 1000),
      configured: Boolean(data.apiKeyEncrypted),
      apiKeyHint: data.apiKeyHint || null,
      webhookConfigured: Boolean(data.webhookSecretEncrypted),
    };
  }

  @Patch('settings/payments/eversend')
  async saveEversendSettings(
    @Body() body: { enabled?: boolean; environment?: 'sandbox'|'production'; apiKey?: string; webhookSecret?: string; baseUrl?: string; rail?: 'mtn_momo'|'airtel_money'; minWithdrawal?: number },
    @CurrentUser() user: JwtPayload,
  ) {
    const master = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!master) throw new BadRequestException('SETTINGS_ENCRYPTION_KEY_NOT_CONFIGURED');
    const key = createHash('sha256').update(master).digest();
    const encrypt = (value: string) => {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return iv.toString('hex') + ':' + cipher.getAuthTag().toString('hex') + ':' + ciphertext.toString('hex');
    };
    const previous = await this.prisma.auditLog.findFirst({
      where: { entityType: 'PAYMENT_SETTINGS', entityId: 'EVERSEND', action: 'EVERSEND_SETTINGS_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    const old = previous?.afterJson ? JSON.parse(previous.afterJson) : {};
    const keyChanged = Boolean(body.apiKey?.trim());
    const record = {
      enabled: body.enabled ?? old.enabled ?? false,
      environment: body.environment === 'production' ? 'production' : (old.environment === 'production' ? 'production' : 'sandbox'),
      apiKeyEncrypted: keyChanged ? encrypt(body.apiKey!.trim()) : old.apiKeyEncrypted || null,
      webhookSecretEncrypted: body.webhookSecret?.trim() ? encrypt(body.webhookSecret.trim()) : old.webhookSecretEncrypted || null,
      baseUrl: String(body.baseUrl || old.baseUrl || 'https://api.eversend.co/v1').replace(/\/$/, ''),
      rail: body.rail === 'airtel_money' ? 'airtel_money' : (old.rail === 'airtel_money' ? 'airtel_money' : 'mtn_momo'),
      minWithdrawal: Math.max(1000, Number(body.minWithdrawal || old.minWithdrawal || 1000)),
      apiKeyHint: keyChanged ? body.apiKey!.trim().slice(0, 8) + '…' + body.apiKey!.trim().slice(-4) : old.apiKeyHint || null,
    };
    await this.prisma.auditLog.create({
      data: { actorId: user.sub, action: 'EVERSEND_SETTINGS_UPDATED', entityType: 'PAYMENT_SETTINGS', entityId: 'EVERSEND', afterJson: JSON.stringify(record) },
    });
    return { saved: true, enabled: record.enabled, environment: record.environment, baseUrl: record.baseUrl, rail: record.rail, minWithdrawal: record.minWithdrawal, configured: Boolean(record.apiKeyEncrypted), apiKeyHint: record.apiKeyHint, webhookConfigured: Boolean(record.webhookSecretEncrypted) };
  }

  @Post('settings/payments/eversend/test')
  async testEversend(@CurrentUser() user: JwtPayload) {
    const result = await this.eversendService.testConnection();
    await this.prisma.auditLog.create({
      data: { actorId: user.sub, action: 'EVERSEND_CONNECTION_TESTED', entityType: 'PAYMENT_SETTINGS', entityId: 'EVERSEND', afterJson: JSON.stringify({ ok: true, at: new Date().toISOString() }) },
    });
    return result;
  }


}