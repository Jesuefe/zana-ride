import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/roles.guard';
import { FoodPartnerApiKeyGuard, FoodPartnersService } from './food-partners.service';

@Controller('food-partners')
@UseGuards(FoodPartnerApiKeyGuard)
export class FoodPartnersController {
  constructor(private service: FoodPartnersService) {}

  @Post('quote')
  quote(@Body() body: any) { return this.service.quote(body); }

  @Post('deliveries')
  createDelivery(@Req() req: any, @Body() body: any) {
    return this.service.createDelivery(req.foodPartner.id, body);
  }

  @Get('wallet')
  wallet(@Req() req: any) { return this.service.wallet(req.foodPartner.id); }

  @Get('wallet/transactions')
  transactions(@Req() req: any) { return this.service.transactions(req.foodPartner.id); }

  @Get('deliveries/:id')
  getDelivery(@Req() req: any, @Param('id') id: string) {
    return this.service.getDelivery(req.foodPartner.id, id);
  }

  @Post('deliveries/:id/cancel')
  cancelDelivery(@Req() req: any, @Param('id') id: string) {
    return this.service.cancelDelivery(req.foodPartner.id, id);
  }
}

@Controller('admin/food-delivery-partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminFoodPartnersController {
  constructor(private service: FoodPartnersService) {}

  @Post()
  create(@Body() body: { name: string; contactEmail?: string }) {
    return this.service.createPartner(body);
  }

  @Get()
  list() { return this.service.listPartners(); }

  @Post(':id/top-ups')
  topUp(@Param('id') id: string, @Body() body: { amount: number; reference?: string }) {
    return this.service.topUp(id, body.amount, body.reference);
  }

  @Post(':id/rotate-key')
  rotateKey(@Param('id') id: string) { return this.service.rotateKey(id); }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'SUSPENDED' }) {
    if (!['ACTIVE', 'SUSPENDED'].includes(body.status)) throw new (require('@nestjs/common').BadRequestException)('INVALID_PARTNER_STATUS');
    return this.service.setPartnerStatus(id, body.status);
  }
}
