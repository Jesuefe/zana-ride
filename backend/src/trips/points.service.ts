import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const POINTS_PER_100_RWF_RIDE = 1;
const POINTS_PER_200_RWF_DELIVERY = 1;
const FIRST_RIDE_BONUS = 5;
const RATING_BONUS = 2;
const POINTS_TO_RWF = 5; // 100 points = 500 RWF (each point = 5 RWF)
const MIN_REDEEM = 100;

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService) {}

  private async ensureWallet(userId: string) {
    return this.prisma.zanaPoints.upsert({
      where: { userId },
      create: { userId, balance: 0, totalEarned: 0 },
      update: {},
    });
  }

  async earnForRide(userId: string, fare: number, tripId: string) {
    const wallet = await this.ensureWallet(userId);
    const isFirstRide = await this.prisma.trip.count({ where: { customerId: userId, status: 'RIDE_COMPLETED' } }) === 1;
    const earned = Math.floor(fare / 100) * POINTS_PER_100_RWF_RIDE + (isFirstRide ? FIRST_RIDE_BONUS : 0);
    if (earned === 0) return;
    await this.prisma.zanaPoints.update({
      where: { userId },
      data: { balance: { increment: earned }, totalEarned: { increment: earned } },
    });
    await this.prisma.pointTransaction.create({
      data: { pointsId: wallet.id, amount: earned, reason: isFirstRide ? 'first_ride' : 'ride', tripId },
    });
    return earned;
  }

  async earnForRating(userId: string) {
    const wallet = await this.ensureWallet(userId);
    await this.prisma.zanaPoints.update({
      where: { userId },
      data: { balance: { increment: RATING_BONUS }, totalEarned: { increment: RATING_BONUS } },
    });
    await this.prisma.pointTransaction.create({
      data: { pointsId: wallet.id, amount: RATING_BONUS, reason: 'rating_bonus' },
    });
  }

  async getBalance(userId: string) {
    const wallet = await this.prisma.zanaPoints.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!wallet) return { balance: 0, totalEarned: 0, rwfValue: 0, transactions: [] };
    return {
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      rwfValue: wallet.balance * POINTS_TO_RWF,
      transactions: wallet.transactions,
    };
  }

  async redeem(userId: string, points: number) {
    const wallet = await this.ensureWallet(userId);
    if (points < MIN_REDEEM) throw new Error(`Minimum redemption is ${MIN_REDEEM} points`);

    // This is the guard that actually matters: two redeem requests racing
    // for the same points balance previously could both pass a stale
    // "do I have enough points" check and both proceed — each one crediting
    // real RWF to the wallet for points that only existed once. The WHERE
    // clause below is checked by Postgres as part of the same atomic
    // statement as the decrement, so the second request re-evaluates it
    // against whatever the points balance actually is by then.
    const claimed = await this.prisma.zanaPoints.updateMany({
      where: { userId, balance: { gte: points } },
      data: { balance: { decrement: points } },
    });
    if (claimed.count === 0) throw new Error('Insufficient points balance');

    const rwf = points * POINTS_TO_RWF;
    await this.prisma.pointTransaction.create({
      data: { pointsId: wallet.id, amount: -points, reason: 'redemption' },
    });
    // Credit wallet with RWF
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } });
    if (user?.wallet) {
      await this.prisma.wallet.update({ where: { id: user.wallet.id }, data: { balance: { increment: rwf } } });
    }
    return { pointsRedeemed: points, rwfCredited: rwf };
  }
}
