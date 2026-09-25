import { Cron, CronExpression } from '@nestjs/schedule';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ZanaGateway } from '../gateway/zana.gateway';
import { haversineKm } from './fare.util';

export const SPECIAL_REQUESTS = [
  'Airport Drop-off', 'Airport Pick-up', 'Bank Visit', 'Hospital',
  'Hotel', 'Wedding', 'Shopping Trip', 'School Run', 'Custom',
];

@Injectable()
export class ScheduledRideService {
  private readonly logger = new Logger(ScheduledRideService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: ZanaGateway,
  ) {}

  async create(customerId: string, data: {
    pickupAddress: string; pickupLat: number; pickupLng: number;
    destinationAddress: string; destinationLat: number; destinationLng: number;
    serviceType: string; scheduledFor: Date; specialRequest?: string; paymentMethod?: string;
  }) {
    const maxTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (data.scheduledFor > maxTime) throw new BadRequestException('Maximum 24 hours ahead');
    if (data.scheduledFor < new Date(Date.now() + 30 * 60 * 1000)) throw new BadRequestException('Must be at least 30 minutes from now');

    return this.prisma.scheduledRide.create({
      data: { customerId, ...data, serviceType: data.serviceType as any, paymentMethod: data.paymentMethod ?? 'CASH' },
    });
  }

  async getMyScheduled(customerId: string) {
    return this.prisma.scheduledRide.findMany({
      where: { customerId, status: { in: ['PENDING', 'NOTIFYING', 'ACCEPTED'] } },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async cancel(id: string, customerId: string) {
    return this.prisma.scheduledRide.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Runs every minute. Forty-five minutes before a scheduled ride we flip it
   * to NOTIFYING, tell the customer it is coming, and alert nearby drivers so
   * someone can plan to be there. Without this the whole feature is inert.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndNotify() {
    const now = new Date();
    const in45 = new Date(now.getTime() + 45 * 60 * 1000);

    const rides = await this.prisma.scheduledRide.findMany({
      where: { status: 'PENDING', scheduledFor: { gte: now, lte: in45 } },
    });

    if (rides.length === 0) return [];

    for (const ride of rides) {
      await this.prisma.scheduledRide.update({
        where: { id: ride.id }, data: { status: 'NOTIFYING' },
      });

      const minutesAway = Math.round(
        (new Date(ride.scheduledFor).getTime() - now.getTime()) / 60000,
      );

      // Let the customer know we are looking for their driver.
      this.gateway.sendToUser(ride.customerId, 'scheduled:approaching', {
        scheduledRideId: ride.id,
        scheduledFor: ride.scheduledFor,
        minutesAway,
        pickupAddress: ride.pickupAddress,
      });

      // Offer it to drivers who are online and free.
      const drivers = await this.prisma.driver.findMany({
        where: { onlineStatus: 'ONLINE', approvalStatus: 'APPROVED' },
        select: { userId: true, lastLat: true, lastLng: true },
      });

      for (const d of drivers) {
        // Only bother drivers within a sensible radius of the pickup.
        if (d.lastLat != null && d.lastLng != null) {
          const km = haversineKm(d.lastLat, d.lastLng, ride.pickupLat, ride.pickupLng);
          if (km > 12) continue;
        }
        this.gateway.sendToUser(d.userId, 'scheduled:available', {
          scheduledRideId: ride.id,
          pickupAddress: ride.pickupAddress,
          destinationAddress: ride.destinationAddress,
          scheduledFor: ride.scheduledFor,
          minutesAway,
        });
      }

      this.logger.log(
        `[SCHEDULED] ${ride.id} in ${minutesAway} min — ${drivers.length} drivers notified`,
      );
    }

    return rides;
  }

  /**
   * Anything still unclaimed once its time has passed is marked missed, so
   * the list does not fill with ghosts.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStaleScheduled() {
    const cutoff = new Date(Date.now() - 20 * 60 * 1000);
    const stale = await this.prisma.scheduledRide.findMany({
      where: { status: { in: ['PENDING', 'NOTIFYING'] }, scheduledFor: { lt: cutoff } },
    });

    for (const ride of stale) {
      await this.prisma.scheduledRide.update({
        where: { id: ride.id }, data: { status: 'EXPIRED' },
      });
      this.gateway.sendToUser(ride.customerId, 'scheduled:expired', {
        scheduledRideId: ride.id,
      });
    }

    if (stale.length) this.logger.log(`[SCHEDULED] ${stale.length} expired`);
    return stale;
  }
}
