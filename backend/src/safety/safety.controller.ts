import { Body, Controller, Get, Param, Patch, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';

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
            role: user.role as UserRole,
            lat: typeof body.lat === 'number' ? body.lat : null,
            lng: typeof body.lng === 'number' ? body.lng : null,
          },
        });

    return { accepted: true, id: alert.id, createdAt: alert.createdAt };
  }

  @Get('active')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async active(@CurrentUser() user: JwtPayload) {
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    const alerts = await this.prisma.safetyAlert.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        trip: {
          select: {
            pickupAddress: true, destinationAddress: true,
            pickupLat: true, pickupLng: true, estimatedFare: true,
            driver: {
              select: {
                vehicle: true, plate: true, lastLat: true, lastLng: true,
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
      },
    });

    return alerts.map(alert => ({
      ...alert,
      status: alert.resolved ? 'RESOLVED' : alert.acknowledgedAt ? 'ACKNOWLEDGED' : 'ACTIVE',
      customer: alert.user,
    }));
  }

  @Patch(':id/acknowledge')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async acknowledge(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    return this.prisma.safetyAlert.update({
      where: { id },
      data: { acknowledgedAt: new Date() },
    });
  }

  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async resolve(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    return this.prisma.safetyAlert.update({
      where: { id },
      data: { resolved: true },
    });
  }
}
