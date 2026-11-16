import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerApiController } from './partner-api.controller';
import { PartnerApiService } from './partner-api.service';
import { PartnerApiKeyGuard } from './partner-api-key.guard';

@Module({
  imports: [PrismaModule],
  controllers: [PartnerApiController],
  providers: [PartnerApiService, PartnerApiKeyGuard],
})
export class PartnerApiModule {}
