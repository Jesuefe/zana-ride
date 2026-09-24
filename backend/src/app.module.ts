import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DriversModule } from './drivers/drivers.module';
import { TripsModule } from './trips/trips.module';
import { WalletModule } from './wallet/wallet.module';
import { MerchantModule } from './merchant/merchant.module';
import { HealthController } from './health.controller';
import { SafetyModule } from './safety/safety.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    DriversModule,
    TripsModule,
    WalletModule,
    MerchantModule,
    SafetyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
