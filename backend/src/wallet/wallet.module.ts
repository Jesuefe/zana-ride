import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PaypackService } from './paypack.service';
import { ReconcileService } from './reconcile.service';
import { MomoDisbursementService } from './momo-disbursement.service';
import { PesapalService } from './pesapal.service';
import { PesapalController } from './pesapal.controller';

@Module({
  imports: [GatewayModule],
  controllers: [WalletController, PesapalController],
  providers: [WalletService, PaypackService, ReconcileService, MomoDisbursementService, PesapalService],
  exports: [WalletService, MomoDisbursementService, PesapalService],
})
export class WalletModule {}
