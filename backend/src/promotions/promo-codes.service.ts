import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PromoCodesService {
  constructor(private prisma: PrismaService) {}

  async validate(userId: string, rawCode: string, serviceScope: string, amount: number) {
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!code) throw new BadRequestException('PROMO_CODE_REQUIRED');
    if (!Number.isInteger(amount) || amount < 0) throw new BadRequestException('INVALID_PROMO_AMOUNT');
    const now = new Date();
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo || promo.status !== 'ACTIVE' || promo.startsAt > now || promo.endsAt <= now) throw new BadRequestException('PROMO_CODE_INVALID_OR_EXPIRED');
    if (promo.serviceScope !== 'ALL' && promo.serviceScope !== serviceScope) throw new BadRequestException('PROMO_CODE_NOT_VALID_FOR_THIS_SERVICE');
    if (amount < promo.minSpend) throw new BadRequestException('PROMO_MINIMUM_SPEND_NOT_MET');
    if (promo.fundingSource !== 'ZANA') throw new BadRequestException('PROMO_FUNDING_NOT_YET_CONFIGURED');
    if (promo.maxUses != null && promo.usageCount >= promo.maxUses) throw new BadRequestException('PROMO_USAGE_LIMIT_REACHED');
    const userUses = await this.prisma.promoCodeRedemption.count({ where: { promoCodeId: promo.id, userId, status: { in: ['RESERVED','REDEEMED'] } } });
    if (userUses >= promo.perUserLimit) throw new BadRequestException('PROMO_CUSTOMER_LIMIT_REACHED');
    const rawDiscount = promo.discountType === 'PERCENT' ? Math.floor(amount * promo.discountValue / 100) : promo.discountValue;
    const discountAmount = Math.min(amount, promo.maxDiscount == null ? rawDiscount : Math.min(rawDiscount, promo.maxDiscount));
    if (discountAmount <= 0) throw new BadRequestException('PROMO_DISCOUNT_NOT_APPLICABLE');
    return { promo, discountAmount, originalAmount: amount, payableAmount: amount - discountAmount };
  }

  async reserve(tx: any, input: { promo: any; userId: string; serviceScope: string; originalAmount: number; discountAmount: number; payableAmount: number; tripId?: string; orderId?: string; deliveryId?: string }) {
    const { promo } = input;
    const changed = await tx.promoCode.updateMany({
      where: { id: promo.id, status: 'ACTIVE', startsAt: { lte: new Date() }, endsAt: { gt: new Date() }, ...(promo.maxUses == null ? {} : { usageCount: { lt: promo.maxUses } }) },
      data: { usageCount: { increment: 1 } },
    });
    if (changed.count !== 1) throw new BadRequestException('PROMO_USAGE_LIMIT_REACHED');
    const used = await tx.promoCodeRedemption.count({ where: { promoCodeId: promo.id, userId: input.userId, status: { in: ['RESERVED','REDEEMED'] } } });
    if (used >= promo.perUserLimit) throw new BadRequestException('PROMO_CUSTOMER_LIMIT_REACHED');
    return tx.promoCodeRedemption.create({ data: {
      promoCodeId: promo.id, userId: input.userId, serviceScope: input.serviceScope,
      originalAmount: input.originalAmount, discountAmount: input.discountAmount, payableAmount: input.payableAmount,
      tripId: input.tripId, orderId: input.orderId, deliveryId: input.deliveryId, status: 'RESERVED',
    }});
  }

  async cancelReservation(tripId?: string, orderId?: string, deliveryId?: string) {
    const where = tripId ? { tripId } : orderId ? { orderId } : { deliveryId };
    await this.prisma.$transaction(async tx => {
      const redemption = await tx.promoCodeRedemption.findFirst({ where: { ...where, status: 'RESERVED' } });
      if (!redemption) return;
      await tx.promoCodeRedemption.update({ where: { id: redemption.id }, data: { status: 'CANCELLED' } });
      await tx.promoCode.update({ where: { id: redemption.promoCodeId }, data: { usageCount: { decrement: 1 } } });
    });
  }

  async completeReservation(tripId?: string, orderId?: string, deliveryId?: string) {
    const where = tripId ? { tripId } : orderId ? { orderId } : { deliveryId };
    await this.prisma.promoCodeRedemption.updateMany({ where: { ...where, status: 'RESERVED' }, data: { status: 'REDEEMED' } });
  }
}
