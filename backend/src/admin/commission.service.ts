import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Zana takes 15% of all revenue on the platform — rides, deliveries, and orders.
const COMMISSION_RATE = 0.15;

@Injectable()
export class CommissionService {
  constructor(private prisma: PrismaService) {}

  async recordTripCommission(tripId: string, fare: number, driverId?: string) {
    const existing = await this.prisma.commission.findUnique({ where: { tripId } });
    if (existing) return existing;
    const amount = Math.round(fare * COMMISSION_RATE);
    const commission = await this.prisma.commission.create({
      data: { tripId, amount, ratePercent: COMMISSION_RATE * 100 },
    });
    // Credit driver's wallet with their 85% cut.
    if (driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: driverId }, include: { user: { include: { wallet: true } } } });
      if (driver?.user?.wallet) {
        await this.prisma.wallet.update({
          where: { id: driver.user.wallet.id },
          data: { balance: { increment: fare - amount } },
        });
      }
    }
    return commission;
  }

  async recordDeliveryCommission(deliveryId: string, fee: number, driverId?: string) {
    const existing = await this.prisma.commission.findUnique({ where: { deliveryId } });
    if (existing) return existing;
    const amount = Math.round(fee * COMMISSION_RATE);
    const commission = await this.prisma.commission.create({
      data: { deliveryId, amount, ratePercent: COMMISSION_RATE * 100 },
    });
    if (driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: driverId }, include: { user: { include: { wallet: true } } } });
      if (driver?.user?.wallet) {
        await this.prisma.wallet.update({
          where: { id: driver.user.wallet.id },
          data: { balance: { increment: fee - amount } },
        });
      }
    }
    return commission;
  }

  async getSummary() {
    const commissions = await this.prisma.commission.findMany();
    return {
      totalCommission: commissions.reduce((s, c) => s + c.amount, 0),
      rideCommission: commissions.filter(c => c.tripId).reduce((s, c) => s + c.amount, 0),
      deliveryCommission: commissions.filter(c => c.deliveryId).reduce((s, c) => s + c.amount, 0),
      rideCount: commissions.filter(c => c.tripId).length,
      deliveryCount: commissions.filter(c => c.deliveryId).length,
    };
  }

  async getAll() {
    return this.prisma.commission.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
