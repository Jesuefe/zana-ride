import { Module } from '@nestjs/common';
import { StorageService } from '../deliveries/storage.service';
import { DriversController, AdminDriversController, PublicDriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  controllers: [DriversController, AdminDriversController, PublicDriversController],
  providers: [DriversService, StorageService],
  exports: [DriversService],
})
export class DriversModule {}
