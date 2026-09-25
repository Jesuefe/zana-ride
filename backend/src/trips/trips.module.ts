import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { TripsController, RatingsController, DriverTripsController, AdminTripsController, FareController, PointsController, ScheduledRidesController, CustomerReportsController } from './trips.controller';
import { TripsService } from './trips.service';
import { RatingsService } from './ratings.service';
import { CommissionDebtService } from './commission-debt.service';
import { PaypackService } from '../wallet/paypack.service';
import { PointsService } from './points.service';
import { ScheduledRideService } from './scheduled.service';
import { CancellationService } from './cancellation.service';
import { FareService } from './fare.service';
import { DriversModule } from '../drivers/drivers.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [DriversModule, PrismaModule, GatewayModule],
  controllers: [
    TripsController,
    DriverTripsController,
    AdminTripsController,
    FareController,
    RatingsController,
    PointsController,
    ScheduledRidesController,
    CustomerReportsController,
  ],
  providers: [TripsService, RatingsService, CommissionDebtService, PaypackService, PointsService, ScheduledRideService, CancellationService, FareService],
  exports: [FareService, CommissionDebtService],
})
export class TripsModule {}
