import { Module } from '@nestjs/common';
import { PurchaseFloatController } from './purchase-float.controller';
import { PurchaseFloatService } from './purchase-float.service';

@Module({
  controllers: [PurchaseFloatController],
  providers: [PurchaseFloatService],
  exports: [PurchaseFloatService],
})
export class PurchaseFloatModule {}
