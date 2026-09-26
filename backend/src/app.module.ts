import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { PushModule } from './push/push.module';
import { MarketsModule } from './markets/markets.module';
import { PurchaseFloatModule } from './markets/purchase-float.module';
import { GatewayModule } from './gateway/gateway.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DriversModule } from './drivers/drivers.module';
import { TripsModule } from './trips/trips.module';
import { WalletModule } from './wallet/wallet.module';
import { MerchantModule } from './merchant/merchant.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { AdminModule } from './admin/admin.module';
import { ChatModule } from './chat/chat.module';
import { SosModule } from './sos/sos.module';
import { CallsModule } from './calls/calls.module';
import { HealthController } from './health.controller';
import { FinanceModule } from './finance/finance.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RedisModule,
    CommonModule,
    PushModule,
    MarketsModule,
    PurchaseFloatModule,
    GatewayModule,
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 1000,
      limit: 10,
    }, {
      name: 'long',
      ttl: 60000,
      limit: 200,
    }]),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    DriversModule,
    TripsModule,
    WalletModule,
    MerchantModule,
    DeliveriesModule,
    AdminModule,
    ChatModule,
    SosModule,
    CallsModule,
    FinanceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
