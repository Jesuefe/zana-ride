import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { TripsService } from './trips.service';
import { PointsService } from './points.service';
import { ScheduledRideService } from './scheduled.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from './ratings.service';
import { FareService } from './fare.service';
import { DriversService } from '../drivers/drivers.service';
import { ServiceType, TripStatus } from '@prisma/client';

@Controller('rides')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(
    private tripsService: TripsService,
    private driversService: DriversService,
  ) {}

  @Get('history')
  myRides(@CurrentUser() user: JwtPayload) {
    return this.tripsService.findForCustomer(user.sub);
  }

  @Post('estimate')
  estimate(
    @Body()
    body: {
      serviceType: ServiceType;
      pickup: { lat: number; lng: number };
      destination: { lat: number; lng: number };
    },
  ) {
    return this.tripsService.estimate(body.pickup, body.destination, body.serviceType);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      serviceType: ServiceType;
      pickupAddress: string;
      pickupLat: number;
      pickupLng: number;
      destinationAddress: string;
      destinationLat: number;
      destinationLng: number;
      count?: number;
      paymentMethod?: string;
    },
  ) {
    const { count, ...tripData } = body;
    if (count && count > 1) {
      return this.tripsService.createGroup(user.sub, tripData, count);
    }
    return this.tripsService.create(user.sub, tripData);
  }

  @Get('group/:groupId')
  findGroup(@Param('groupId') groupId: string) {
    return this.tripsService.findByGroupId(groupId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    if (trip.customerId !== user.sub) {
      throw new ForbiddenException('This ride does not belong to you');
    }
    return trip;
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tripsService.cancel(id, 'CUSTOMER', user.sub);
  }

  @Post(':id/report')
  report(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason: string; details?: string },
  ) {
    return this.tripsService.report(id, user.sub, body.reason, body.details);
  }
}

@Controller('driver/rides')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
export class DriverTripsController {
  constructor(
    private tripsService: TripsService,
    private driversService: DriversService,
  ) {}

  @Get('searching')
  async searching(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.tripsService.findSearchingTrips(driver.serviceType);
  }

  @Get('offers')
  async myOffers(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.tripsService.findMyOffers(driver.id);
  }

  @Post('offers/:id/decline')
  async declineOffer(@CurrentUser() user: JwtPayload, @Param('id') offerId: string) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.tripsService.declineOffer(offerId, driver.id);
  }

  @Get('active')
  async active(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.tripsService.findActiveForDriver(driver.id);
  }

  @Post(':id/accept')
  async accept(@CurrentUser() user: JwtPayload, @Param('id') tripId: string) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.tripsService.assignDriver(tripId, driver.id);
  }

  @Post(':id/arrive')
  async arrive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const driver = await this.driversService.findByUserId(user.sub);
    const trip = await this.tripsService.findById(id);
    if (trip.driverId !== driver.id) {
      throw new ForbiddenException('This ride is not assigned to you');
    }
    return this.tripsService.updateStatus(id, TripStatus.DRIVER_ARRIVED);
  }

  @Post(':id/start')
  async start(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const driver = await this.driversService.findByUserId(user.sub);
    const trip = await this.tripsService.findById(id);
    if (trip.driverId !== driver.id) {
      throw new ForbiddenException('This ride is not assigned to you');
    }
    return this.tripsService.updateStatus(id, TripStatus.RIDE_IN_PROGRESS);
  }

  @Post(':id/complete')
  async complete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const driver = await this.driversService.findByUserId(user.sub);
    const trip = await this.tripsService.findById(id);
    if (trip.driverId !== driver.id) {
      throw new ForbiddenException('This ride is not assigned to you');
    }
    return this.tripsService.updateStatus(id, TripStatus.RIDE_COMPLETED);
  }

  // Driver triggers the MoMo prompt — phone can be corrected before sending
  @Post(':id/momo-charge')
  momoCharge(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { phone?: string },
  ) {
    return this.tripsService.chargeMomo(id, user.sub, body?.phone);
  }

  @Get(':id/momo-status')
  momoStatus(@Param('id') id: string) {
    return this.tripsService.checkMomoStatus(id);
  }

  @Post(':id/collect-cash')
  collectCashInstead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tripsService.collectCashInstead(id, user.sub);
  }

  @Post(':id/decline')
  decline(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.tripsService.cancel(id, 'DRIVER', user.sub, body?.reason);
  }
}

@Controller('admin/trips')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminTripsController {
  constructor(private tripsService: TripsService) {}

  @Get()
  findAll() {
    return this.tripsService.findAllForAdmin();
  }

  @Get('reports')
  listReports(@Query('status') status?: 'OPEN' | 'RESOLVED') {
    return this.tripsService.listReports(status);
  }

  @Patch('reports/:reportId/resolve')
  resolveReport(@CurrentUser() user: JwtPayload, @Param('reportId') reportId: string) {
    return this.tripsService.resolveReport(reportId, user.sub);
  }
}

// Fare rates are readable by anyone (the customer app needs them to show
// estimates) but only an admin can change them.
@Controller('fares')
export class FareController {
  constructor(private fareService: FareService) {}

  @Get()
  findAll() {
    return this.fareService.findAll();
  }

  @Patch(':serviceType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('serviceType') serviceType: ServiceType,
    @Body() body: { base?: number; perKm?: number; perMin?: number; bookingFee?: number; minimum?: number },
  ) {
    return this.fareService.update(serviceType, body);
  }
}

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private ratingsService: RatingsService) {}

  @Post('trip/:tripId')
  rate(
    @CurrentUser() user: JwtPayload,
    @Param('tripId') tripId: string,
    @Body() body: { score: number; comment?: string; raterRole: 'CUSTOMER' | 'DRIVER' },
  ) {
    return this.ratingsService.rateTrip({
      tripId,
      raterId: user.sub,
      raterRole: body.raterRole,
      score: body.score,
      comment: body.comment,
    });
  }

  @Get('pending')
  pending(@CurrentUser() user: JwtPayload) {
    return this.ratingsService.getPendingRating(user.sub);
  }

  @Get('driver/:driverId/stats')
  driverStats(@Param('driverId') driverId: string) {
    return this.ratingsService.getDriverStats(driverId);
  }
}

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private pointsService: PointsService) {}

  @Get('me')
  getBalance(@CurrentUser() user: JwtPayload) {
    return this.pointsService.getBalance(user.sub);
  }

  @Post('redeem')
  redeem(@CurrentUser() user: JwtPayload, @Body() body: { points: number }) {
    return this.pointsService.redeem(user.sub, body.points);
  }
}

@Controller('scheduled-rides')
@UseGuards(JwtAuthGuard)
export class ScheduledRidesController {
  constructor(private scheduledService: ScheduledRideService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: any) {
    return this.scheduledService.create(user.sub, { ...body, scheduledFor: new Date(body.scheduledFor) });
  }

  @Get('me')
  getMine(@CurrentUser() user: JwtPayload) {
    return this.scheduledService.getMyScheduled(user.sub);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.scheduledService.cancel(id, user.sub);
  }
}

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class CustomerReportsController {
  constructor(private prisma: PrismaService) {}

  @Post('customer')
  async reportCustomer(@CurrentUser() user: JwtPayload, @Body() body: { tripId: string; reason: string; details?: string }) {
    // Find the trip to get the customer ID
    const trip = await this.prisma.trip.findUnique({ where: { id: body.tripId } });
    if (!trip) throw new Error('Trip not found');
    return this.prisma.customerReport.create({
      data: {
        reporterId: user.sub,
        reportedId: trip.customerId,
        tripId: body.tripId,
        reason: body.reason,
        details: body.details,
      },
    });
  }
}
