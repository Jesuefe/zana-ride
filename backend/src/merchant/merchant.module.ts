import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { PaypackService } from '../wallet/paypack.service';
import { WalletModule } from '../wallet/wallet.module';
import { MerchantController, PublicProductsController } from './merchant.controller';
import { MarketplaceController, CustomerOrdersController, MerchantOrdersController } from './orders.controller';
import { MerchantService } from './merchant.service';
import { StorageService } from '../deliveries/storage.service';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [PrismaModule, DeliveriesModule, GatewayModule, WalletModule, FinanceModule],
  controllers: [
    MerchantController,
    PublicProductsController,
    MarketplaceController,
    CustomerOrdersController,
    MerchantOrdersController,
  ],
  providers: [MerchantService, StorageService, OrdersService, PaypackService],
  exports: [MerchantService, OrdersService],
})
export class MerchantModule {}
