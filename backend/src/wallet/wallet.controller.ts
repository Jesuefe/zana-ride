import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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

  @Post('top-up')
  topUp(@CurrentUser() user: JwtPayload, @Body() body: { amount: number; reference?: string }) {
    return this.walletService.applyTransaction(user.sub, Math.abs(body.amount), body.reference ?? 'Top up');
  }
}
