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
      CREATE INDEX IF NOT EXISTS "AgentPurchaseFund_agent_status_idx"
        ON "AgentPurchaseFund" ("agentId", "status", "createdAt");
      CREATE INDEX IF NOT EXISTS "AgentPurchaseFund_order_idx"
        ON "AgentPurchaseFund" ("orderId");
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

  /** Reconcile the controlled amount against the receipt after shopping. */
  async reconcile(userId: string, orderId: string, actualSpend: number) {
    const { agent, order } = await this.getOrderForAgent(userId, orderId);
    if (order.agentId !== agent.id) throw new ForbiddenException('ORDER_NOT_ASSIGNED_TO_YOU');
    if (!Number.isInteger(actualSpend) || actualSpend < 0) throw new BadRequestException('INVALID_ACTUAL_SPEND');

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "AgentPurchaseFund"
       SET "actualSpend"=$1,
           "remainingAmount"=("withdrawnAmount"-$1),
           "status"='RECONCILED',
           "reconciledAt"=NOW(),
           "updatedAt"=NOW()
       WHERE "orderId"=$2 AND "agentId"=$3 AND "status"='WITHDRAWN' AND $1 <= "withdrawnAmount"
       RETURNING *`,
      actualSpend,
      orderId,
      agent.id,
    );
    if (!rows.length) throw new BadRequestException('PURCHASE_FUNDS_RECONCILIATION_INVALID');

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'AGENT_PURCHASE_FUNDS_RECONCILED',
        entityType: 'ORDER',
        entityId: orderId,
        metadataJson: JSON.stringify({ actualSpend, remainingAmount: rows[0].remainingAmount }),
      },
    });
    return this.decorate(rows[0]);
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
