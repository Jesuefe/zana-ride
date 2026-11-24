import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { pointInBoundary } from './service-areas.util';

@Controller('service-areas')
@UseGuards(JwtAuthGuard)
export class ServiceAreasController {
  constructor(private prisma: PrismaService) {}

  // Resolves a GPS point into the active service-zone hierarchy
  // (mini-zone -> main zone -> district/city). Used by the driver app's
  // "Your operating area" card.
  @Get('check')
  async check(@Query('lat') latRaw: string, @Query('lng') lngRaw: string) {
    const lat = Number(latRaw), lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new BadRequestException('LAT_LNG_INVALID');
    }
    const zones = await this.prisma.serviceZone.findMany({ where: { active: true } });
    const containing = zones.filter(z => pointInBoundary(lat, lng, z.boundary));
    // Prefer the most specific (MINI) zone; fall back to a MAIN zone.
    const hit = containing.find(z => z.zoneLevel === 'MINI') ?? containing[0];
    if (!hit) return { serviceable: false, zone: null };
    const parent = hit.parentZoneId ? zones.find(z => z.id === hit.parentZoneId) : hit.zoneLevel === 'MAIN' ? hit : undefined;
    return {
      serviceable: true,
      zone: {
        id: hit.id,
        name: hit.name,
        miniZone: hit.name,
        city: hit.city,
        district: parent?.name ?? null,
        mainZone: parent?.name ?? null,
        parentZoneId: hit.parentZoneId ?? null,
      },
    };
  }
}
