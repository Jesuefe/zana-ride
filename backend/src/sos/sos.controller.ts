import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { ZanaGateway } from '../gateway/zana.gateway';
import { SmsService } from '../common/sms.service';

const sosInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, role: true } },
  trip: {
    include: {
      driver: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      },
    },
  },
} as const;

@Controller('sos')
@UseGuards(JwtAuthGuard)
export class SosController {
  constructor(
    private prisma: PrismaService,
    private gateway: ZanaGateway,
    private sms: SmsService,
  ) {}

  private present<T extends { customer: { role: string } }>(alert: T) {
    return { ...alert, role: alert.customer.role };
  }

  // A customer or driver can trigger SOS. The authenticated account is the reporter.
  @Post()
  async trigger(
    @CurrentUser() user: JwtPayload,
    @Body() body: { tripId?: string; lat?: number; lng?: number },
  ) {
    if (body.lat !== undefined && (body.lat < -90 || body.lat > 90)) throw new BadRequestException('Invalid latitude');
    if (body.lng !== undefined && (body.lng < -180 || body.lng > 180)) throw new BadRequestException('Invalid longitude');

    const alert = await this.prisma.sosAlert.create({
      data: {
        customerId: user.sub,
        tripId: body.tripId,
        lat: body.lat,
        lng: body.lng,
        status: 'ACTIVE',
      },
      include: sosInclude,
    });

    const name = [alert.customer?.firstName, alert.customer?.lastName].filter(Boolean).join(' ') || 'A user';
    const mapUrl = body.lat != null && body.lng != null
      ? `https://maps.google.com/?q=${body.lat},${body.lng}`
      : null;

    // Persist an audit event before notifying responders. Existing AuditLog table
    // is deliberately reused so no production schema migration is needed.
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'SOS_TRIGGERED',
        entityType: 'SOS_ALERT',
        entityId: alert.id,
        afterJson: JSON.stringify({ status: alert.status, lat: alert.lat, lng: alert.lng, tripId: alert.tripId }),
      },
    });

    try {
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, phone: true } });
      const payload = {
        id: alert.id,
        alertId: alert.id,
        alert: this.present(alert),
        role: alert.customer.role,
        customerName: name,
        customerPhone: alert.customer?.phone,
        tripId: alert.tripId,
        lat: alert.lat,
        lng: alert.lng,
        mapUrl,
        at: alert.createdAt.toISOString(),
      };
      for (const admin of admins) this.gateway.sendToUser(admin.id, 'sos:alert', payload);
      const smsText = `ZANA SOS: ${name} (${alert.customer?.phone ?? 'no phone'}) triggered an emergency alert. ${mapUrl ?? 'Location unavailable'}`;
      await Promise.all(admins.filter(a => a.phone).map(a => this.sms.send(a.phone!, smsText).catch(() => undefined)));
      console.error(`[SOS] ALERT ${alert.id} | ${name} | ${mapUrl ?? 'location unavailable'}`);
    } catch (error: any) {
      // The alert is already durable in PostgreSQL. Fan-out failure must not
      // make the caller believe the emergency was not recorded.
      console.error('[SOS] Alert fan-out failed:', error?.message);
    }

    return this.present(alert);
  }

  // Open queue deliberately includes ACKNOWLEDGED alerts. Acknowledgement is
  // not resolution and must never remove an emergency from the operators' queue.
  @Get('active')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getActive(@Query('status') status?: string) {
    const allowed = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];
    if (status && status !== 'ALL' && !allowed.includes(status)) throw new BadRequestException('Invalid status filter');
    const where = status === 'ALL' ? {} : status ? { status } : { status: { not: 'RESOLVED' } };
    const alerts = await this.prisma.sosAlert.findMany({
      where,
      include: sosInclude,
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
    return alerts.map(alert => this.present(alert));
  }

  @Get(':id/events')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getEvents(@Param('id') id: string) {
    const alert = await this.prisma.sosAlert.findUnique({ where: { id }, select: { id: true } });
    if (!alert) throw new NotFoundException('SOS incident not found');
    const events = await this.prisma.auditLog.findMany({
      where: { entityType: 'SOS_ALERT', entityId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const actorIds = [...new Set(events.map(event => event.actorId).filter((value): value is string => Boolean(value)))];
    const actors = actorIds.length ? await this.prisma.user.findMany({
      where: { id: { in: actorIds } }, select: { id: true, firstName: true, lastName: true, phone: true, role: true },
    }) : [];
    const actorMap = new Map(actors.map(actor => [actor.id, actor]));
    return events.map(event => ({ ...event, actor: event.actorId ? actorMap.get(event.actorId) ?? null : null }));
  }

  @Patch(':id/acknowledge')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async acknowledge(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() body: { note?: string }) {
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 2000) : '';
    const current = await this.prisma.sosAlert.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('SOS incident not found');
    if (current.status === 'RESOLVED') throw new BadRequestException('Resolved incidents cannot be acknowledged again');
    if (current.status === 'ACKNOWLEDGED') return this.prisma.sosAlert.findUnique({ where: { id }, include: sosInclude }).then(a => this.present(a!));

    const updated = await this.prisma.$transaction(async tx => {
      const alert = await tx.sosAlert.update({ where: { id }, data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }, include: sosInclude });
      await tx.auditLog.create({
        data: { actorId: user.sub, action: 'SOS_ACKNOWLEDGED', entityType: 'SOS_ALERT', entityId: id,
          beforeJson: JSON.stringify({ status: current.status }),
          afterJson: JSON.stringify({ status: alert.status, acknowledgedAt: alert.acknowledgedAt, note: note || null }) },
      });
      return alert;
    });
    this.broadcastStatus(id, updated.status, user.sub);
    return this.present(updated);
  }

  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async resolve(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() body: { note?: string }) {
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 2000) : '';
    const current = await this.prisma.sosAlert.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('SOS incident not found');
    if (current.status === 'RESOLVED') return this.prisma.sosAlert.findUnique({ where: { id }, include: sosInclude }).then(a => this.present(a!));

    const updated = await this.prisma.$transaction(async tx => {
      const alert = await tx.sosAlert.update({ where: { id }, data: { status: 'RESOLVED' }, include: sosInclude });
      await tx.auditLog.create({
        data: { actorId: user.sub, action: 'SOS_RESOLVED', entityType: 'SOS_ALERT', entityId: id,
          beforeJson: JSON.stringify({ status: current.status }),
          afterJson: JSON.stringify({ status: alert.status, resolvedAt: new Date().toISOString(), note: note || null }) },
      });
      return alert;
    });
    this.broadcastStatus(id, updated.status, user.sub);
    return this.present(updated);
  }

  private async broadcastStatus(alertId: string, status: string, actorId: string) {
    try {
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
      const payload = { id: alertId, alertId, status, actorId, at: new Date().toISOString() };
      for (const admin of admins) this.gateway.sendToUser(admin.id, 'sos:status', payload);
    } catch (error: any) {
      console.error('[SOS] Status broadcast failed:', error?.message);
    }
  }
}
