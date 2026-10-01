import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommissionService } from './commission.service';
import { FinancialService } from './financial.service';
import { StorageService } from '../deliveries/storage.service';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { DriversModule } from '../drivers/drivers.module';
import { EversendService } from '../wallet/eversend.service';
import { ZanaAiModule } from '../zana-ai/zana-ai.module';

@Module({
  imports: [EmailModule, SmsModule, DriversModule, ZanaAiModule],
  controllers: [AdminController],
  providers: [AdminService, CommissionService, FinancialService, StorageService, EversendService],
  exports: [CommissionService],
})
export class AdminModule {}
