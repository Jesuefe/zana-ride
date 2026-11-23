import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/roles.guard';
import { FoodPartnerApiKeyGuard, FoodPartnerSessionGuard, FoodPartnersService } from './food-partners.service';

@Controller('food-partners')
export class FoodPartnersController {
  constructor(private service: FoodPartnersService) {}

  @Post('register')
  register(@Body() body: { businessName: string; email: string; phone: string; password: string; contactName?: string }) {
    return this.service.registerPortalAccount(body);
  }

  @Post('quote')
  @UseGuards(FoodPartnerApiKeyGuard)
  quote(@Body() body: any) { return this.service.quote(body); }

  @Post('deliveries')
  @UseGuards(FoodPartnerApiKeyGuard)
  createDelivery(@Req() req: any, @Body() body: any) {
    return this.service.createDelivery(req.foodPartner.id, body);
  }

  @Get('wallet')
  @UseGuards(FoodPartnerApiKeyGuard)
  wallet(@Req() req: any) { return this.service.wallet(req.foodPartner.id); }

  @Get('wallet/transactions')
  @UseGuards(FoodPartnerApiKeyGuard)
  transactions(@Req() req: any) { return this.service.transactions(req.foodPartner.id); }

  @Get('deliveries/:id')
  @UseGuards(FoodPartnerApiKeyGuard)
  getDelivery(@Req() req: any, @Param('id') id: string) {
    return this.service.getDelivery(req.foodPartner.id, id);
  }

  @Post('deliveries/:id/cancel')
  @UseGuards(FoodPartnerApiKeyGuard)
  cancelDelivery(@Req() req: any, @Param('id') id: string) {
    return this.service.cancelDelivery(req.foodPartner.id, id);
  }
}

@Controller('food-partners/portal')
@UseGuards(JwtAuthGuard, FoodPartnerSessionGuard)
export class FoodPartnerPortalController {
  constructor(private service: FoodPartnersService) {}

  @Get('me')
  me(@Req() req: any) { return this.service.portalPartner(req.user.sub); }

  @Get('overview')
  overview(@Req() req: any) { return this.service.portalOverview(req.user.sub); }

  @Get('deliveries')
  deliveries(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.portalDeliveries(req.user.sub, limit ? Number(limit) : 50);
  }

  @Get('wallet')
  wallet(@Req() req: any) {
    return this.service.wallet(req.foodPartner.id);
  }

  @Get('wallet/transactions')
  transactions(@Req() req: any) {
    return this.service.transactions(req.foodPartner.id);
  }

  @Post('rotate-key')
  rotateKey(@Req() req: any) {
    return this.service.portalRotateKey(req.user.sub);
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
    if (!['ACTIVE', 'SUSPENDED'].includes(body.status)) throw new BadRequestException('INVALID_PARTNER_STATUS');
    return this.service.setPartnerStatus(id, body.status);
  }
}
