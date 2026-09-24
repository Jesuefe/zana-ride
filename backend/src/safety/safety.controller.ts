import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('safety')
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private prisma: PrismaService) {}

  @Get('contacts')
  async contacts(@CurrentUser() user: JwtPayload) {
    return this.prisma.emergencyContact.findMany({
      where: { userId: user.sub },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  @Post('contacts')
  async addContact(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; phone: string; relationship?: string; isPrimary?: boolean },
  ) {
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    if (!name || !phone) throw new BadRequestException('Name and phone are required');

    return this.prisma.$transaction(async (tx) => {
      if (body.isPrimary) {
        await tx.emergencyContact.updateMany({
          where: { userId: user.sub, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const hasPrimary = await tx.emergencyContact.findFirst({
        where: { userId: user.sub, isPrimary: true },
        select: { id: true },
      });

      return tx.emergencyContact.create({
        data: {
          userId: user.sub,
          name,
          phone,
          relationship: body.relationship?.trim() || null,
          isPrimary: body.isPrimary === true || !hasPrimary,
        },
      });
    });
  }

  @Patch('contacts/:id')
  async updateContact(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { name?: string; phone?: string; relationship?: string; isPrimary?: boolean },
  ) {
    const existing = await this.prisma.emergencyContact.findFirst({ where: { id, userId: user.sub } });
    if (!existing) throw new ForbiddenException('Emergency contact not found');

    return this.prisma.$transaction(async (tx) => {
      if (body.isPrimary === true) {
        await tx.emergencyContact.updateMany({
          where: { userId: user.sub, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.emergencyContact.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.phone !== undefined ? { phone: body.phone.trim() } : {}),
          ...(body.relationship !== undefined ? { relationship: body.relationship.trim() || null } : {}),
          ...(body.isPrimary !== undefined ? { isPrimary: body.isPrimary } : {}),
        },
      });
    });
  }

  @Delete('contacts/:id')
  async deleteContact(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const existing = await this.prisma.emergencyContact.findFirst({ where: { id, userId: user.sub } });
    if (!existing) throw new ForbiddenException('Emergency contact not found');
    await this.prisma.emergencyContact.delete({ where: { id } });
    return { deleted: true };
  }

  @Post('sos')
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { tripId?: string; lat?: number; lng?: number },
  ) {
    if (body.lat !== undefined && (body.lat < -90 || body.lat > 90)) {
      throw new BadRequestException('Invalid latitude');
    }
    if (body.lng !== undefined && (body.lng < -180 || body.lng > 180)) {
      throw new BadRequestException('Invalid longitude');
    }

    let trip: { id: string; customerId: string; driverUserId: string | null } | null = null;
    if (body.tripId) {
      const found = await this.prisma.trip.findUnique({
        where: { id: body.tripId },
        select: { id: true, customerId: true, driver: { select: { userId: true } } },
      });
      if (!found) return { accepted: false, reason: 'TRIP_NOT_FOUND_OR_NOT_AUTHORIZED' };
      trip = { id: found.id, customerId: found.customerId, driverUserId: found.driver?.userId ?? null };
      if (trip.customerId !== user.sub && trip.driverUserId !== user.sub) {
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

    // Notify the user's primary emergency contact when Twilio is configured.
    // The alert is still accepted if SMS is not configured or the provider fails.
    if (!existing) {
      await this.sendEmergencySms(alert.id, user.sub, alert.lat, alert.lng);
    }

    return {
      accepted: true,
      id: alert.id,
      createdAt: alert.createdAt,
      lat: alert.lat,
      lng: alert.lng,
      smsStatus: (await this.prisma.safetyAlert.findUnique({ where: { id: alert.id }, select: { smsStatus: true } }))?.smsStatus,
    };
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

  private async sendEmergencySms(alertId: string, userId: string, lat: number | null, lng: number | null) {
    const contact = await this.prisma.emergencyContact.findFirst({
      where: { userId, isPrimary: true },
    });
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_PHONE;

    if (!contact) {
      await this.prisma.safetyAlert.update({ where: { id: alertId }, data: { smsStatus: 'NO_PRIMARY_CONTACT' } });
      return;
    }
    if (!sid || !token || !from) {
      await this.prisma.safetyAlert.update({ where: { id: alertId }, data: { smsStatus: 'NOT_CONFIGURED' } });
      return;
    }

    const location = typeof lat === 'number' && typeof lng === 'number'
      ? `https://maps.google.com/?q=${lat},${lng}`
      : 'Location unavailable';
    const message = `ZANA SOS ALERT: An emergency alert was triggered. Time: ${new Date().toISOString()}. Location: ${location}`;

    try {
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const form = new URLSearchParams({ To: contact.phone, From: from, Body: message });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form },
      );
      if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
      await this.prisma.safetyAlert.update({ where: { id: alertId }, data: { smsStatus: 'SENT' } });
    } catch (error) {
      console.error('[SOS SMS]', error);
      await this.prisma.safetyAlert.update({ where: { id: alertId }, data: { smsStatus: 'FAILED' } });
    }
  }
}
