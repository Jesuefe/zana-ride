import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommissionService } from './commission.service';
import { FinancialService } from './financial.service';
import { StorageService } from '../deliveries/storage.service';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  imports: [EmailModule, SmsModule, DriversModule],
  controllers: [AdminController],
  providers: [AdminService, CommissionService, FinancialService, StorageService],
  exports: [CommissionService],
})
export class AdminModule {}
