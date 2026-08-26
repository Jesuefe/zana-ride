import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
  findOne(@Param('id') id: string) {
    return this.tripsService.findById(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
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
  arrive(@Param('id') id: string) {
    return this.tripsService.updateStatus(id, TripStatus.DRIVER_ARRIVED);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.tripsService.updateStatus(id, TripStatus.RIDE_IN_PROGRESS);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.tripsService.updateStatus(id, TripStatus.RIDE_COMPLETED);
  }

  @Post(':id/decline')
  decline(@Param('id') id: string) {
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
