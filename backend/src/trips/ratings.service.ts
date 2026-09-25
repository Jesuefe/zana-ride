import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from './points.service';

@Injectable()
export class RatingsService {
  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  async rateTrip(data: {
    tripId: string;
    raterId: string;
    raterRole: 'CUSTOMER' | 'DRIVER';
    score: number;
    comment?: string;
  }) {
    if (data.score < 1 || data.score > 5) throw new BadRequestException('Score must be 1-5');

    const trip = await this.prisma.trip.findUnique({
      where: { id: data.tripId },
      include: { driver: { include: { user: true } } },
    });
    if (!trip) throw new BadRequestException('Trip not found');
    if (trip.status !== 'RIDE_COMPLETED') throw new BadRequestException('Trip not completed');

    const toUserId = data.raterRole === 'CUSTOMER' ? trip.driver!.user.id : trip.customerId;

    const existing = await this.prisma.rating.findFirst({
      where: { tripId: data.tripId, fromUserId: data.raterId },
    });
    if (existing) throw new BadRequestException('Already rated this trip');

    const rating = await this.prisma.rating.create({
      data: {
        tripId: data.tripId,
        fromUserId: data.raterId,
        toUserId,
        rating: data.score,
        comment: data.comment,
        raterRole: data.raterRole,
      },
    });

    // Update driver average rating
    if (data.raterRole === 'CUSTOMER' && trip.driver) {
      const allRatings = await this.prisma.rating.findMany({
        where: { toUserId, raterRole: 'CUSTOMER' },
      });
      const avg = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length;
      await this.prisma.driver.update({
        where: { id: trip.driver.id },
        data: { rating: Math.round(avg * 10) / 10 },
      });
    }

    // Award 2 bonus points to customer for rating
    if (data.raterRole === 'CUSTOMER') {
      this.pointsService.earnForRating(data.raterId).catch(() => {});
    }

    return rating;
  }

  async getDriverStats(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: { select: { firstName: true, createdAt: true } } },
    });
    const totalTrips = await this.prisma.trip.count({
      where: { driverId, status: 'RIDE_COMPLETED' },
    });
    const totalDeliveries = await this.prisma.delivery.count({
      where: { driverId, status: 'DELIVERED' },
    });
    const recentRatings = await this.prisma.rating.findMany({
      where: { toUserId: driver!.userId, raterRole: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { fromUser: { select: { firstName: true } } },
    });

    return {
      rating: driver!.rating,
      totalTrips,
      totalDeliveries,
      memberSince: driver!.user.createdAt,
      recentRatings: recentRatings.map(r => ({
        score: r.rating,
        comment: r.comment,
        rater: { firstName: r.fromUser.firstName },
      })),
    };
  }

  async getPendingRating(userId: string) {
    return this.prisma.trip.findFirst({
      where: {
        status: 'RIDE_COMPLETED',
        OR: [{ customerId: userId }, { driver: { userId } }],
        ratings: { none: { fromUserId: userId } },
        completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: {
        driver: { include: { user: { select: { firstName: true } } } },
        customer: { select: { firstName: true } },
      },
      orderBy: { completedAt: 'desc' },
    });
  }
}
