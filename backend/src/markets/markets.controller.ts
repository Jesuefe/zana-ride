import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MarketsService } from './markets.service';
import { WalletService } from '../wallet/wallet.service';

// ── What customers see ───────────────────────────────────────────────────────
@Controller('markets')
@UseGuards(JwtAuthGuard)
export class MarketsController {
  constructor(private marketsService: MarketsService) {}

  @Get()
  list(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    return this.marketsService.listForCustomer(
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.marketsService.getMarketWithProducts(id);
  }
}

// ── What the agent working inside the market sees ────────────────────────────
@Controller('agent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AGENT')
export class AgentController {
  constructor(private marketsService: MarketsService, private walletService: WalletService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.marketsService.getMyMarket(user.sub);
  }

  // Previously didn't exist at all — agents had no earnings concept
  // anywhere, not even a placeholder in the UI. They do genuine
  // physical fulfillment work (shopping, packing) with no way to ever
  // see or withdraw what they've earned for it.
  @Get('wallet')
  wallet(@CurrentUser() user: JwtPayload) {
    return this.walletService.findByUserId(user.sub);
  }

  @Post('wallet/withdraw')
  withdrawWallet(@CurrentUser() user: JwtPayload, @Body() body: { amount: number }) {
    return this.walletService.withdraw(user.sub, body.amount);
  }

  @Get('products')
  products(@CurrentUser() user: JwtPayload) {
    return this.marketsService.getMyProducts(user.sub);
  }

  @Post('products')
  addProduct(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; description?: string; price: number; referenceCost?: number; imageBase64?: string; stock?: number },
  ) {
    return this.marketsService.addProduct(user.sub, body);
  }

  @Patch('products/:id')
  updateProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.marketsService.updateProduct(user.sub, id, body);
  }

  @Delete('products/:id')
  deleteProduct(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.marketsService.deleteProduct(user.sub, id);
  }

  @Get('orders')
  orders(@CurrentUser() user: JwtPayload) {
    return this.marketsService.getMyOrders(user.sub);
  }

  @Get('orders/:id')
  orderDetail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.marketsService.getMyOrderDetail(user.sub, id);
  }

  @Post('orders/:id/items/:itemId/unavailable')
  markItemUnavailable(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.marketsService.markItemUnavailable(user.sub, id, itemId);
  }

  @Get('deliveries')
  deliveries(@CurrentUser() user: JwtPayload) {
    return this.marketsService.getMyDeliveries(user.sub);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { status: string; actualPrices?: Record<string, number> },
  ) {
    return this.marketsService.updateOrderStatus(user.sub, id, body.status, body.actualPrices);
  }
}
