import { Body, Controller, Get, Post, Query, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PesapalService } from './pesapal.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZanaGateway } from '../gateway/zana.gateway';

@Controller('pesapal')
export class PesapalController {
  private readonly logger = new Logger('PesapalController');

  constructor(
    private pesapal: PesapalService,
    private prisma: PrismaService,
    private gateway: ZanaGateway,
  ) {}

  /**
   * Top up a wallet with a card. Returns a hosted checkout URL — the customer
   * enters their card on Pesapal's page, so no card data reaches Zana.
   */
  @Post('topup')
  @UseGuards(JwtAuthGuard)
  async topUp(
    @CurrentUser() user: JwtPayload,
    @Body() body: { amount: number },
  ) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { email: true, phone: true, firstName: true, lastName: true },
    });

    let wallet = await this.prisma.wallet.findUnique({ where: { userId: user.sub } });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId: user.sub, balance: 0 },
      });
    }

    const payment = await this.pesapal.createPayment({
      amount: body.amount,
      description: 'Zana wallet top-up',
      email: account?.email ?? undefined,
      phone: account?.phone ?? undefined,
      firstName: account?.firstName ?? undefined,
      lastName: account?.lastName ?? undefined,
    });

    // Recorded pending; credited only once Pesapal confirms.
    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: body.amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        status: 'PENDING',
        providerRef: payment.orderTrackingId,
        reference: 'Card top-up',
        description: 'Card top-up',
      } as any,
    });

    return {
      redirectUrl: payment.redirectUrl,
      orderTrackingId: payment.orderTrackingId,
    };
  }

  /** Client polls this after returning from the hosted page. */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@Query('orderTrackingId') id: string) {
    return this.pesapal.getStatus(id);
  }

  /**
   * Pesapal's IPN callback. Unauthenticated by design — it only looks up its
   * own tracking id and confirms with Pesapal before crediting anything, so
   * a forged call cannot create money.
   */
  @Get('ipn')
  async ipn(
    @Query('OrderTrackingId') orderTrackingId: string,
    @Query('OrderNotificationType') type: string,
  ) {
    this.logger.log(`IPN ${type} for ${orderTrackingId}`);
    if (!orderTrackingId) return { status: 200 };

    const txn = await this.prisma.walletTransaction.findFirst({
      where: { providerRef: orderTrackingId, status: 'PENDING' },
      include: { wallet: true },
    });
    if (!txn) return { orderNotificationType: type, orderTrackingId, status: 200 };

    // Never trust the callback — ask Pesapal what actually happened.
    const result = await this.pesapal.getStatus(orderTrackingId);

    if (result.status === 'COMPLETED') {
      // This callback and the background reconciler's sweep can both reach
      // this same pending transaction — Pesapal can call the IPN at the
      // same moment the reconciler independently polls for status. The
      // claim below is what makes that safe: only whichever one flips
      // PENDING to COMPLETED first proceeds to credit the wallet.
      const claimed = await this.prisma.walletTransaction.updateMany({
        where: { id: txn.id, status: 'PENDING' },
        data: { status: 'COMPLETED' },
      });

      if (claimed.count > 0) {
        await this.prisma.wallet.update({
          where: { id: txn.walletId },
          data: { balance: { increment: txn.amount } },
        });
        const w = await this.prisma.wallet.findUnique({ where: { id: txn.walletId } });
        await this.prisma.walletTransaction.update({
          where: { id: txn.id },
          data: { balanceAfter: w!.balance },
        });
        this.gateway.sendToUser(txn.wallet.userId, 'wallet:topped-up', {
          amount: txn.amount,
        });
        this.logger.log(`Card top-up ${orderTrackingId} credited`);
      }
    } else if (['FAILED', 'INVALID', 'REVERSED'].includes(result.status)) {
      await this.prisma.walletTransaction.update({
        where: { id: txn.id }, data: { status: 'FAILED' },
      });
    }

    return { orderNotificationType: type, orderTrackingId, status: 200 };
  }

  /** Run once to register the IPN URL, then store the returned id. */
  @Post('register-ipn')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async registerIpn(@Body() body: { url?: string }) {
    const url = body?.url ?? 'https://zana.ajumalink.com/api/v1/pesapal/ipn';
    return this.pesapal.registerIpn(url);
  }
}
