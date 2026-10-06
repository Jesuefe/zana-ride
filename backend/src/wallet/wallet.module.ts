import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { EversendService } from './eversend.service';
import { WooshPayService } from './wooshpay.service';
import { PaypackService } from './paypack.service';
import { ReconcileService } from './reconcile.service';

@Module({
  imports: [GatewayModule],
  controllers: [WalletController],
  providers: [WalletService, EversendService, WooshPayService, PaypackService, ReconcileService],
  exports: [WalletService, EversendService, WooshPayService, PaypackService],
})
export class WalletModule {}
