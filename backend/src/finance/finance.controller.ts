import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { FinanceService } from './finance.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @Get('merchant/earnings')
  @Roles('MERCHANT')
  merchantEarnings(@CurrentUser() user: JwtPayload) { return this.finance.merchantSummary(user.sub); }

  @Get('agent/earnings')
  @Roles('AGENT')
  agentEarnings(@CurrentUser() user: JwtPayload) { return this.finance.agentSummary(user.sub); }

  @Get('admin/finance/merchants/:id')
  @Roles('ADMIN')
  adminMerchant(@Param('id') id: string) { return this.finance.adminMerchant(id); }

  @Get('admin/finance/agents/:id')
  @Roles('ADMIN')
  adminAgent(@Param('id') id: string) { return this.finance.adminAgent(id); }

  @Get('admin/market-price-config')
  @Roles('ADMIN')
  marketPriceConfig() { return this.finance.marketPriceConfig(); }

  @Get('admin/market-price-history')
  @Roles('ADMIN')
  priceHistory(@Query('productId') productId?: string) { return this.finance.priceHistory(productId); }

  @Get('admin/market-price-reviews')
  @Roles('ADMIN')
  pendingPriceChanges() { return this.finance.pendingPriceChanges(); }

  @Patch('admin/market-price-reviews/:id')
  @Roles('ADMIN')
  reviewPrice(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { approve: boolean; reason?: string }) {
    return this.finance.reviewMarketPrice(user.sub, id, body.approve, body.reason);
  }

  @Patch('admin/market-agent-rate')
  @Roles('ADMIN')
  setAgentRate(@CurrentUser() user: JwtPayload, @Body() body: { rate: number }) {
    return this.finance.setAgentRate(user.sub, body.rate);
  }

  @Get('admin/audit')
  @Roles('ADMIN')
  audit(@Query('limit') limit?: string) { return this.finance.auditLogs(limit ? Number(limit) : 200); }

  @Patch('agent/products/:id/price-request')
  @Roles('AGENT')
  requestPrice(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { price?: number; referenceCost?: number; reason?: string }) {
    return this.finance.requestMarketPriceChange(user.sub, id, body);
  }
}
