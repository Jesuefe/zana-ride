import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { TripsService } from './trips.service';
import { DriversService } from '../drivers/drivers.service';
import { ServiceType, TripStatus } from '@prisma/client';

@Controller('rides')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(
    private tripsService: TripsService,
    private driversService: DriversService,
  ) {}

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
    },
  ) {
    return this.tripsService.create(user.sub, body);
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
  async cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    if (trip.customerId !== user.sub) {
      throw new ForbiddenException('This ride does not belong to you');
    }
    return this.tripsService.cancel(id, 'CUSTOMER');
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

  @Post(':id/decline')
  async decline(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const driver = await this.driversService.findByUserId(user.sub);
    const trip = await this.tripsService.findById(id);
    if (trip.driverId !== driver.id) {
      throw new ForbiddenException('This ride is not assigned to you');
    }
    return this.tripsService.cancel(id, 'DRIVER');
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
}
