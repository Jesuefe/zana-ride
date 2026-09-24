import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

@Controller('sos')
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { tripId?: string; lat?: number; lng?: number },
  ) {
    if (body.tripId) {
      const trip = await this.prisma.trip.findUnique({
        where: { id: body.tripId },
        select: { id: true, customerId: true, driverId: true },
      });
      if (!trip || (trip.customerId !== user.sub && trip.driverId !== user.sub)) {
        return { accepted: false, reason: 'TRIP_NOT_FOUND_OR_NOT_AUTHORIZED' };
      }
    }

    const existing = await this.prisma.safetyAlert.findFirst({
      where: {
        userId: user.sub,
        tripId: body.tripId ?? null,
        resolved: false,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    const alert = existing
      ? await this.prisma.safetyAlert.update({
          where: { id: existing.id },
          data: {
            lat: typeof body.lat === 'number' ? body.lat : existing.lat,
            lng: typeof body.lng === 'number' ? body.lng : existing.lng,
          },
        })
      : await this.prisma.safetyAlert.create({
          data: {
            userId: user.sub,
            tripId: body.tripId ?? null,
            role: user.role,
            lat: typeof body.lat === 'number' ? body.lat : null,
            lng: typeof body.lng === 'number' ? body.lng : null,
          },
        });

    return { accepted: true, id: alert.id, createdAt: alert.createdAt };
  }
}
