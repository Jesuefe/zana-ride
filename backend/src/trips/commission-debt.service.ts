import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SAFETY_POOL = 5000; // RWF — drivers always keep this minimum
const COMMISSION_RATE = 0.15;

type Source = { tripId: string } | { deliveryId: string };

@Injectable()
export class CommissionDebtService {
  constructor(private prisma: PrismaService) {}

  // Shared by both trips and deliveries — the spec was explicit that
  // deliveries must reuse the exact same financial engine rather than a
  // second, parallel one, so this is the one place cash-vs-digital
  // commission handling actually happens. tripId/deliveryId branch only
  // the couple of lines that decide which foreign key gets written.
  private async settleCommission(source: Source, fare: number, driverId: string, paymentMethod: string) {
    const commission = Math.round(fare * COMMISSION_RATE);
    const driverCut = fare - commission;

    // Claim this trip/delivery's commission BEFORE touching any wallet
    // balance — relying on the unique constraint on tripId/deliveryId to
    // guarantee only one caller ever wins, the rest see a unique-
    // constraint violation and back off untouched. This didn't matter
    // when this method only ever ran once, at unconditional completion.
    // It matters now that MoMo settlement runs from checkMomoStatus,
    // which the frontend polls repeatedly every few seconds — without
    // this, an overlapping poll could credit the same ride twice.
    try {
      if ('tripId' in source) {
        await this.prisma.commission.create({
          data: { tripId: source.tripId, amount: commission, ratePercent: 15, walletCoveredAmount: 0, debtCreatedAmount: 0 },
        });
      } else {
        await this.prisma.commission.create({
          data: { deliveryId: source.deliveryId, amount: commission, ratePercent: 15, walletCoveredAmount: 0, debtCreatedAmount: 0 },
        });
      }
    } catch (e: any) {
      if (e?.code === 'P2002') return; // Already settled by another call — nothing to do.
      throw e;
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: { include: { wallet: true } } },
    });
    if (!driver?.user?.wallet) return;

    const wallet = driver.user.wallet;

    let walletCoveredAmount = 0;
    let debtCreatedAmount = 0;

    if (paymentMethod === 'CASH') {
      const availableAboveSafety = Math.max(0, wallet.balance - SAFETY_POOL);
      const canDeduct = Math.min(commission, availableAboveSafety);
      const debt = commission - canDeduct;
      walletCoveredAmount = canDeduct;
      debtCreatedAmount = debt;

      if (canDeduct > 0) {
        await this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: canDeduct } },
        });
      }

      if (debt > 0) {
        await this.prisma.commissionDebt.create({
          data: { driverId, amount: debt, ...source },
        });
      }
    } else {
      const unpaidDebts = await this.prisma.commissionDebt.findMany({
        where: { driverId, paidAt: null },
        orderBy: { createdAt: 'asc' },
      });

      let remaining = driverCut;
      for (const debt of unpaidDebts) {
        if (remaining <= 0) break;
        const settle = Math.min(debt.amount, remaining);
        remaining -= settle;
        await this.prisma.commissionDebt.update({
          where: { id: debt.id },
          data: { paidAt: new Date(), settledVia: 'AUTO' },
        });
      }

      if (remaining > 0) {
        await this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: remaining } },
        });
      }
    }

    if ('tripId' in source) {
      await this.prisma.commission.update({
        where: { tripId: source.tripId },
        data: { walletCoveredAmount, debtCreatedAmount },
      });
    } else {
      await this.prisma.commission.update({
        where: { deliveryId: source.deliveryId },
        data: { walletCoveredAmount, debtCreatedAmount },
      });
    }

    return { commission, driverEarnings: driverCut, walletCoveredAmount, debtCreatedAmount };
  }

  async handleTripCompletion(tripId: string, fare: number, driverId: string, paymentMethod: string) {
    return this.settleCommission({ tripId }, fare, driverId, paymentMethod);
  }

  async handleDeliveryCompletion(deliveryId: string, fare: number, driverId: string, paymentMethod: string) {
    return this.settleCommission({ deliveryId }, fare, driverId, paymentMethod);
  }

  async getDriverDebtSummary(driverId: string) {
    const debts = await this.prisma.commissionDebt.findMany({
      where: { driverId, paidAt: null },
    });
    return {
      totalDebt: debts.reduce((s, d) => s + d.amount, 0),
      debtCount: debts.length,
    };
  }
}
