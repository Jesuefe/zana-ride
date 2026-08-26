import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MerchantService } from './merchant.service';

@Controller('merchant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MERCHANT')
export class MerchantController {
  constructor(private merchantService: MerchantService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.merchantService.findByUserId(user.sub);
  }

  @Post('deliveries')
  async create(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: { receiverName: string; receiverPhone: string; dropoffAddress: string; packageType: string; fee: number },
  ) {
    const merchant = await this.merchantService.findByUserId(user.sub);
    return this.merchantService.createDelivery(merchant.id, body);
  }

  @Get('deliveries')
  async list(@CurrentUser() user: JwtPayload) {
    const merchant = await this.merchantService.findByUserId(user.sub);
    return this.merchantService.listDeliveries(merchant.id);
  }
}
