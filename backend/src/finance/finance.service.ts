import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  private async audit(actorId: string | null, action: string, entityType: string, entityId?: string, before?: unknown, after?: unknown, metadata?: unknown) {
    await this.prisma.auditLog.create({ data: {
      actorId: actorId ?? undefined, action, entityType, entityId,
      beforeJson: before === undefined ? undefined : JSON.stringify(before),
      afterJson: after === undefined ? undefined : JSON.stringify(after),
      metadataJson: metadata === undefined ? undefined : JSON.stringify(metadata),
    }});
  }

  private async marketConfig() {
    const existing = await this.prisma.marketPriceConfig.findFirst();
    return existing ?? this.prisma.marketPriceConfig.create({ data: {} });
  }

  async settleOrder(orderId: string) {
    const existing = await this.prisma.merchantSettlement.findUnique({ where: { orderId } }) ?? await this.prisma.agentSettlement.findUnique({ where: { orderId } });
    if (existing) return existing;
    return this.prisma.$transaction(async tx => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: {
        merchant: { select: { id: true, userId: true } },
        items: { include: { product: true } },
      }});
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'DELIVERED') throw new BadRequestException('ORDER_NOT_DELIVERED');
      if (!order.paid) throw new BadRequestException('ORDER_NOT_PAID');

      if (order.merchantId) {
        const gross = Math.max(0, order.total - order.deliveryFee);
        const rate = 15;
        const commission = Math.round(gross * rate / 100);
        const net = gross - commission;
        const settlement = await tx.merchantSettlement.create({ data: { orderId, merchantId: order.merchantId, grossAmount: gross, commissionRate: rate, commissionAmount: commission, merchantNet: net }});
        if (order.merchant?.userId && net > 0) {
          const wallet = await tx.wallet.upsert({ where: { userId: order.merchant.userId }, create: { userId: order.merchant.userId }, update: {} });
          const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: net } }});
          await tx.walletTransaction.create({ data: { walletId: wallet.id, amount: net, balanceBefore: wallet.balance, balanceAfter: updated.balance, reference: `MERCHANT_SETTLEMENT:${orderId}`, description: `Merchant settlement for order ${orderId}` }});
        }
        return settlement;
      }

      if (order.marketId && order.agentId) {
        const agent = await tx.agent.findUnique({ where: { id: order.agentId }, select: { id: true, userId: true }});
        if (!agent) throw new BadRequestException('AGENT_NOT_FOUND');
        const cfg = await tx.marketPriceConfig.findFirst() ?? await tx.marketPriceConfig.create({ data: {} });
        let underlyingAmount = 0;
        let customerAmount = 0;
        let actualPurchaseCost = 0;
        for (const item of order.items) {
          const underlying = item.referenceCostAtOrder ?? item.product.referenceCost;
          if (underlying == null || underlying <= 0) throw new BadRequestException(`MISSING_MARKET_REFERENCE_COST:${item.id}`);
          const expectedCustomerPrice = Math.round(underlying * (1 + cfg.markupPercent / 100));
          if (item.price !== expectedCustomerPrice) {
            throw new BadRequestException(`INVALID_MARKET_MARKUP:${item.id}`);
          }
          const actual = item.actualPurchasePrice ?? underlying;
          if (!Number.isInteger(actual) || actual < 0 || actual > underlying) {
            throw new BadRequestException(`INVALID_PURCHASE_COST:${item.id}`);
          }
          underlyingAmount += underlying * item.quantity;
          customerAmount += item.price * item.quantity;
          actualPurchaseCost += actual * item.quantity;
        }
        const markupAmount = customerAmount - underlyingAmount;
        const agentRate = cfg.agentMarkupShare;
        const zanaRate = cfg.zanaMarkupShare;
        if (agentRate < 0 || zanaRate < 0 || Math.abs(agentRate + zanaRate - 100) > 0.001) {
          throw new BadRequestException('INVALID_MARKUP_SPLIT');
        }
        const agentEarning = Math.round(markupAmount * agentRate / 100);
        const zanaEarning = markupAmount - agentEarning;
        const settlement = await tx.agentSettlement.create({ data: {
          orderId, agentId: agent.id, underlyingAmount, customerAmount, markupAmount,
          markupPercent: cfg.markupPercent, agentRate, zanaRate,
          agentEarning, zanaEarning, actualPurchaseCost,
        }});
        if (agentEarning > 0) {
          const wallet = await tx.wallet.upsert({ where: { userId: agent.userId }, create: { userId: agent.userId }, update: {} });
          const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: agentEarning } }});
          await tx.walletTransaction.create({ data: { walletId: wallet.id, amount: agentEarning, balanceBefore: wallet.balance, balanceAfter: updated.balance, reference: `AGENT_SETTLEMENT:${orderId}`, description: `Agent 40% share of market markup for order ${orderId}` }});
        }
        return settlement;
      }
      throw new BadRequestException('ORDER_HAS_NO_SETTLEMENT_OWNER');
    }, { isolationLevel: 'Serializable' });
  }

  async merchantSummary(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId }, select: { id: true }});
    if (!merchant) throw new NotFoundException('Merchant not found');
    const settlements = await this.prisma.merchantSettlement.findMany({ where: { merchantId: merchant.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { merchantId: merchant.id, settlements, totalNet: settlements.reduce((s,x)=>s+x.merchantNet,0), totalCommission: settlements.reduce((s,x)=>s+x.commissionAmount,0), gross: settlements.reduce((s,x)=>s+x.grossAmount,0) };
  }

  async agentSummary(userId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { userId }, select: { id: true, marketId: true }});
    if (!agent) throw new NotFoundException('Agent not found');
    const settlements = await this.prisma.agentSettlement.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { agentId: agent.id, marketId: agent.marketId, settlements, totalEarning: settlements.reduce((s,x)=>s+x.agentEarning,0), totalMargin: settlements.reduce((s,x)=>s+x.grossMargin,0) };
  }

  async adminMerchant(merchantId: string) {
    const settlements = await this.prisma.merchantSettlement.findMany({ where: { merchantId }, orderBy: { createdAt: 'desc' }, take: 500 });
    return { settlements, gross: settlements.reduce((s,x)=>s+x.grossAmount,0), commission: settlements.reduce((s,x)=>s+x.commissionAmount,0), net: settlements.reduce((s,x)=>s+x.merchantNet,0) };
  }

  async adminAgent(agentId: string) {
    const settlements = await this.prisma.agentSettlement.findMany({ where: { agentId }, orderBy: { createdAt: 'desc' }, take: 500 });
    return { settlements, margin: settlements.reduce((s,x)=>s+x.grossMargin,0), agentEarning: settlements.reduce((s,x)=>s+x.agentEarning,0), zanaEarning: settlements.reduce((s,x)=>s+x.zanaEarning,0) };
  }

  async setAgentRate(actorId: string, rate: number) {
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new BadRequestException('INVALID_AGENT_RATE');
    const before = await this.marketConfig();
    const after = await this.prisma.marketPriceConfig.update({ where: { id: before.id }, data: { agentEarningRate: rate }});
    await this.audit(actorId, 'MARKET_AGENT_RATE_CHANGED', 'MarketPriceConfig', after.id, before, after);
    return after;
  }

  async requestMarketPriceChange(agentUserId: string, productId: string, data: { price?: number; referenceCost?: number; reason?: string }) {
    const agent = await this.prisma.agent.findUnique({ where: { userId: agentUserId }, select: { id: true, marketId: true, active: true }});
    if (!agent?.active || !agent.marketId) throw new BadRequestException('AGENT_NOT_ACTIVE');
    const product = await this.prisma.product.findFirst({ where: { id: productId, marketId: agent.marketId }});
    if (!product) throw new NotFoundException('PRODUCT_NOT_IN_YOUR_MARKET');
    const newPrice = data.price ?? product.price;
    const newReference = data.referenceCost ?? product.referenceCost ?? newPrice;
    if (newPrice <= 0 || newReference <= 0) throw new BadRequestException('INVALID_PRICE');
    const cfg = await this.marketConfig();
    const changePct = Math.abs(newPrice - product.price) / Math.max(1, product.price) * 100;
    if (changePct > cfg.hardRejectPercent) throw new BadRequestException('PRICE_CHANGE_TOO_LARGE');
    const status = changePct <= cfg.autoApprovePercent ? 'APPROVED' : 'PENDING';
    const history = await this.prisma.marketPriceHistory.create({ data: {
      productId, marketId: agent.marketId, oldPrice: product.price, newPrice,
      oldReferenceCost: product.referenceCost, newReferenceCost: newReference,
      changedBy: agentUserId, reason: data.reason, status,
      approvedBy: status === 'APPROVED' ? agentUserId : undefined,
      approvedAt: status === 'APPROVED' ? new Date() : undefined,
    }});
    if (status === 'APPROVED') await this.prisma.product.update({ where: { id: product.id }, data: { price: newPrice, referenceCost: newReference }});
    await this.audit(agentUserId, 'MARKET_PRICE_CHANGE_REQUESTED', 'Product', product.id, product, { history, price: newPrice, referenceCost: newReference });
    return history;
  }

  async reviewMarketPrice(actorId: string, historyId: string, approve: boolean, reason?: string) {
    const history = await this.prisma.marketPriceHistory.findUnique({ where: { id: historyId }, include: { product: true }});
    if (!history) throw new NotFoundException('PRICE_CHANGE_NOT_FOUND');
    if (history.status !== 'PENDING') throw new BadRequestException('PRICE_CHANGE_NOT_PENDING');
    const status = approve ? 'APPROVED' : 'REJECTED';
    return this.prisma.$transaction(async tx => {
      const updated = await tx.marketPriceHistory.update({ where: { id: historyId }, data: { status, approvedBy: actorId, approvedAt: new Date(), reason: reason ?? history.reason }});
      if (approve) await tx.product.update({ where: { id: history.productId }, data: { price: history.newPrice, referenceCost: history.newReferenceCost }});
      await tx.auditLog.create({ data: { actorId, action: `MARKET_PRICE_${status}`, entityType: 'MarketPriceHistory', entityId: historyId, beforeJson: JSON.stringify(history), afterJson: JSON.stringify(updated) }});
      return updated;
    });
  }

  async marketPriceConfig() { return this.marketConfig(); }

  async priceHistory(productId?: string) {
    return this.prisma.marketPriceHistory.findMany({ where: productId ? { productId } : {}, include: { product: true }, orderBy: { createdAt: 'desc' }, take: 500 });
  }

  async pendingPriceChanges() {
    return this.prisma.marketPriceHistory.findMany({ where: { status: 'PENDING' }, include: { product: true }, orderBy: { createdAt: 'asc' }});
  }

  async auditLogs(limit = 200) {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit,1),500) });
  }
}