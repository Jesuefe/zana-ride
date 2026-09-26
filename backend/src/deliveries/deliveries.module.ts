import { Module } from '@nestjs/common';
import { PaypackService } from '../wallet/paypack.service';
import { GatewayModule } from '../gateway/gateway.module';
import { TripsModule } from '../trips/trips.module';
import {
  DeliveriesController,
  MerchantDeliveriesController,
  AdminDeliveriesController,
  LocationCodesController,
  DriverDeliveriesController,
} from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { LocationCodeService } from './location-code.service';
import { StorageService } from './storage.service';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [GatewayModule, TripsModule, FinanceModule],
  controllers: [
    DeliveriesController,
    MerchantDeliveriesController,
    AdminDeliveriesController,
    LocationCodesController,
    DriverDeliveriesController,
  ],
  providers: [PaypackService, DeliveriesService, LocationCodeService, StorageService],
  exports: [DeliveriesService, LocationCodeService],
})
export class DeliveriesModule {}
