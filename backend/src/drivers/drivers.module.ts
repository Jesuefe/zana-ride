import { Module } from '@nestjs/common';
import { StorageService } from '../deliveries/storage.service';
import { GatewayModule } from '../gateway/gateway.module';
import { DriversController, AdminDriversController, PublicDriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [GatewayModule],
  controllers: [DriversController, AdminDriversController, PublicDriversController],
  providers: [DriversService, StorageService],
  exports: [DriversService],
})
export class DriversModule {}
