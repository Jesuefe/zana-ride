import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.walletService.findByUserId(user.sub);
  }

  // Real mobile money top-up via Paypack.
  @Post('top-up/momo')
  initiateMomoTopUp(@CurrentUser() user: JwtPayload, @Body() body: { amount: number }) {
    // Previously accepted a phone number directly from the request body
    // with no server-side check it belonged to the account — a real
    // security gap, not just a UI restriction. The service now always
    // looks up the account's own registered number itself.
    return this.walletService.initiateTopUp(user.sub, body.amount);
  }

  @Get('top-up/momo/:ref/status')
  checkMomoTopUpStatus(@CurrentUser() user: JwtPayload, @Param('ref') ref: string) {
    return this.walletService.checkTopUpStatus(user.sub, ref);
  }

  // Same real Paypack flow as the top-up above, just clearing commission
  // debt directly instead of crediting the wallet. The amount is computed
  // server-side from the driver's actual unpaid debt — never accepted
  // from the client, so there's no way to request settling an arbitrary
  // amount.
  @Post('settle-debt')
  initiateDebtSettlement(@CurrentUser() user: JwtPayload, @Body() body: { phone: string }) {
    return this.walletService.initiateDebtSettlement(user.sub, body.phone);
  }

  @Get('settle-debt/:ref/status')
  checkDebtSettlementStatus(@CurrentUser() user: JwtPayload, @Param('ref') ref: string) {
    return this.walletService.checkDebtSettlementStatus(user.sub, ref);
  }

  @Post('withdraw')
  async withdraw(
    @CurrentUser() user: JwtPayload,
    @Body() body: { amount: number },
  ) {
    // Previously accepted an arbitrary destination phone number from the
    // client with no check it belonged to the account — meaning a
    // compromised account could be drained to an attacker's own MoMo
    // number. The service now always withdraws to the account's own
    // registered number, looked up server-side.
    return this.walletService.withdraw(user.sub, body.amount);
  }

}