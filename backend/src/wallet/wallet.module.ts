import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PaypackService } from './paypack.service';
import { PaypackPaymentAdapter } from './paypack-payment.adapter';
import { ReconcileService } from './reconcile.service';

@Module({
  imports: [GatewayModule],
  controllers: [WalletController],
  providers: [WalletService, PaypackPaymentAdapter, PaypackService, ReconcileService],
  exports: [WalletService, PaypackService],
})
export class WalletModule {}
