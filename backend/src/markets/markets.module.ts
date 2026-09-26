import { Module } from '@nestjs/common';
import { MarketsController, AgentController } from './markets.controller';
import { MarketsService } from './markets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../deliveries/storage.service';
import { GatewayModule } from '../gateway/gateway.module';
import { WalletModule } from '../wallet/wallet.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, GatewayModule, WalletModule, PushModule],
  controllers: [MarketsController, AgentController],
  providers: [MarketsService, StorageService],
  exports: [MarketsService],
})
export class MarketsModule {}
