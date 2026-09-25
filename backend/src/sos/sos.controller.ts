import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { ZanaGateway } from '../gateway/zana.gateway';
import { SmsService } from '../common/sms.service';

@Controller('sos')
@UseGuards(JwtAuthGuard)
export class SosController {
  constructor(
    private prisma: PrismaService,
    private gateway: ZanaGateway,
    private sms: SmsService,
  ) {}

  // Customer triggers SOS
  @Post()
  async trigger(
    @CurrentUser() user: JwtPayload,
    @Body() body: { tripId?: string; lat?: number; lng?: number },
  ) {
    const alert = await this.prisma.sosAlert.create({
      data: {
        customerId: user.sub,
        tripId: body.tripId,
        lat: body.lat,
        lng: body.lng,
        status: 'ACTIVE',
      },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        trip: {
          include: {
            driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
          },
        },
      },
    });

    // An SOS that only writes a database row is useless. Push it to every
    // admin in real time and send an SMS so it lands even if nobody is
    // looking at the dashboard.
    const name = [alert.customer?.firstName, alert.customer?.lastName]
      .filter(Boolean).join(' ') || 'A customer';
    const where = body.lat && body.lng
      ? `https://maps.google.com/?q=${body.lat},${body.lng}`
      : 'location unavailable';

    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN' }, select: { id: true, phone: true },
      });

      for (const admin of admins) {
        this.gateway.sendToUser(admin.id, 'sos:alert', {
          alertId: alert.id,
          customerName: name,
          customerPhone: alert.customer?.phone,
          tripId: body.tripId,
          lat: body.lat,
          lng: body.lng,
          mapUrl: where,
          at: new Date().toISOString(),
        });
      }

      const text = `ZANA SOS: ${name} (${alert.customer?.phone ?? 'no phone'}) triggered an emergency alert. ${where}`;
      await Promise.all(
        admins
          .filter(a => a.phone)
          .map(a => this.sms.send(a.phone!, text).catch(() => {})),
      );

      console.error(`[SOS] ALERT ${alert.id} | ${name} | ${where}`);
    } catch (e: any) {
      console.error('[SOS] Alert fan-out failed:', e?.message);
    }

    return alert;
  }

  // Safety team polls for active alerts
  @Get('active')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getActive() {
    return this.prisma.sosAlert.findMany({
      where: { status: 'ACTIVE' },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        trip: {
          include: {
            driver: {
              include: {
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Safety team acknowledges alert
  @Patch(':id/acknowledge')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async acknowledge(@Param('id') id: string) {
    return this.prisma.sosAlert.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    });
  }

  // Safety team resolves alert
  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async resolve(@Param('id') id: string) {
    return this.prisma.sosAlert.update({
      where: { id },
      data: { status: 'RESOLVED' },
    });
  }
}
