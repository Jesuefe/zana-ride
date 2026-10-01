import { Module } from '@nestjs/common';
import { ZanaAiController } from './zana-ai.controller';
import { ZanaAiService } from './zana-ai.service';
import { MerchantModule } from '../merchant/merchant.module';
import { MarketsModule } from '../markets/markets.module';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [MerchantModule, MarketsModule, TripsModule],
  controllers: [ZanaAiController],
  providers: [ZanaAiService],
  exports: [ZanaAiService],
})
export class ZanaAiModule {}
