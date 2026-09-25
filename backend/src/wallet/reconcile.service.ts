import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PaypackService } from './paypack.service';
import { ZanaGateway } from '../gateway/zana.gateway';
import { MomoDisbursementService } from './momo-disbursement.service';
import { PesapalService } from './pesapal.service';

/**
 * Money reconciliation without webhooks.
 *
 * Paypack settles asynchronously, so anything paid or withdrawn sits in a
 * pending state until we confirm it. This sweeps every minute and asks
 * Paypack directly what happened, then settles the record either way.
 *
 * It is deliberately independent of the request that created the payment —
 * a customer closing their app, or a driver losing signal, must not leave
 * money in limbo.
 */
@Injectable()
export class ReconcileService {
  private readonly logger = new Logger('Reconcile');

  constructor(
    private prisma: PrismaService,
    private paypack: PaypackService,
    private momo: MomoDisbursementService,
    private pesapal: PesapalService,
    private gateway: ZanaGateway,
  ) {}

  // A sweep can outlive its minute if Paypack is slow, so guard against a
  // second one starting and settling the same record twice.
  private running = false;

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      await this.runSweep();
    } finally {
      this.running = false;
    }
  }

  private async runSweep() {
    await Promise.all([
      this.settleWithdrawals(),
      this.settleTopUps(),
      this.settleOrders(),
      this.settleDeliveries(),
    ]);
  }

  private isFinal(status: string) {
    return ['successful', 'failed', 'rejected', 'cancelled'].includes(status);
  }

  // ── Withdrawals: money leaving Zana ──────────────────────────────────────
  private async settleWithdrawals() {
    const pending = await this.prisma.walletTransaction.findMany({
      where: {
        status: 'PENDING',
        amount: { lt: 0 },
        providerRef: { not: null },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: { wallet: true },
      take: 40,
    });

    for (const txn of pending) {
      try {
        // Withdrawals may have gone out over either rail. MTN references are
        // UUIDs we generated; ask MTN first and fall back to Paypack.
        let status = '';
        if (this.momo.isConfigured) {
          const m = await this.momo.getTransferStatus(txn.providerRef!);
          if (m.status === 'SUCCESSFUL') status = 'successful';
          else if (m.status === 'FAILED') status = 'failed';
        }
        if (!status) {
          const res = await this.paypack.findTransaction(txn.providerRef!);
          status = (res?.status ?? '').toLowerCase();
        }
        if (!this.isFinal(status)) continue;

        if (status === 'successful') {
          // Atomic claim: only a status still actually PENDING flips to
          // COMPLETED here. If the in-memory sweep lock ever fails to
          // prevent an overlapping run (a process restart mid-sweep, for
          // instance), the second sweep's claim finds count === 0 and
          // skips rather than notifying twice.
          const claimed = await this.prisma.walletTransaction.updateMany({
            where: { id: txn.id, status: 'PENDING' },
            data: { status: 'COMPLETED' },
          });
          if (claimed.count === 0) continue;

          this.gateway.sendToUser(txn.wallet.userId, 'wallet:withdrawal', {
            status: 'COMPLETED', amount: Math.abs(txn.amount),
          });
          this.logger.log(`Withdrawal ${txn.providerRef} completed`);
        } else {
          // Never left Paypack — give the money back. The claim step is
          // what actually prevents a double refund; the credit itself uses
          // an atomic increment so it can never be decided from a stale
          // balance read.
          const claimed = await this.prisma.walletTransaction.updateMany({
            where: { id: txn.id, status: 'PENDING' },
            data: { status: 'FAILED' },
          });
          if (claimed.count === 0) continue;

          await this.prisma.wallet.update({
            where: { id: txn.walletId },
            data: { balance: { increment: Math.abs(txn.amount) } },
          });
          this.gateway.sendToUser(txn.wallet.userId, 'wallet:withdrawal', {
            status: 'FAILED', amount: Math.abs(txn.amount),
          });
          this.logger.warn(`Withdrawal ${txn.providerRef} failed — balance restored`);
        }
      } catch {
        // Paypack unreachable — leave it pending and try again next sweep.
      }
    }
  }

  // ── Top-ups: money entering the wallet ───────────────────────────────────
  private async settleTopUps() {
    const pending = await this.prisma.walletTransaction.findMany({
      where: {
        status: 'PENDING',
        amount: { gt: 0 },
        providerRef: { not: null },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: { wallet: true },
      take: 40,
    });

    for (const txn of pending) {
      try {
        // Withdrawals may have gone out over either rail. MTN references are
        // UUIDs we generated; ask MTN first and fall back to Paypack.
        let status = '';
        if (this.momo.isConfigured) {
          const m = await this.momo.getTransferStatus(txn.providerRef!);
          if (m.status === 'SUCCESSFUL') status = 'successful';
          else if (m.status === 'FAILED') status = 'failed';
        }
        if (!status) {
          const res = await this.paypack.findTransaction(txn.providerRef!);
          status = (res?.status ?? '').toLowerCase();
        }
        if (!this.isFinal(status)) continue;

        if (status === 'successful') {
          // The client's own status-poll endpoint can independently credit
          // this exact same top-up at nearly the same moment this sweep
          // does. This claim is what makes the two paths safe together:
          // whichever one flips PENDING to COMPLETED first proceeds: the
          // other finds count === 0 and skips, rather than both crediting.
          const claimed = await this.prisma.walletTransaction.updateMany({
            where: { id: txn.id, status: 'PENDING' },
            data: { status: 'COMPLETED' },
          });
          if (claimed.count === 0) continue;

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
          this.logger.log(`Top-up ${txn.providerRef} credited`);
        } else {
          const claimed = await this.prisma.walletTransaction.updateMany({
            where: { id: txn.id, status: 'PENDING' },
            data: { status: 'FAILED' },
          });
          if (claimed.count === 0) continue;
        }
      } catch { /* retry next sweep */ }
    }
  }

  // ── Marketplace and market orders paid by MoMo ───────────────────────────
  private async settleOrders() {
    const pending = await this.prisma.order.findMany({
      where: {
        paid: false,
        momoRef: { not: null },
        createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      } as any,
      take: 40,
    });

    for (const order of pending) {
      try {
        const res = await this.paypack.findTransaction((order as any).momoRef);
        if ((res?.status ?? '').toLowerCase() !== 'successful') continue;

        await this.prisma.order.update({
          where: { id: order.id }, data: { paid: true } as any,
        });
        this.gateway.sendToUser(order.customerId, 'payment:confirmed', {
          orderId: order.id,
        });
        this.logger.log(`Order ${(order as any).trackingCode ?? order.id} confirmed paid`);
      } catch { /* retry next sweep */ }
    }
  }

  // ── Package deliveries paid by MoMo ──────────────────────────────────────
  private async settleDeliveries() {
    const pending = await this.prisma.delivery.findMany({
      where: {
        paid: false,
        momoRef: { not: null },
        createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      } as any,
      take: 40,
    });

    for (const d of pending) {
      try {
        const res = await this.paypack.findTransaction((d as any).momoRef);
        if ((res?.status ?? '').toLowerCase() !== 'successful') continue;

        await this.prisma.delivery.update({
          where: { id: d.id }, data: { paid: true } as any,
        });
        if (d.customerId) {
          this.gateway.sendToUser(d.customerId, 'payment:confirmed', {
            deliveryId: d.id,
          });
        }
        this.logger.log(`Delivery ${(d as any).trackingCode ?? d.id} confirmed paid`);
      } catch { /* retry next sweep */ }
    }
  }
}
