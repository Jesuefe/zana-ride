import { Module } from '@nestjs/common';
import { ZanaAiController } from './zana-ai.controller';
import { ZanaAiService } from './zana-ai.service';
import { MerchantModule } from '../merchant/merchant.module';
import { MarketsModule } from '../markets/markets.module';

@Module({
  imports: [MerchantModule, MarketsModule],
  controllers: [ZanaAiController],
  providers: [ZanaAiService],
})
export class ZanaAiModule {}
