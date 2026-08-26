import { Module } from '@nestjs/common';
import { DriversController, AdminDriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  controllers: [DriversController, AdminDriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
