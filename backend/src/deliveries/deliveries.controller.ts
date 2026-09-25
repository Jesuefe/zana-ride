import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { DeliveriesService } from './deliveries.service';
import type { CreateDeliveryInput } from './deliveries.service';
import { LocationCodeService } from './location-code.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus, PackageWeight } from '@prisma/client';

@Controller('location-codes')
export class LocationCodesController {
  constructor(private locationCodes: LocationCodeService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: { lat: number; lng: number; address?: string; ttlMinutes?: number }) {
    return this.locationCodes.create(body);
  }

  @Get(':code')
  resolve(@Param('code') code: string) {
    return this.locationCodes.resolve(code);
  }
}

@Controller('deliveries')
@UseGuards(JwtAuthGuard)
export class DeliveriesController {
  constructor(
    private deliveriesService: DeliveriesService,
    private prisma: PrismaService,
  ) {}

  @Post('quote')
  quote(@Body() body: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number; weight: PackageWeight }) {
    return this.deliveriesService.quote(body.pickupLat, body.pickupLng, body.dropoffLat, body.dropoffLng, body.weight);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateDeliveryInput) {
    return this.deliveriesService.create(body, { customerId: user.sub });
  }

  @Get()
  findMine(@CurrentUser() user: JwtPayload) {
    return this.deliveriesService.findForCustomer(user.sub);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const delivery = await this.deliveriesService.findById(id);
    if (delivery.customerId !== user.sub) {
      throw new ForbiddenException('Not your delivery');
    }
    return delivery;
  }

  // Customer polls this right after creating a MOBILE_MONEY delivery —
  // same pattern already proven for wallet top-ups.
  @Get(':id/payment-status')
  checkPaymentStatus(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deliveriesService.checkDeliveryPaymentStatus(id, user.sub);
  }

  // Driver uploads proof-of-handling photos
  @Post(':id/photo/:stage')
  attachPhoto(
    @Param('id') id: string,
    @Param('stage') stage: 'pickup' | 'dropoff',
    @Body() body: { imageBase64: string },
  ) {
    return this.deliveriesService.attachPhoto(id, stage, body.imageBase64);
  }

  // Shared tracking lookup by code
  @Get('track/:code')
  track(@Param('code') code: string) {
    return this.deliveriesService.findByTrackingCode(code);
  }

  @Post('reviews')
  submitReview(
    @CurrentUser() user: JwtPayload,
    @Body() body: any,
  ) {
    return this.deliveriesService.submitReview(user.sub, body);
  }

  @Get('reviews/:target/:id')
  ratingSummary(
    @Param('target') target: 'MERCHANT' | 'MARKET',
    @Param('id') id: string,
  ) {
    return this.deliveriesService.ratingSummary(target, id);
  }
}

@Controller('merchant/deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MERCHANT')
export class MerchantDeliveriesController {
  constructor(
    private deliveriesService: DeliveriesService,
    private prisma: PrismaService,
  ) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() body: CreateDeliveryInput) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: user.sub } });
    if (!merchant) throw new Error('Merchant profile not found');
    return this.deliveriesService.create(body, { merchantId: merchant.id });
  }

  @Get()
  async findMine(@CurrentUser() user: JwtPayload) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: user.sub } });
    if (!merchant) return [];
    return this.deliveriesService.findForMerchant(merchant.id);
  }
}

@Controller('driver/deliveries')
@UseGuards(JwtAuthGuard)
export class DriverDeliveriesController {
  constructor(
    private deliveriesService: DeliveriesService,
    private prisma: PrismaService,
  ) {}

  @Get('pending')
  async pending(
    @CurrentUser() user: JwtPayload,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    if (!lat || !lng) return [];
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.sub } });
    return this.deliveriesService.findPendingForDriver(
      Number(lat), Number(lng), 10, driver?.id,
    );
  }

  @Post(':id/accept')
  async accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.sub } });
    if (!driver) throw new Error('Driver profile not found');
    return this.deliveriesService.acceptDelivery(id, driver.id);
  }

  // The one the rider should be working on right now
  @Get('active')
  async active(@CurrentUser() user: JwtPayload) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.sub } });
    if (!driver) return null;
    const all = await this.deliveriesService.activeForDriver(driver.id);
    return all[0] ?? null;
  }

  // Everything the rider is carrying, in route order
  @Get('active/all')
  async activeAll(@CurrentUser() user: JwtPayload) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.sub } });
    if (!driver) return [];
    return this.deliveriesService.activeForDriver(driver.id);
  }

  @Post(':id/pickup')
  async pickup(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deliveriesService.pickupDelivery(id, user.sub);
  }

  @Post(':id/complete')
  async complete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deliveriesService.completeDelivery(id, user.sub);
  }

  // The driver's own delivery record
  @Get('mine')
  async mine(@CurrentUser() user: JwtPayload) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.sub } });
    if (!driver) return [];
    return this.deliveriesService.findForDriver(driver.id);
  }

  @Get('stats')
  async stats(@CurrentUser() user: JwtPayload) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.sub } });
    if (!driver) {
      return { totalDeliveries: 0, totalEarned: 0, todayDeliveries: 0, todayEarned: 0, active: 0 };
    }
    return this.deliveriesService.driverDeliveryStats(driver.id);
  }

  // Rider pings position while carrying parcels
  @Post('position')
  async position(
    @CurrentUser() user: JwtPayload,
    @Body() body: { lat: number; lng: number },
  ) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: user.sub } });
    if (!driver) return { broadcast: 0 };
    return this.deliveriesService.broadcastDriverPosition(driver.id, body.lat, body.lng);
  }
}

@Controller('admin/deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDeliveriesController {
  constructor(private deliveriesService: DeliveriesService) {}

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: DeliveryStatus }) {
    return this.deliveriesService.updateStatus(id, body.status);
  }

  // Parcels nobody has accepted
  @Get('unassigned')
  unassigned() {
    return this.deliveriesService.unassignedDeliveries();
  }

  // Who could take this one
  @Get(':id/candidates')
  candidates(@Param('id') id: string) {
    return this.deliveriesService.driversNearDelivery(id);
  }

  // Send a specific rider to it
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: { driverId: string }) {
    return this.deliveriesService.assignDriver(id, body.driverId);
  }

  // Admin delivery KPIs — supports the standard presets, or an explicit
  // custom range. Defaults to today when nothing is specified.
  @Get('kpis')
  kpis(@Query('range') range?: string, @Query('from') fromQ?: string, @Query('to') toQ?: string) {
    const now = new Date();
    let from: Date, to: Date;

    if (fromQ && toQ) {
      from = new Date(fromQ);
      to = new Date(toQ);
    } else {
      const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

      switch (range) {
        case 'yesterday': {
          from = new Date(startOfToday); from.setDate(from.getDate() - 1);
          to = new Date(endOfToday); to.setDate(to.getDate() - 1);
          break;
        }
        case 'week': {
          from = new Date(startOfToday); from.setDate(from.getDate() - 6);
          to = endOfToday;
          break;
        }
        case 'month': {
          from = new Date(startOfToday); from.setDate(from.getDate() - 29);
          to = endOfToday;
          break;
        }
        default: {
          from = startOfToday;
          to = endOfToday;
        }
      }
    }

    return this.deliveriesService.getAdminKpis(from, to);
  }
}
