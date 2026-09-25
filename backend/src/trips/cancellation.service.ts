import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_CANCELLATIONS = 3;
const RESTRICTION_HOURS = 24;

@Injectable()
export class CancellationService {
  constructor(private prisma: PrismaService) {}

  async checkAndRecord(customerId: string, tripId: string, reason?: string) {
    const since = new Date(Date.now() - RESTRICTION_HOURS * 60 * 60 * 1000);
    const recentCancels = await this.prisma.cancellationRecord.count({
      where: { customerId, createdAt: { gte: since } },
    });

    if (recentCancels >= MAX_CANCELLATIONS) {
      throw new ForbiddenException(
        `Account temporarily restricted. You have cancelled ${MAX_CANCELLATIONS} rides in the last 24 hours. Please try again later.`
      );
    }

    await this.prisma.cancellationRecord.create({ data: { customerId, tripId, reason } });
    return { cancellationsToday: recentCancels + 1, remaining: MAX_CANCELLATIONS - recentCancels - 1 };
  }

  async getStatus(customerId: string) {
    const since = new Date(Date.now() - RESTRICTION_HOURS * 60 * 60 * 1000);
    const count = await this.prisma.cancellationRecord.count({ where: { customerId, createdAt: { gte: since } } });
    return { cancellationsToday: count, restricted: count >= MAX_CANCELLATIONS, remaining: Math.max(0, MAX_CANCELLATIONS - count) };
  }
}
