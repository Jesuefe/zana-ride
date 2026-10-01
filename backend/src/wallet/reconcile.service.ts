import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EversendService } from './eversend.service';
import { ZanaGateway } from '../gateway/zana.gateway';

/**
 * Money reconciliation without webhooks.
 *
 * Eversend settles asynchronously, so anything paid or withdrawn sits in a
 * pending state until we confirm it. This sweeps every minute and asks
 * Eversend directly what happened, then settles the record either way.
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
    private eversend: EversendService,
    private gateway: ZanaGateway,
  ) {}

  // A sweep can outlive its minute if Eversend is slow, so guard against a
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
        const res = await this.eversend.getPayoutStatus(txn.providerRef!);
        const status = res.status;
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
          // Never left Eversend — give the money back. The claim step is
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
        // Eversend unreachable — leave it pending and try again next sweep.
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
        const res = await this.eversend.getCollectionStatus(txn.providerRef!);
        const status = res.status;
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
        const res = await this.eversend.getCollectionStatus((order as any).momoRef);
        if ((res?.status ?? '').toLowerCase() !== 'successful') continue;

        const claimed = await this.prisma.order.updateMany({
          where: { id: order.id, paid: false }, data: { paid: true } as any,
        });
        if (claimed.count === 0) continue;

        const payload = {
          orderId: order.id,
          trackingCode: (order as any).trackingCode,
          total: (order as any).total,
          itemCount: await this.prisma.orderItem.count({ where: { orderId: order.id } }),
        };
        this.gateway.sendToUser(order.customerId, 'payment:confirmed', { orderId: order.id });
        if ((order as any).marketId) {
          const agents = await this.prisma.agent.findMany({ where: { marketId: (order as any).marketId, active: true }, select: { userId: true } });
          for (const a of agents) this.gateway.sendToUser(a.userId, 'order:new', payload);
        } else if ((order as any).merchantId) {
          const merchant = await this.prisma.merchant.findUnique({ where: { id: (order as any).merchantId }, select: { userId: true } });
          if (merchant?.userId) this.gateway.sendToUser(merchant.userId, 'order:new', payload);
        }
        const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        for (const admin of admins) this.gateway.sendToUser(admin.id, 'order:new', payload);
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
        const res = await this.eversend.getCollectionStatus((d as any).momoRef);
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
