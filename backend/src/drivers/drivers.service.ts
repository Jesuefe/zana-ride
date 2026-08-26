import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriverApprovalStatus, DriverOnlineStatus, ServiceType } from '@prisma/client';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async register(userId: string, data: { vehicle: string; plate: string; serviceType: ServiceType }) {
    const existing = await this.prisma.driver.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Driver profile already exists for this user');

    return this.prisma.driver.create({
      data: { userId, ...data, approvalStatus: DriverApprovalStatus.PENDING },
    });
  }

  async findByUserId(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { documents: true, user: true },
    });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  async setOnlineStatus(driverId: string, status: DriverOnlineStatus) {
    return this.prisma.driver.update({ where: { id: driverId }, data: { onlineStatus: status } });
  }

  async updateLocation(driverId: string, lat: number, lng: number) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
    });
  }

  async findAll() {
    return this.prisma.driver.findMany({
      include: { user: true, documents: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setApprovalStatus(driverId: string, status: DriverApprovalStatus) {
    return this.prisma.driver.update({ where: { id: driverId }, data: { approvalStatus: status } });
  }

  // Nearby online, approved drivers for the requested service — the basis of the
  // matching engine described in the spec. Upgrade to a PostGIS radius query
  // once the dataset is large enough that a full table scan stops being fine.
  async findNearbyAvailable(lat: number, lng: number, serviceType: ServiceType, radiusKm = 5) {
    const candidates = await this.prisma.driver.findMany({
      where: {
        serviceType,
        approvalStatus: DriverApprovalStatus.APPROVED,
        onlineStatus: DriverOnlineStatus.ONLINE,
        lastLat: { not: null },
        lastLng: { not: null },
      },
      include: { user: true },
    });

    return candidates
      .map((d) => ({ ...d, distanceKm: haversineKm(lat, lng, d.lastLat!, d.lastLng!) }))
      .filter((d) => d.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}
