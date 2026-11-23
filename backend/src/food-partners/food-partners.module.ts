import { Module } from '@nestjs/common';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { FoodPartnersController, AdminFoodPartnersController } from './food-partners.controller';
import { FoodPartnerApiKeyGuard, FoodPartnersService } from './food-partners.service';

@Module({
  imports: [DeliveriesModule],
  controllers: [FoodPartnersController, AdminFoodPartnersController],
  providers: [FoodPartnersService, FoodPartnerApiKeyGuard],
})
export class FoodPartnerModule {}
