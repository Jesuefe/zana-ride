import { Injectable, NotFoundException, ConflictException, BadGatewayException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../deliveries/storage.service';
import { DriverApprovalStatus, DriverOnlineStatus, ServiceType } from '@prisma/client';

// Matches Uber's own "cash ride limit" concept — a line of credit for
// commissions owed, not an unlimited one. This exact number is a
// genuine business call, not something to treat as settled just
// because it's now enforced — adjust freely.
const MAX_NEGATIVE_BALANCE = -50000;

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // Previously wallet balance and commission debt were two entirely
  // separate numbers — a driver could show a positive "available to
  // withdraw" balance while owing far more in unpaid cash-ride
  // commission, which is genuinely confusing and doesn't match how
  // Uber (or any driver's actual financial position) represents this.
  // One real number: what they'd have if debt were settled right now.
  async getNetBalance(driverId: string): Promise<number> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: { include: { wallet: true } } },
    });
    const walletBalance = driver?.user?.wallet?.balance ?? 0;
    const unpaidDebt = await this.prisma.commissionDebt.aggregate({
      where: { driverId, paidAt: null },
      _sum: { amount: true },
    });
    return walletBalance - (unpaidDebt._sum.amount ?? 0);
  }

  async assertCanGoOnline(driverId: string) {
    const netBalance = await this.getNetBalance(driverId);
    if (netBalance < MAX_NEGATIVE_BALANCE) {
      throw new ForbiddenException(
        `Outstanding balance of ${Math.round(-netBalance).toLocaleString()} RWF exceeds the limit — pay down your balance to go back online.`,
      );
    }
  }

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

  async setOnlineStatus(driverId: string, status: DriverOnlineStatus, sessionId?: string) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: {
        onlineStatus: status,
        // Only ever set going online — going offline leaves whatever
        // session was active alone, since a driver going offline on
        // one device shouldn't silently invalidate a different device
        // that's genuinely the current active one.
        ...(sessionId ? { activeSessionId: sessionId } : {}),
      },
    });
  }

  // Previously any device with a valid token could ping location
  // indefinitely, even after a second device on the same account had
  // gone online — both would silently report position at once, with
  // no way to tell which one a rider or the matching system should
  // actually trust. Now a ping from a session that's been superseded
  // by a newer one is rejected outright, so the app can detect this
  // and force that device offline rather than keep working invisibly
  // alongside another active session.
  async updateLocation(driverId: string, lat: number, lng: number, sessionId?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId }, select: { activeSessionId: true, testOverrideLat: true, testOverrideLng: true } });
    if (sessionId && driver?.activeSessionId && driver.activeSessionId !== sessionId) {
      throw new ForbiddenException('SESSION_SUPERSEDED');
    }
    // Live-testing only: when set on a specific driver, ignores that
    // device's real GPS entirely and reports the configured test
    // coordinates instead — off (null) for every driver by default,
    // so this can never affect a real account unless explicitly
    // configured for it.
    const finalLat = driver?.testOverrideLat ?? lat;
    const finalLng = driver?.testOverrideLng ?? lng;
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { lastLat: finalLat, lastLng: finalLng, lastLocationAt: new Date() },
    });
  }

  async findAll(approvalStatus?: string) {
    return this.prisma.driver.findMany({
      where: approvalStatus ? { approvalStatus: approvalStatus as any } : {},
      include: { user: true, documents: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Previously there was no drill-down at all — the list was the only
  // view of a driver admin ever had, with no way to see their ride
  // history alongside their join date, documents, and stats in one place.
  async getDetail(driverId: string) {
    return this.prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        user: true,
        documents: { orderBy: { createdAt: 'desc' } },
        trips: { orderBy: { requestedAt: 'desc' }, take: 20, include: { customer: { select: { firstName: true } } } },
      },
    });
  }

  async setApprovalStatus(driverId: string, status: DriverApprovalStatus) {
    // Previously only touched approvalStatus — a driver suspended or
    // rejected while already online stayed online and matchable to new
    // rides/deliveries until they happened to go offline themselves.
    // For an admin acting on an active safety concern mid-shift, that
    // gap defeated the entire point of an immediate suspension.
    return this.prisma.driver.update({
      where: { id: driverId },
      data: status === DriverApprovalStatus.APPROVED
        ? { approvalStatus: status }
        : { approvalStatus: status, onlineStatus: DriverOnlineStatus.OFFLINE },
    });
  }

  async updateDriverMode(driverId: string, mode: 'RIDES' | 'DELIVERIES' | 'BOTH') {
    return this.prisma.driver.update({ where: { id: driverId }, data: { driverMode: mode as any } });
  }

  async getEarnings(driverId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: { include: { wallet: true } } },
    });

    const [todayTrips, weekTrips, allTimeTrips, allTimeDeliveries, todayCashTrips, unpaidDebts] = await Promise.all([
      this.prisma.trip.findMany({
        where: { driverId, status: 'RIDE_COMPLETED', completedAt: { gte: startOfToday } },
        select: { finalFare: true, estimatedFare: true },
      }),
      this.prisma.trip.findMany({
        where: { driverId, status: 'RIDE_COMPLETED', completedAt: { gte: startOfWeek } },
        select: { finalFare: true, estimatedFare: true },
      }),
      this.prisma.trip.findMany({
        where: { driverId, status: 'RIDE_COMPLETED' },
        select: { finalFare: true, estimatedFare: true },
      }),
      this.prisma.delivery.count({ where: { driverId, status: 'DELIVERED' } }),
      // Cash collected specifically — this was never surfaced anywhere
      // before. A driver could not previously see how much cash they were
      // actually holding on Zana's behalf, only a single wallet number
      // that mixed everything together.
      this.prisma.trip.findMany({
        where: {
          driverId, status: 'RIDE_COMPLETED', paymentMethod: 'CASH',
          completedAt: { gte: startOfToday },
        },
        select: { finalFare: true, estimatedFare: true },
      }),
      // The debt itself was already tracked correctly on every cash ride —
      // it just had nowhere to actually show up for the driver to see.
      this.prisma.commissionDebt.findMany({
        where: { driverId, paidAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const sum = (trips: { finalFare: number | null; estimatedFare: number }[]) =>
      trips.reduce((total, t) => total + (t.finalFare ?? t.estimatedFare), 0);

    const totalEarnings = sum(allTimeTrips) * 0.85; // after 15% commission

    return {
      todayEarnings: Math.round(sum(todayTrips) * 0.85),
      weekEarnings: Math.round(sum(weekTrips) * 0.85),
      totalEarnings: Math.round(totalEarnings),
      totalTrips: allTimeTrips.length,
      totalDeliveries: allTimeDeliveries,
      walletBalance: driver?.user?.wallet?.balance ?? 0,
      cashCollectedToday: Math.round(sum(todayCashTrips)),
      zanaDue: unpaidDebts.reduce((s, d) => s + d.amount, 0),
      // Previously wallet balance and debt were shown as two separate,
      // seemingly contradictory numbers — a driver could see a
      // positive "available to withdraw" balance right next to a much
      // larger amount owed, which doesn't reflect their actual net
      // financial position. One real number, matching how Uber
      // represents this: what they'd have if debt were settled now.
      netBalance: (driver?.user?.wallet?.balance ?? 0) - unpaidDebts.reduce((s, d) => s + d.amount, 0),
      recentDebts: unpaidDebts.map(d => ({
        id: d.id, amount: d.amount, createdAt: d.createdAt,
      })),
    };
  }

  // Nearby online, approved drivers for the requested service — the basis of the
  // matching engine described in the spec. Upgrade to a PostGIS radius query
  // once the dataset is large enough that a full table scan stops being fine.
  // Widened well beyond a realistic city radius — during development,
  // testers' real GPS locations are often nowhere near the seeded demo
  // driver. Tighten this back to a real city-scale radius (5-10km) before
  // this matters for actual production matching quality.
  /**
   * Drivers available near a point, for the customer's map.
   *
   * Returns only what a map needs. This previously included the whole user
   * record — phone, email and password hash — for every online driver, and
   * defaulted to a 500km radius, so a single call returned every driver in
   * the country. A caller does not need to know who a driver is until one is
   * assigned to their trip.
   */
  async findNearbyAvailable(lat: number, lng: number, serviceType: ServiceType, radiusKm = 5) {
    const capped = Math.min(Math.max(radiusKm, 1), 25);

    const candidates = await this.prisma.driver.findMany({
      where: {
        serviceType,
        approvalStatus: DriverApprovalStatus.APPROVED,
        onlineStatus: DriverOnlineStatus.ONLINE,
        lastLat: { not: null },
        lastLng: { not: null },
      },
      select: {
        id: true,
        userId: true,
        serviceType: true,
        lastLat: true,
        lastLng: true,
        rating: true,
      },
    });

    return candidates
      .map((d) => ({
        id: d.id,
        userId: d.userId,
        serviceType: d.serviceType,
        rating: d.rating,
        // The client draws markers from lat/lng, so return those names
        // rather than the column names.
        lat: d.lastLat!,
        lng: d.lastLng!,
        distanceKm: haversineKm(lat, lng, d.lastLat!, d.lastLng!),
      }))
      .filter((d) => d.distanceKm <= capped)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      // A map only ever draws a handful of markers.
      .slice(0, 20);
  }
  async getCommissionDebts(driverId: string) {
    const debts = await this.prisma.commissionDebt.findMany({
      where: { driverId, paidAt: null },
    });
    return {
      totalDebt: debts.reduce((s: number, d: any) => s + d.amount, 0),
      debtCount: debts.length,
    };
  }

  async logRecoveryEvent(driverId: string, event: string, rideId?: string, rideStatus?: string) {
    // Never let logging itself become a reason the app breaks for a driver.
    try {
      await this.prisma.recoveryEvent.create({
        data: { driverId, event, rideId, rideStatus },
      });
    } catch {}
  }

  // If the app crashes in the moment right after a ride completes but
  // before the driver ever sees a confirmation, the active-ride check on
  // next launch correctly returns nothing — there's no active ride
  // anymore, that part is right — but the driver never actually saw that
  // it worked. Only ever returns something within a couple of minutes of
  // completion, so this can never resurface an old, unrelated ride from
  // earlier the same day as a fake-looking "just completed" notice.
  async getRecentlyCompletedRide(driverId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { driverId, status: 'RIDE_COMPLETED' as any },
      orderBy: { completedAt: 'desc' },
    });
    if (!trip?.completedAt) return null;

    const ageMs = Date.now() - new Date(trip.completedAt).getTime();
    if (ageMs > 2 * 60 * 1000) return null;

    const fare = trip.finalFare ?? trip.estimatedFare;
    return {
      id: trip.id,
      fare,
      paymentMethod: (trip as any).paymentMethod ?? 'CASH',
      // Same 15% used by commission-debt.service.ts — kept as a plain
      // constant there rather than shared config, so mirrored here
      // rather than imported to avoid coupling this read-only summary
      // to that service's internals.
      driverEarnings: Math.round(fare * 0.85),
    };
  }

  // A real, dedicated ride-history endpoint — previously the "Completed"
  // count on the driver's home screen had no way to actually see any of
  // the trips it was counting.
  async getTripHistory(driverId: string, limit = 50) {
    const trips = await this.prisma.trip.findMany({
      where: {
        driverId,
        status: { in: ['RIDE_COMPLETED', 'CUSTOMER_CANCELLED', 'DRIVER_CANCELLED'] as any },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: { customer: { select: { firstName: true, lastName: true } } },
    });

    return trips.map((t) => ({
      id: t.id,
      status: t.status,
      pickupAddress: t.pickupAddress,
      destinationAddress: t.destinationAddress,
      fare: t.finalFare ?? t.estimatedFare,
      customerName: t.customer
        ? [t.customer.firstName, t.customer.lastName].filter(Boolean).join(' ')
        : 'Passenger',
      completedAt: t.completedAt ?? t.requestedAt,
      cancelReason: t.cancelReason,
    }));
  }

  // Same gap as trip history — the "Rating" number on the home screen had
  // no way to see any of the individual reviews behind it.
  async getRatings(driverId: string, limit = 50) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { userId: true, rating: true },
    });
    if (!driver) return { average: 0, count: 0, ratings: [] };

    const ratings = await this.prisma.rating.findMany({
      where: { toUserId: driver.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { fromUser: { select: { firstName: true, lastName: true } } },
    });

    return {
      average: driver.rating,
      count: ratings.length,
      ratings: ratings.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        fromName: r.fromUser
          ? [r.fromUser.firstName, r.fromUser.lastName].filter(Boolean).join(' ')
          : 'Passenger',
        createdAt: r.createdAt,
      })),
    };
  }


  // ── Documents ─────────────────────────────────────────────────────────────
  // A transport platform that dispatches strangers to carry people and their
  // property needs to have seen a licence. Admin was approving drivers blind.

  static readonly REQUIRED_DOCUMENTS = [
    'Driving licence',
    'National ID',
    'Vehicle registration',
    'Insurance certificate',
  ];

  async uploadDocument(userId: string, label: string, imageBase64: string) {
    const driver = await this.findByUserId(userId);
    if (!driver) throw new NotFoundException('Driver profile not found');

    const url = await this.storage.uploadImage(imageBase64, 'driver-documents');
    if (!url) throw new BadGatewayException('DOCUMENT_UPLOAD_FAILED');

    // Re-uploading replaces the old one and resets verification, because a
    // new document has not been checked yet.
    const existing = await this.prisma.driverDocument.findFirst({
      where: { driverId: driver.id, label },
    });

    if (existing) {
      return this.prisma.driverDocument.update({
        where: { id: existing.id },
        data: { fileUrl: url, verified: false },
      });
    }

    return this.prisma.driverDocument.create({
      data: { driverId: driver.id, label, fileUrl: url, verified: false },
    });
  }

  /** What the driver has provided, and what is still outstanding. */
  async myDocuments(userId: string) {
    const driver = await this.findByUserId(userId);
    if (!driver) throw new NotFoundException('Driver profile not found');

    const docs = await this.prisma.driverDocument.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
    });

    const byLabel = new Map<string, any>(docs.map(d => [d.label as string, d as any]));

    return {
      documents: DriversService.REQUIRED_DOCUMENTS.map(label => {
        const d = byLabel.get(label);
        return {
          label,
          fileUrl: d?.fileUrl ?? null,
          verified: d?.verified ?? false,
          uploadedAt: d?.createdAt ?? null,
          status: !d ? 'MISSING' : d.verified ? 'VERIFIED' : 'PENDING',
        };
      }),
      allUploaded: DriversService.REQUIRED_DOCUMENTS.every(l => byLabel.has(l)),
      allVerified: DriversService.REQUIRED_DOCUMENTS.every(l => byLabel.get(l)?.verified),
    };
  }

  async documentsForDriver(driverId: string) {
    return this.prisma.driverDocument.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyDocument(documentId: string, verified: boolean) {
    return this.prisma.driverDocument.update({
      where: { id: documentId },
      data: { verified },
    });
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

// Exported for use in deliveries pricing.
export { haversineKm };
