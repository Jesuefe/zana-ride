import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { OrdersService } from './orders.service';
import { MerchantService } from './merchant.service';
import { OrderStatus } from '@prisma/client';

// Public marketplace — no auth needed to browse.
@Controller('marketplace')
export class MarketplaceController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  browse(
    @Query('category') category?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.ordersService.getMarketplace(
      category,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }
}

// Customer-facing order endpoints.
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class CustomerOrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: any) {
    return this.ordersService.create(user.sub, body);
  }

  @Get()
  findMine(@CurrentUser() user: JwtPayload) {
    return this.ordersService.findForCustomer(user.sub);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    // Previously had no ownership check at all — any authenticated
    // customer could read any other customer's order (items, total,
    // phone number via the included customer relation) just by knowing
    // the order ID. Same missing-check pattern found on cancel below and
    // on the merchant status-update endpoint — none of the three had
    // ever verified the caller actually owned the order they were
    // touching.
    const order = await this.ordersService.findById(id);
    if (order.customerId !== user.sub) {
      throw new ForbiddenException('Not your order');
    }
    return order;
  }

  @Patch(':id/cancel')
  async cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const order = await this.ordersService.findById(id);
    if (order.customerId !== user.sub) {
      throw new ForbiddenException('Not your order');
    }
    return this.ordersService.cancelOrder(id);
  }

  @Get(':id/payment-status')
  async paymentStatus(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const order = await this.ordersService.findById(id);
    if (order.customerId !== user.sub) {
      throw new ForbiddenException('Not your order');
    }
    return this.ordersService.checkOrderPayment(id);
  }
}

@Controller('merchant/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MERCHANT')
export class MerchantOrdersController {
  constructor(
    private ordersService: OrdersService,
    private merchantService: MerchantService,
  ) {}

  @Get()
  async findMine(@CurrentUser() user: JwtPayload) {
    const merchant = await this.merchantService.findByUserId(user.sub);
    return this.ordersService.findForMerchant(merchant.id);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { status: OrderStatus },
  ) {
    // This was the original, explicitly-verified gap — any authenticated
    // merchant could change the status of any order at all, not just
    // their own, including triggering the automatic Delivery creation on
    // READY_FOR_PICKUP for an order they had no relationship to.
    const merchant = await this.merchantService.findByUserId(user.sub);
    const order = await this.ordersService.findById(id);
    if (order.merchantId !== merchant.id) {
      throw new ForbiddenException('Not your order');
    }
    return this.ordersService.updateStatus(id, body.status);
  }


  @Get('history')
  async history(@CurrentUser() user: JwtPayload) {
    const merchant = await this.merchantService.findByUserId(user.sub);
    return this.ordersService.merchantHistory(merchant.id);
  }

  @Get('stats')
  async stats(@CurrentUser() user: JwtPayload) {
    const merchant = await this.merchantService.findByUserId(user.sub);
    return this.ordersService.merchantStats(merchant.id);
  }
}

