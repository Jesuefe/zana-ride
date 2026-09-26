import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PurchaseFloatService } from './purchase-float.service';

@Controller('agent/purchase-funds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AGENT')
export class PurchaseFloatController {
  constructor(private readonly funds: PurchaseFloatService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.funds.listMyFunds(user.sub);
  }

  @Get(':orderId')
  get(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.funds.getOrderFunds(user.sub, orderId);
  }

  @Post(':orderId/accept')
  accept(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.funds.acceptOrder(user.sub, orderId);
  }

  @Post(':orderId/withdraw')
  withdraw(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.funds.withdrawOrderFunds(user.sub, orderId);
  }

  @Post(':orderId/reconcile')
  reconcile(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() body: { actualSpend: number },
  ) {
    return this.funds.reconcile(user.sub, orderId, Number(body.actualSpend));
  }
}
