import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Order-scoped purchasing money for market agents.
 *
 * This intentionally does not use the normal Agent Wallet. The normal wallet
 * represents earned money and is withdrawable. Purchasing money belongs to a
 * specific customer order and must never become fungible agent earnings.
 *
 * The table is created idempotently at startup because this first slice is
 * deliberately isolated from the existing Prisma schema/settlement models.
 */
@Injectable()
export class PurchaseFloatService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AgentPurchaseFund" (
        "id" TEXT PRIMARY KEY,
        "orderId" TEXT NOT NULL UNIQUE,
        "agentId" TEXT NOT NULL,
        "agentUserId" TEXT NOT NULL,
        "authorizedAmount" INTEGER NOT NULL,
        "withdrawnAmount" INTEGER NOT NULL DEFAULT 0,
        "actualSpend" INTEGER,
        "remainingAmount" INTEGER,
        "destinationPhone" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "withdrawnAt" TIMESTAMPTZ,
        "reconciledAt" TIMESTAMPTZ,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AgentPurchaseFund_agent_status_idx"
        ON "AgentPurchaseFund" ("agentId", "status", "createdAt")
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AgentPurchaseFund_order_idx"
        ON "AgentPurchaseFund" ("orderId")
    `);
  }

  private async requireAgent(userId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { userId },
      include: { user: { select: { id: true, phone: true } }, market: true },
    });
    if (!agent) throw new ForbiddenException('NOT_AN_AGENT');
    if (!agent.active) throw new ForbiddenException('AGENT_DEACTIVATED');
    if (!agent.marketId) throw new BadRequestException('AGENT_HAS_NO_MARKET');
    if (!agent.user.phone) throw new BadRequestException('AGENT_MOMO_NUMBER_REQUIRED');
    return agent;
  }

  private async getOrderForAgent(userId: string, orderId: string) {
    const agent = await this.requireAgent(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, marketId: agent.marketId! },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND_IN_AGENT_MARKET');
    return { agent, order };
  }

  private purchaseAmount(order: any) {
    return (order.items ?? [])
      .filter((item: any) => !['UNAVAILABLE_PENDING', 'REFUNDED', 'REMOVED'].includes(item.status))
      .reduce((sum: number, item: any) => {
        const cost = Number(item.referenceCostAtOrder);
        if (!Number.isInteger(cost) || cost <= 0) {
          throw new BadRequestException(`MISSING_MARKET_REFERENCE_COST:${item.id}`);
        }
        return sum + cost * Number(item.quantity);
      }, 0);
  }

  /** Accept an order and atomically create its one-and-only purchasing allocation. */
  async acceptOrder(userId: string, orderId: string) {
    const { agent, order } = await this.getOrderForAgent(userId, orderId);
    if (!(order as any).paid) throw new BadRequestException('ORDER_NOT_PAID');
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestException('ORDER_NOT_ACCEPTABLE');
    }

    const amount = this.purchaseAmount(order);
    if (amount <= 0) throw new BadRequestException('NO_PURCHASABLE_ITEMS');

    const result = await this.prisma.$transaction(async tx => {
      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          marketId: agent.marketId!,
          status: { in: ['PENDING', 'CONFIRMED'] as any },
          OR: [{ agentId: null }, { agentId: agent.id }],
        } as any,
        data: { status: 'PREPARING' as any, agentId: agent.id } as any,
      });
      if (claimed.count !== 1) throw new BadRequestException('ORDER_ALREADY_CLAIMED_OR_CHANGED');

      const existing = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "AgentPurchaseFund" WHERE "orderId" = $1 FOR UPDATE`,
        orderId,
      );
      if (existing.length) return existing[0];

      const id = randomUUID();
      const rows = await tx.$queryRawUnsafe<any[]>(
        `INSERT INTO "AgentPurchaseFund" ("id","orderId","agentId","agentUserId","authorizedAmount","destinationPhone","status")
         VALUES ($1,$2,$3,$4,$5,$6,'AVAILABLE') RETURNING *`,
        id,
        orderId,
        agent.id,
        agent.userId,
        amount,
        agent.user.phone,
      );

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'AGENT_PURCHASE_FUNDS_ALLOCATED',
          entityType: 'ORDER',
          entityId: orderId,
          metadataJson: JSON.stringify({ authorizedAmount: amount, agentId: agent.id }),
        },
      });
      return rows[0];
    }, { isolationLevel: 'Serializable' });

    return this.decorate(result);
  }

  /** Return the order-specific allocation without allowing another order to be touched. */
  async getOrderFunds(userId: string, orderId: string) {
    await this.getOrderForAgent(userId, orderId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "AgentPurchaseFund" WHERE "orderId" = $1`,
      orderId,
    );
    if (!rows.length) return { allocated: false, orderId };
    return this.decorate(rows[0]);
  }

  /** Single-use release of exactly the amount authorized for this order. */
  async withdrawOrderFunds(userId: string, orderId: string) {
    const { agent, order } = await this.getOrderForAgent(userId, orderId);
    if (order.agentId !== agent.id) throw new ForbiddenException('ORDER_NOT_ASSIGNED_TO_YOU');

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "AgentPurchaseFund"
       SET "status"='WITHDRAWN', "withdrawnAmount"="authorizedAmount", "withdrawnAt"=NOW(), "updatedAt"=NOW()
       WHERE "orderId"=$1 AND "agentId"=$2 AND "status"='AVAILABLE'
       RETURNING *`,
      orderId,
      agent.id,
    );
    if (!rows.length) {
      const current = await this.getOrderFunds(userId, orderId);
      if ((current as any).status === 'WITHDRAWN') throw new BadRequestException('PURCHASE_FUNDS_ALREADY_WITHDRAWN');
      throw new BadRequestException('PURCHASE_FUNDS_NOT_AVAILABLE');
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'AGENT_PURCHASE_FUNDS_WITHDRAWN',
        entityType: 'ORDER',
        entityId: orderId,
        metadataJson: JSON.stringify({ amount: rows[0].authorizedAmount, destinationPhone: agent.user.phone }),
      },
    });

    return this.decorate(rows[0]);
  }

  /**
   * Reconcile the order-specific purchasing float after the agent shops.
   * Any unused amount is a customer refund and the same amount is charged
   * back to the agent wallet. The agent wallet is allowed to go negative:
   * this is an earned-money debt, not permission to spend customer funds.
   */
  async reconcile(userId: string, orderId: string, actualSpend: number) {
    const { agent, order } = await this.getOrderForAgent(userId, orderId);
    if (order.agentId !== agent.id) throw new ForbiddenException('ORDER_NOT_ASSIGNED_TO_YOU');
    if (!(order as any).paid) throw new BadRequestException('ORDER_NOT_PAID');
    if (!Number.isInteger(actualSpend) || actualSpend < 0) throw new BadRequestException('INVALID_ACTUAL_SPEND');

    const result = await this.prisma.$transaction(async tx => {
      const fundRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "AgentPurchaseFund" WHERE "orderId"=$1 AND "agentId"=$2 AND "status"='WITHDRAWN' FOR UPDATE`,
        orderId,
        agent.id,
      );
      if (!fundRows.length) throw new BadRequestException('PURCHASE_FUNDS_RECONCILIATION_INVALID');

      const fund = fundRows[0];
      const withdrawn = Number(fund.withdrawnAmount);
      if (actualSpend > withdrawn) throw new BadRequestException('PURCHASE_SPEND_EXCEEDS_WITHDRAWN_FUNDS');
      const remaining = withdrawn - actualSpend;

      const updatedRows = await tx.$queryRawUnsafe<any[]>(
        `UPDATE "AgentPurchaseFund"
         SET "actualSpend"=$1,
             "remainingAmount"=$2,
             "status"='RECONCILED',
             "reconciledAt"=NOW(),
             "updatedAt"=NOW()
         WHERE "id"=$3 AND "status"='WITHDRAWN'
         RETURNING *`,
        actualSpend,
        remaining,
        fund.id,
      );
      if (!updatedRows.length) throw new BadRequestException('PURCHASE_FUNDS_ALREADY_RECONCILED');

      if (remaining > 0) {
        const customerWallet = await tx.wallet.findUnique({ where: { userId: order.customerId } });
        if (!customerWallet) throw new BadRequestException('CUSTOMER_WALLET_NOT_FOUND');

        const agentWallet = await tx.wallet.findUnique({ where: { userId: agent.userId } });
        if (!agentWallet) throw new BadRequestException('AGENT_WALLET_NOT_FOUND');

        const customerAfter = await tx.wallet.update({
          where: { id: customerWallet.id },
          data: { balance: { increment: remaining } },
        });
        const agentAfter = await tx.wallet.update({
          where: { id: agentWallet.id },
          data: { balance: { decrement: remaining } },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: customerWallet.id,
            amount: remaining,
            balanceBefore: customerWallet.balance,
            balanceAfter: customerAfter.balance,
            reference: 'AGENT_PURCHASE_REFUND:' + orderId,
            description: 'Unused shopping money refunded to customer',
            status: 'COMPLETED',
          } as any,
        });
        await tx.walletTransaction.create({
          data: {
            walletId: agentWallet.id,
            amount: -remaining,
            balanceBefore: agentWallet.balance,
            balanceAfter: agentAfter.balance,
            reference: 'AGENT_PURCHASE_REFUND_RECOVERY:' + orderId,
            description: 'Unused shopping money recovered from agent',
            status: 'COMPLETED',
          } as any,
        });

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'AGENT_PURCHASE_UNUSED_REFUNDED_AND_RECOVERED',
            entityType: 'ORDER',
            entityId: orderId,
            metadataJson: JSON.stringify({
              authorizedAmount: withdrawn,
              actualSpend,
              customerRefund: remaining,
              agentDebit: remaining,
              agentBalanceAfter: agentAfter.balance,
            }),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'AGENT_PURCHASE_FUNDS_RECONCILED',
          entityType: 'ORDER',
          entityId: orderId,
          metadataJson: JSON.stringify({
            authorizedAmount: withdrawn,
            actualSpend,
            remainingAmount: remaining,
          }),
        },
      });

      return { fund: updatedRows[0], customerRefund: remaining };
    }, { isolationLevel: 'Serializable' });

    return {
      ...this.decorate(result.fund),
      customerRefund: Number(result.customerRefund),
    };
  }

  async listMyFunds(userId: string) {
    const agent = await this.requireAgent(userId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "AgentPurchaseFund" WHERE "agentId"=$1 ORDER BY "createdAt" DESC LIMIT 100`,
      agent.id,
    );
    return rows.map(row => this.decorate(row));
  }

  private decorate(row: any) {
    return {
      id: row.id,
      orderId: row.orderId,
      agentId: row.agentId,
      authorizedAmount: Number(row.authorizedAmount),
      withdrawnAmount: Number(row.withdrawnAmount),
      actualSpend: row.actualSpend == null ? null : Number(row.actualSpend),
      remainingAmount: row.remainingAmount == null ? null : Number(row.remainingAmount),
      destinationPhone: row.destinationPhone,
      status: row.status,
      createdAt: row.createdAt,
      withdrawnAt: row.withdrawnAt,
      reconciledAt: row.reconciledAt,
    };
  }
}
