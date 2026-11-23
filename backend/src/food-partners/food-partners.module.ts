import { Module } from '@nestjs/common';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { FoodPartnersController, FoodPartnerPortalController, AdminFoodPartnersController } from './food-partners.controller';
import { FoodPartnerApiKeyGuard, FoodPartnerSessionGuard, FoodPartnersService } from './food-partners.service';

@Module({
  imports: [DeliveriesModule],
  controllers: [FoodPartnersController, FoodPartnerPortalController, AdminFoodPartnersController],
  providers: [FoodPartnersService, FoodPartnerApiKeyGuard, FoodPartnerSessionGuard],
})
export class FoodPartnerModule {}
