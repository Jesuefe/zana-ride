import { Module } from '@nestjs/common';
import { TripsController, DriverTripsController, AdminTripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  imports: [DriversModule],
  controllers: [TripsController, DriverTripsController, AdminTripsController],
  providers: [TripsService],
})
export class TripsModule {}
