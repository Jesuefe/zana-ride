import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommissionService } from './commission.service';
import { FinancialService } from './financial.service';
import { ImpactFundDisbursementService } from './impact-fund-disbursement.service';
import { FinanceExtensionsService } from './finance-extensions.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { StorageService } from '../deliveries/storage.service';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { DriversModule } from '../drivers/drivers.module';
import { PaypackService } from '../wallet/paypack.service';
import { ZanaAiModule } from '../zana-ai/zana-ai.module';

@Module({
  imports: [EmailModule, SmsModule, DriversModule, ZanaAiModule],
  controllers: [AdminController],
  providers: [AdminService, CommissionService, FinancialService, ImpactFundDisbursementService, FinanceExtensionsService, AdminAuditInterceptor, StorageService, PaypackService],
  exports: [CommissionService],
})
export class AdminModule {}