import { Injectable, NotFoundException, ConflictException, BadGatewayException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../deliveries/storage.service';
import { DriverApprovalStatus, DriverOnlineStatus, ServiceType } from '@prisma/client';
import { ZanaGateway } from '../gateway/zana.gateway';

const DRIVER_ONLINE_IDLE_TIMEOUT_MS = 60 * 60 * 1000;

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
    private gateway: ZanaGateway,
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
    const [netBalance, vehicleCount, approvedVehicleCount] = await Promise.all([
      this.getNetBalance(driverId),
      this.prisma.driverVehicle.count({ where: { driverId } }),
      this.prisma.driverVehicle.count({ where: { driverId, status: 'APPROVED' } }),
    ]);
    if (vehicleCount > 0 && approvedVehicleCount === 0) {
      throw new ForbiddenException('NO_APPROVED_VEHICLE');
    }
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
    if (status === DriverOnlineStatus.OFFLINE) {
      // OFFLINE is an explicit driver action and must take effect immediately.
      // Do not let an old session, stale GPS, or a missing session id block it.
      return this.prisma.driver.update({
        where: { id: driverId },
        data: { onlineStatus: DriverOnlineStatus.OFFLINE, activeSessionId: null },
      });
    }

    return this.prisma.driver.update({
      where: { id: driverId },
      data: {
        onlineStatus: status,
        ...(status === DriverOnlineStatus.ONLINE ? { lastLocationAt: new Date() } : {}),
        ...(sessionId ? { activeSessionId: sessionId } : {}),
      },
    });
  }

  // Online status is intentionally not tied to a short GPS freshness window.
  // A driver can temporarily lose GPS/network and remain online. We only
  // expire an online driver after 60 minutes without any accepted location
  // activity, which gives normal connectivity/GPS interruptions plenty of room.
  @Interval(60_000)
  async expireIdleOnlineDrivers() {
    const cutoff = new Date(Date.now() - DRIVER_ONLINE_IDLE_TIMEOUT_MS);
    await this.prisma.driver.updateMany({
      where: {
        onlineStatus: DriverOnlineStatus.ONLINE,
        OR: [
          { lastLocationAt: null },
          { lastLocationAt: { lt: cutoff } },
        ],
      },
      data: { onlineStatus: DriverOnlineStatus.OFFLINE, activeSessionId: null },
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
    const updated = await this.prisma.driver.update({
      where: { id: driverId },
      data: { lastLat: finalLat, lastLng: finalLng, lastLocationAt: new Date() },
    });

    // Every accepted driver location update is also a live tracking event.
    // This is what makes the customer/merchant/admin delivery maps move in
    // real time, and it also lets the driver's own app reflect the admin
    // Test Lab override immediately without waiting for physical GPS.
    const activeDeliveries = await this.prisma.delivery.findMany({
      where: { driverId, status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } },
      select: { id: true, trackingCode: true, status: true, customerId: true },
    });
    for (const delivery of activeDeliveries) {
      const payload = {
        deliveryId: delivery.id,
        trackingCode: delivery.trackingCode,
        status: delivery.status,
        lat: finalLat,
        lng: finalLng,
        at: new Date().toISOString(),
      };
      if (delivery.customerId) this.gateway.sendToUser(delivery.customerId, 'delivery:position', payload);
    }

    // The driver's own client listens for this too. In particular, an admin
    // Test Lab move reaches the driver's map even when the real phone GPS is
    // somewhere else.
    const positionEvent = {
      driverId,
      lat: finalLat,
      lng: finalLng,
      testOverride: driver?.testOverrideLat != null && driver?.testOverrideLng != null,
      at: new Date().toISOString(),
    };
    this.gateway.sendToUser(updated.userId, 'driver:position', positionEvent);
    this.gateway.sendToAdmins('admin:driver-position', positionEvent);

    return updated;
  }

  async findAll(approvalStatus?: string) {
    return this.prisma.driver.findMany({
      where: approvalStatus ? { approvalStatus: approvalStatus as any } : {},
      include: { user: true, documents: { where: { supersededAt: null }, orderBy: { createdAt: 'desc' } }, vehicles: { include: { documents: { where: { supersededAt: null }, orderBy: { createdAt: 'desc' } } } } },
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
        vehicles: { include: { documents: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } },
        trips: { orderBy: { requestedAt: 'desc' }, take: 20, include: { customer: { select: { firstName: true } } } },
      },
    });
  }

  async setApprovalStatus(driverId: string, status: DriverApprovalStatus, actorId?: string, reason?: string) {
    const current = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!current) throw new NotFoundException('Driver not found.');
    if (status === DriverApprovalStatus.APPROVED) {
      const [vehicleCount, approvedVehicleCount, driverDocs] = await Promise.all([
        this.prisma.driverVehicle.count({ where: { driverId } }),
        this.prisma.driverVehicle.count({ where: { driverId, status: 'APPROVED' } }),
        this.prisma.driverDocument.findMany({ where: { driverId, vehicleId: null, supersededAt: null } }),
      ]);
      if (!vehicleCount || !approvedVehicleCount) throw new BadRequestException('Approve at least one registered vehicle before approving this driver.');
      const missing = DriversService.REQUIRED_DOCUMENTS.filter(label => !driverDocs.some(doc => doc.label === label && (doc.verified || doc.reviewStatus === 'VERIFIED') && (!doc.expiresAt || doc.expiresAt.getTime() >= Date.now())));
      if (missing.length) throw new BadRequestException('Driver documents still need verification: ' + missing.join(', '));
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.driver.update({
        where: { id: driverId },
        data: status === DriverApprovalStatus.APPROVED
          ? { approvalStatus: status }
          : { approvalStatus: status, onlineStatus: DriverOnlineStatus.OFFLINE },
        include: { user: true },
      });
      await tx.auditLog.create({ data: {
        actorId: actorId ?? null, action: 'DRIVER_APPROVAL_STATUS_CHANGED',
        entityType: 'Driver', entityId: driverId,
        beforeJson: JSON.stringify({ approvalStatus: current.approvalStatus, onlineStatus: current.onlineStatus }),
        afterJson: JSON.stringify({ approvalStatus: updated.approvalStatus, onlineStatus: updated.onlineStatus }),
        metadataJson: JSON.stringify({ reason: String(reason ?? '').trim() || 'Legacy admin action without a supplied reason' }),
      } });
      return updated;
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

    const [todayTrips, weekTrips, allTimeTrips, todayDeliveries, weekDeliveries, allTimeDeliveries, todayCashTrips, todayCashDeliveries, unpaidDebts] = await Promise.all([
      this.prisma.trip.findMany({
        where: { driverId, status: 'RIDE_COMPLETED', completedAt: { gte: startOfToday } },
        select: { id: true, finalFare: true, estimatedFare: true },
      }),
      this.prisma.trip.findMany({
        where: { driverId, status: 'RIDE_COMPLETED', completedAt: { gte: startOfWeek } },
        select: { id: true, finalFare: true, estimatedFare: true },
      }),
      this.prisma.trip.findMany({
        where: { driverId, status: 'RIDE_COMPLETED' },
        select: { id: true, finalFare: true, estimatedFare: true },
      }),
      // Marketplace/merchant delivery fees are already included in the
      // customer's paid order total. They are NOT charged again here.
      // Once the delivery is completed, CommissionDebtService credits the
      // driver 85% of this fee and records Zana's 15% commission.
      this.prisma.delivery.findMany({
        where: { driverId, status: 'DELIVERED', deliveredAt: { gte: startOfToday } },
        select: { id: true, fee: true },
      }),
      this.prisma.delivery.findMany({
        where: { driverId, status: 'DELIVERED', deliveredAt: { gte: startOfWeek } },
        select: { id: true, fee: true },
      }),
      this.prisma.delivery.findMany({
        where: { driverId, status: 'DELIVERED' },
        select: { id: true, fee: true },
      }),
      // Cash collected specifically — include cash deliveries as well as
      // cash rides. Digital marketplace deliveries were already paid in
      // the customer's order and therefore are not cash collected by the
      // rider.
      this.prisma.trip.findMany({
        where: {
          driverId, status: 'RIDE_COMPLETED', paymentMethod: 'CASH',
          completedAt: { gte: startOfToday },
        },
        select: { finalFare: true, estimatedFare: true },
      }),
      this.prisma.delivery.findMany({
        where: {
          driverId, status: 'DELIVERED', paymentMethod: 'CASH',
          deliveredAt: { gte: startOfToday },
        },
        select: { fee: true },
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

    // Earnings are sourced from the actual Commission ledger, not a second
    // 85% reconstruction. This matters for cash rides/deliveries because
    // their commission may have been partly covered from the wallet and the
    // remainder recorded as debt. The driver earned gross - recorded
    // commission; the wallet is a separate, real balance.
    const completedTripIds = allTimeTrips.map(t => (t as any).id).filter(Boolean);
    const completedDeliveryIds = allTimeDeliveries.map(d => (d as any).id).filter(Boolean);
    const commissionRows = await this.prisma.commission.findMany({
      where: {
        OR: [
          ...(completedTripIds.length ? [{ tripId: { in: completedTripIds } }] : []),
          ...(completedDeliveryIds.length ? [{ deliveryId: { in: completedDeliveryIds } }] : []),
        ],
      },
      select: { tripId: true, deliveryId: true, amount: true },
    });

    const commissionByTrip = new Map(commissionRows.filter(c => c.tripId).map(c => [c.tripId!, c.amount]));
    const commissionByDelivery = new Map(commissionRows.filter(c => c.deliveryId).map(c => [c.deliveryId!, c.amount]));
    const tripNet = (trips: { id?: string; finalFare: number | null; estimatedFare: number }[]) =>
      trips.reduce((total, t) => {
        const gross = t.finalFare ?? t.estimatedFare;
        return total + gross - (t.id ? (commissionByTrip.get(t.id) ?? Math.round(gross * 0.15)) : Math.round(gross * 0.15));
      }, 0);
    const deliveryNet = (deliveries: { id?: string; fee: number }[]) =>
      deliveries.reduce((total, d) => {
        const gross = Number(d.fee);
        return total + gross - (d.id ? (commissionByDelivery.get(d.id) ?? Math.round(gross * 0.15)) : Math.round(gross * 0.15));
      }, 0);

    const todayNet = tripNet(todayTrips as any) + deliveryNet(todayDeliveries as any);
    const weekNet = tripNet(weekTrips as any) + deliveryNet(weekDeliveries as any);
    const totalGross = sum(allTimeTrips) + allTimeDeliveries.reduce((s, d) => s + Number(d.fee), 0);
    const totalNet = tripNet(allTimeTrips as any) + deliveryNet(allTimeDeliveries as any);
    // Includes the exact recorded commission where available, with the
    // existing 15% rate only as a compatibility fallback for any legacy
    // completed transaction that predates its Commission row.
    const totalEarnings = totalNet;
    const totalCommission = totalGross - totalEarnings;
    const walletBalance = driver?.user?.wallet?.balance ?? 0;
    const zanaDue = unpaidDebts.reduce((s, d) => s + d.amount, 0);

    return {
      todayEarnings: Math.round(todayNet),
      weekEarnings: Math.round(weekNet),
      totalEarnings: Math.round(totalEarnings),
      totalTrips: allTimeTrips.length,
      totalDeliveries: allTimeDeliveries.length,
      walletBalance,
      zanaCommission: totalCommission,
      cashCollectedToday: Math.round(sum(todayCashTrips) + todayCashDeliveries.reduce((s, d) => s + Number(d.fee), 0)),
      zanaDue,
      // This is the actual wallet balance. Commission/debt accounting has
      // already happened when each transaction was settled; subtracting
      // zanaDue here would model the same debt a second time and would make
      // this number disagree with the withdrawal endpoint.
      netBalance: walletBalance,
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


  private async recheckDriverAfterVehicleChange(tx: any, driverId: string, changedVehicleId: string, previousStatus: string) {
    if (previousStatus !== 'APPROVED') return;
    const remainingApproved = await tx.driverVehicle.count({
      where: { driverId, status: 'APPROVED', id: { not: changedVehicleId } },
    });
    if (remainingApproved === 0) {
      const driver = await tx.driver.findUnique({ where: { id: driverId }, select: { approvalStatus: true } });
      await tx.driver.update({
        where: { id: driverId },
        data: {
          ...(driver?.approvalStatus === DriverApprovalStatus.APPROVED ? { approvalStatus: DriverApprovalStatus.PENDING } : {}),
          onlineStatus: DriverOnlineStatus.OFFLINE,
        },
      });
    }
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  // A transport platform that dispatches strangers to carry people and their
  // property needs to have seen a licence. Admin was approving drivers blind.

  static readonly REQUIRED_DOCUMENTS = [
    'Driving licence',
    'National ID',
  ];

  static readonly REQUIRED_VEHICLE_DOCUMENTS = [
    'Vehicle registration',
    'Insurance certificate',
  ];

  async uploadDocument(userId: string, label: string, imageBase64: string, vehicleId?: string, expiresAt?: string) {
    const driver = await this.findByUserId(userId);
    if (!driver) throw new NotFoundException('Driver profile not found');

    // Identity documents belong to the driver; registration, insurance and
    // vehicle photographs must be attached to one specific vehicle.
    if (!vehicleId && (DriversService.REQUIRED_VEHICLE_DOCUMENTS.includes(label) || label.startsWith('Vehicle photo - '))) {
      throw new BadRequestException('Vehicle documents and photographs must be uploaded against a registered vehicle.');
    }
    if (vehicleId && DriversService.REQUIRED_DOCUMENTS.includes(label)) {
      throw new BadRequestException('Personal identity documents must be uploaded to the driver profile.');
    }
    if (['Driving licence', 'Insurance certificate'].includes(label) && !expiresAt) {
      throw new BadRequestException('Enter the document expiry date before uploading.');
    }
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) throw new BadRequestException('Invalid document expiry date.');
    // Re-uploading creates a new current version and keeps the old version
    // available for the admin audit trail.
    if (vehicleId) {
      const vehicle = await this.prisma.driverVehicle.findFirst({ where: { id: vehicleId, driverId: driver.id } });
      if (!vehicle) throw new BadRequestException('Vehicle does not belong to this driver.');
    }

    const url = await this.storage.uploadImage(imageBase64, 'driver-documents');
    if (!url) throw new BadGatewayException('DOCUMENT_UPLOAD_FAILED');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.driverDocument.findFirst({
        where: { driverId: driver.id, label, vehicleId: vehicleId ?? null, supersededAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        await tx.driverDocument.update({
          where: { id: existing.id },
          data: { supersededAt: new Date(), reviewStatus: 'SUPERSEDED' },
        });
      }
      const created = await tx.driverDocument.create({
        data: {
          driverId: driver.id, vehicleId: vehicleId ?? null, label, fileUrl: url,
          verified: false, reviewStatus: 'PENDING',
          ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        },
      });
      await tx.auditLog.create({ data: {
        actorId: userId, action: existing ? 'DRIVER_DOCUMENT_REPLACED' : 'DRIVER_DOCUMENT_UPLOADED',
        entityType: 'DriverDocument', entityId: created.id,
        beforeJson: existing ? JSON.stringify({ id: existing.id, label: existing.label, reviewStatus: existing.reviewStatus }) : null,
        afterJson: JSON.stringify({ id: created.id, label, vehicleId: vehicleId ?? null, reviewStatus: 'PENDING' }),
        metadataJson: JSON.stringify({ source: 'DRIVER_APP' }),
      } });
      if (vehicleId) {
        const vehicle = await tx.driverVehicle.findUnique({ where: { id: vehicleId } });
        await tx.driverVehicle.update({ where: { id: vehicleId }, data: { status: 'PENDING' } });
        if (vehicle) await this.recheckDriverAfterVehicleChange(tx, driver.id, vehicleId, vehicle.status);
      } else if (DriversService.REQUIRED_DOCUMENTS.includes(label) && driver.approvalStatus === DriverApprovalStatus.APPROVED) {
        await tx.driver.update({ where: { id: driver.id }, data: { approvalStatus: DriverApprovalStatus.PENDING, onlineStatus: DriverOnlineStatus.OFFLINE } });
      }
      return created;
    });
  }

  /** What the driver has provided, and what is still outstanding. */
  async myDocuments(userId: string) {
    const driver = await this.findByUserId(userId);
    if (!driver) throw new NotFoundException('Driver profile not found');

    const docs = await this.prisma.driverDocument.findMany({
      where: { driverId: driver.id, supersededAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const byLabel = new Map<string, any>();
    for (const doc of docs) if (!byLabel.has(doc.label)) byLabel.set(doc.label, doc);

    return {
      documents: DriversService.REQUIRED_DOCUMENTS.map(label => {
        const d = byLabel.get(label);
        return {
          label,
          fileUrl: d?.fileUrl ?? null,
          verified: d?.verified ?? false,
          uploadedAt: d?.createdAt ?? null,
          status: !d ? 'MISSING' : d.expiresAt && new Date(d.expiresAt).getTime() < Date.now() ? 'EXPIRED' : d.reviewStatus === 'REJECTED' ? 'REJECTED' : (d.reviewStatus === 'VERIFIED' || d.verified) ? 'VERIFIED' : 'PENDING',
        };
      }),
      allUploaded: DriversService.REQUIRED_DOCUMENTS.every(l => byLabel.has(l)),
      allVerified: DriversService.REQUIRED_DOCUMENTS.every(l => byLabel.get(l)?.verified && (!byLabel.get(l)?.expiresAt || new Date(byLabel.get(l).expiresAt).getTime() >= Date.now())),
    };
  }

  async documentsForDriver(driverId: string) {
    return this.prisma.driverDocument.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });
  }


  async updateDocumentMetadata(documentId: string, body: any, actorId: string) {
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 5) throw new BadRequestException('A correction reason of at least 5 characters is required.');
    const current = await this.prisma.driverDocument.findUnique({ where: { id: documentId } });
    if (!current) throw new NotFoundException('Document not found.');
    if (current.supersededAt) throw new BadRequestException('A superseded document version cannot be edited.');
    const data: any = {};
    if (body.label !== undefined) {
      const label = String(body.label).trim().slice(0, 120);
      if (!label) throw new BadRequestException('Document label cannot be empty.');
      data.label = label;
    }
    if (body.expiresAt !== undefined) {
      if (body.expiresAt === null || body.expiresAt === '') data.expiresAt = null;
      else {
        const parsed = new Date(body.expiresAt);
        if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Enter a valid expiry date.');
        data.expiresAt = parsed;
      }
    }
    if (!Object.keys(data).length) throw new BadRequestException('No document fields supplied for correction.');
    data.verified = false;
    data.reviewStatus = 'PENDING';
    data.rejectionReason = null;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.driverDocument.update({ where: { id: documentId }, data });
      if (current.vehicleId) {
        const vehicle = await tx.driverVehicle.findUnique({ where: { id: current.vehicleId } });
        await tx.driverVehicle.update({ where: { id: current.vehicleId }, data: { status: 'PENDING' } });
        if (vehicle) await this.recheckDriverAfterVehicleChange(tx, current.driverId, current.vehicleId, vehicle.status);
      } else if (DriversService.REQUIRED_DOCUMENTS.includes(current.label) || DriversService.REQUIRED_DOCUMENTS.includes(updated.label)) {
        await tx.driver.update({ where: { id: current.driverId }, data: { approvalStatus: DriverApprovalStatus.PENDING, onlineStatus: DriverOnlineStatus.OFFLINE } });
      }
      await tx.auditLog.create({ data: {
        actorId, action: 'DRIVER_DOCUMENT_METADATA_CORRECTED', entityType: 'DriverDocument', entityId: documentId,
        beforeJson: JSON.stringify({ label: current.label, expiresAt: current.expiresAt, verified: current.verified, reviewStatus: current.reviewStatus }),
        afterJson: JSON.stringify({ label: updated.label, expiresAt: updated.expiresAt, verified: updated.verified, reviewStatus: updated.reviewStatus }),
        metadataJson: JSON.stringify({ reason }),
      } });
      return updated;
    });
  }

  async verifyDocument(documentId: string, verified: boolean, actorId?: string, reason?: string) {
    const current = await this.prisma.driverDocument.findUnique({ where: { id: documentId } });
    if (!current) throw new NotFoundException('Document not found.');
    if (current.supersededAt) throw new BadRequestException('This document version has been superseded and cannot be reviewed.');
    if (String(reason ?? '').trim().length < 5) throw new BadRequestException('A review reason of at least 5 characters is required.');
    if (verified && current.expiresAt && current.expiresAt.getTime() < Date.now()) throw new BadRequestException('This document is expired and cannot be verified.');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.driverDocument.update({
        where: { id: documentId },
        data: { verified, reviewStatus: verified ? 'VERIFIED' : 'REJECTED', rejectionReason: verified ? null : String(reason).trim() },
      });
      if (!verified && current.vehicleId) {
        const vehicle = await tx.driverVehicle.findUnique({ where: { id: current.vehicleId } });
        await tx.driverVehicle.update({ where: { id: current.vehicleId }, data: { status: 'PENDING' } });
        if (vehicle) await this.recheckDriverAfterVehicleChange(tx, current.driverId, current.vehicleId, vehicle.status);
      } else if (!verified && DriversService.REQUIRED_DOCUMENTS.includes(current.label)) {
        await tx.driver.update({ where: { id: current.driverId }, data: { approvalStatus: DriverApprovalStatus.PENDING, onlineStatus: DriverOnlineStatus.OFFLINE } });
      }
      await tx.auditLog.create({ data: {
        actorId: actorId ?? null, action: verified ? 'DRIVER_DOCUMENT_VERIFIED' : 'DRIVER_DOCUMENT_REJECTED',
        entityType: 'DriverDocument', entityId: documentId,
        beforeJson: JSON.stringify({ verified: current.verified, reviewStatus: current.reviewStatus }),
        afterJson: JSON.stringify({ verified: updated.verified, reviewStatus: updated.reviewStatus }),
        metadataJson: JSON.stringify({ reason: String(reason).trim() }),
      } });
      return updated;
    });
  }

  async getOperationsOverview() {
    const [total, pending, approved, rejected, suspended, online, pendingDocuments, expiredDocuments, totalVehicles, pendingVehicles] = await Promise.all([
      this.prisma.driver.count(),
      this.prisma.driver.count({ where: { approvalStatus: 'PENDING' } }),
      this.prisma.driver.count({ where: { approvalStatus: 'APPROVED' } }),
      this.prisma.driver.count({ where: { approvalStatus: 'REJECTED' } }),
      this.prisma.driver.count({ where: { approvalStatus: 'SUSPENDED' } }),
      this.prisma.driver.count({ where: { onlineStatus: 'ONLINE' } }),
      this.prisma.driverDocument.count({ where: { supersededAt: null, reviewStatus: 'PENDING' } }),
      this.prisma.driverDocument.count({ where: { supersededAt: null, expiresAt: { lt: new Date() } } }),
      this.prisma.driverVehicle.count(),
      this.prisma.driverVehicle.count({ where: { status: 'PENDING' } }),
    ]);
    return { total, pending, approved, rejected, suspended, online, pendingDocuments, expiredDocuments, totalVehicles, pendingVehicles };
  }


  async getAuditHistory(driverId: string) {
    const [vehicles, documents] = await Promise.all([
      this.prisma.driverVehicle.findMany({ where: { driverId }, select: { id: true } }),
      this.prisma.driverDocument.findMany({ where: { driverId }, select: { id: true } }),
    ]);
    const clauses: any[] = [{ entityType: 'Driver', entityId: driverId }];
    if (vehicles.length) clauses.push({ entityType: 'DriverVehicle', entityId: { in: vehicles.map(v => v.id) } });
    if (documents.length) clauses.push({ entityType: 'DriverDocument', entityId: { in: documents.map(d => d.id) } });
    const logs = await this.prisma.auditLog.findMany({ where: { OR: clauses }, orderBy: { createdAt: 'desc' }, take: 100 });
    const actorIds = [...new Set(logs.map(log => log.actorId).filter(Boolean))] as string[];
    const actors = actorIds.length ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, firstName: true, lastName: true, email: true, phone: true } }) : [];
    const actorMap = new Map(actors.map(actor => [actor.id, actor]));
    return logs.map(log => ({ ...log, actor: log.actorId ? actorMap.get(log.actorId) ?? null : null }));
  }

  async updateDriverProfile(driverId: string, body: any, actorId: string) {
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 5) throw new BadRequestException('A correction reason of at least 5 characters is required.');
    const current = await this.prisma.driver.findUnique({ where: { id: driverId }, include: { user: true } });
    if (!current) throw new NotFoundException('Driver not found.');
    const driverData: any = {};
    const userData: any = {};
    for (const key of ['vehicle', 'plate']) if (body[key] !== undefined) driverData[key] = key === 'plate' ? String(body[key]).trim().toUpperCase().slice(0, 40) : String(body[key]).trim().slice(0, 120);
    if (body.serviceType !== undefined) {
      if (!['BIKE', 'ECONOMY', 'COMFORT'].includes(body.serviceType)) throw new BadRequestException('Invalid service type.');
      driverData.serviceType = body.serviceType;
    }
    if (body.driverMode !== undefined) {
      if (!['RIDES', 'DELIVERIES', 'BOTH'].includes(body.driverMode)) throw new BadRequestException('Invalid driver mode.');
      driverData.driverMode = body.driverMode;
    }
    for (const key of ['firstName', 'lastName', 'phone', 'email']) {
      if (body[key] !== undefined) userData[key] = key === 'email' && !String(body[key] ?? '').trim() ? null : body[key] === null ? null : String(body[key]).trim().slice(0, 150);
    }
    if (!Object.keys(driverData).length && !Object.keys(userData).length) throw new BadRequestException('No editable fields supplied.');
    const before = { driver: { vehicle: current.vehicle, plate: current.plate, serviceType: current.serviceType, driverMode: current.driverMode }, user: { firstName: current.user.firstName, lastName: current.user.lastName, phone: current.user.phone, email: current.user.email } };
    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length) await tx.user.update({ where: { id: current.userId }, data: userData });
      const vehicleIdentityChanged = ['vehicle', 'plate', 'serviceType'].some(key => body[key] !== undefined);
      if (vehicleIdentityChanged) {
        const primaryVehicle = await tx.driverVehicle.findFirst({ where: { driverId }, orderBy: { createdAt: 'asc' } });
        if (primaryVehicle) {
          const vehicleUpdate: any = { status: 'PENDING' };
          if (body.vehicle !== undefined) vehicleUpdate.make = String(body.vehicle).trim();
          if (body.plate !== undefined) vehicleUpdate.plate = String(body.plate).trim().toUpperCase();
          if (body.serviceType !== undefined) vehicleUpdate.vehicleType = body.serviceType === 'BIKE' ? 'MOTORCYCLE' : 'CAR';
          await tx.driverVehicle.update({ where: { id: primaryVehicle.id }, data: vehicleUpdate });
          await this.recheckDriverAfterVehicleChange(tx, driverId, primaryVehicle.id, primaryVehicle.status);
        } else {
          driverData.approvalStatus = DriverApprovalStatus.PENDING;
          driverData.onlineStatus = DriverOnlineStatus.OFFLINE;
        }
      }
      const updated = await tx.driver.update({ where: { id: driverId }, data: driverData, include: { user: true, documents: true, vehicles: { include: { documents: true } } } });
      const after = { driver: { vehicle: updated.vehicle, plate: updated.plate, serviceType: updated.serviceType, driverMode: updated.driverMode }, user: { firstName: updated.user.firstName, lastName: updated.user.lastName, phone: updated.user.phone, email: updated.user.email } };
      await tx.auditLog.create({ data: { actorId, action: 'DRIVER_PROFILE_CORRECTED', entityType: 'Driver', entityId: driverId, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), metadataJson: JSON.stringify({ reason }) } });
      return updated;
    });
  }

  async updateVehicle(driverId: string, vehicleId: string, body: any, actorId: string) {
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 5) throw new BadRequestException('A correction reason of at least 5 characters is required.');
    const current = await this.prisma.driverVehicle.findFirst({ where: { id: vehicleId, driverId } });
    if (!current) throw new NotFoundException('Vehicle not found.');
    const allowed = ['vehicleType', 'make', 'model', 'year', 'color', 'plate', 'registrationNumber', 'chassisNumber', 'ownershipType', 'notes'];
    const data: any = {};
    for (const key of allowed) if (body[key] !== undefined) data[key] = key === 'year' ? (body[key] === null || body[key] === '' ? null : Number(body[key])) : (body[key] === null ? null : String(body[key]).trim());
    if (data.vehicleType !== undefined && !['MOTORCYCLE', 'CAR'].includes(data.vehicleType)) throw new BadRequestException('Vehicle type must be MOTORCYCLE or CAR.');
    if (data.plate !== undefined) {
      data.plate = String(data.plate).toUpperCase();
      if (!data.plate) throw new BadRequestException('Vehicle registration plate cannot be empty.');
    }
    if (data.year !== undefined && data.year !== null && (!Number.isInteger(data.year) || data.year < 1950 || data.year > new Date().getFullYear() + 1)) throw new BadRequestException('Enter a valid vehicle year.');
    if (!Object.keys(data).length) throw new BadRequestException('No editable vehicle fields supplied.');
    return this.prisma.$transaction(async (tx) => {
      const identityFields = ['vehicleType', 'make', 'model', 'year', 'color', 'plate', 'registrationNumber', 'chassisNumber', 'ownershipType'];
      const requiresReinspection = identityFields.some(key => data[key] !== undefined);
      if (requiresReinspection) data.status = 'PENDING';
      const next = await tx.driverVehicle.update({ where: { id: vehicleId }, data, include: { documents: true } });
      if (requiresReinspection) {
        await this.recheckDriverAfterVehicleChange(tx, driverId, vehicleId, current.status);
      }
      await tx.auditLog.create({ data: { actorId, action: 'DRIVER_VEHICLE_CORRECTED', entityType: 'DriverVehicle', entityId: vehicleId, beforeJson: JSON.stringify(current), afterJson: JSON.stringify(next), metadataJson: JSON.stringify({ reason, requiresReinspection }) } });
      return next;
    });
  }

  async setVehicleStatus(driverId: string, vehicleId: string, status: string, reason: string, actorId: string) {
    if (!['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(status)) throw new BadRequestException('Invalid vehicle status.');
    if (String(reason ?? '').trim().length < 5) throw new BadRequestException('A decision reason of at least 5 characters is required.');
    const current = await this.prisma.driverVehicle.findFirst({ where: { id: vehicleId, driverId } });
    if (!current) throw new NotFoundException('Vehicle not found.');
    if (status === 'APPROVED') {
      const [driverDocs, vehicleDocs] = await Promise.all([
        this.prisma.driverDocument.findMany({ where: { driverId, vehicleId: null, supersededAt: null } }),
        this.prisma.driverDocument.findMany({ where: { driverId, vehicleId, supersededAt: null } }),
      ]);
      const missingDriverDocs = DriversService.REQUIRED_DOCUMENTS.filter(label => !driverDocs.some(doc => doc.label === label && (doc.verified || doc.reviewStatus === 'VERIFIED') && (!doc.expiresAt || doc.expiresAt.getTime() >= Date.now())));
      const photoLabels = current.vehicleType === 'MOTORCYCLE'
        ? ['Vehicle photo - front', 'Vehicle photo - rear / plate', 'Vehicle photo - left side', 'Vehicle photo - right side']
        : ['Vehicle photo - front', 'Vehicle photo - rear / plate', 'Vehicle photo - left side', 'Vehicle photo - right side', 'Vehicle photo - interior', 'Vehicle photo - dashboard'];
      const requiredVehicleLabels = [...DriversService.REQUIRED_VEHICLE_DOCUMENTS, ...photoLabels];
      const missingVehicleDocs = requiredVehicleLabels.filter(label => !vehicleDocs.some(doc => doc.label === label && (doc.verified || doc.reviewStatus === 'VERIFIED') && (!doc.expiresAt || doc.expiresAt.getTime() >= Date.now())));
      if (missingDriverDocs.length || missingVehicleDocs.length) {
        const missing = [...missingDriverDocs, ...missingVehicleDocs];
        throw new BadRequestException('Vehicle cannot be approved until all required documents and photographs are verified: ' + missing.join(', '));
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const next = await tx.driverVehicle.update({ where: { id: vehicleId }, data: { status }, include: { documents: true } });
      if (current.status === 'APPROVED' && status !== 'APPROVED') {
        await this.recheckDriverAfterVehicleChange(tx, driverId, vehicleId, current.status);
      }
      await tx.auditLog.create({ data: { actorId, action: 'DRIVER_VEHICLE_STATUS_CHANGED', entityType: 'DriverVehicle', entityId: vehicleId, beforeJson: JSON.stringify({ status: current.status }), afterJson: JSON.stringify({ status }), metadataJson: JSON.stringify({ reason }) } });
      return next;
    });
  }

  async createVehicle(userId: string, body: any) {
    const driver = await this.findByUserId(userId);
    const vehicleType = String(body.vehicleType ?? '').trim().toUpperCase();
    const plate = String(body.plate ?? '').trim().toUpperCase();
    if (!['MOTORCYCLE', 'CAR'].includes(vehicleType)) throw new BadRequestException('Vehicle type must be MOTORCYCLE or CAR.');
    if (!plate) throw new BadRequestException('Vehicle registration plate is required.');
    const vehicle = await this.prisma.driverVehicle.create({
      data: {
        driverId: driver.id, vehicleType, plate,
        make: body.make ? String(body.make).trim() : null,
        model: body.model ? String(body.model).trim() : null,
        year: body.year ? Number(body.year) : null,
        color: body.color ? String(body.color).trim() : null,
        registrationNumber: body.registrationNumber ? String(body.registrationNumber).trim() : null,
        chassisNumber: body.chassisNumber ? String(body.chassisNumber).trim() : null,
        ownershipType: body.ownershipType ? String(body.ownershipType).trim() : 'SELF',
      },
    });
    await this.prisma.auditLog.create({ data: {
      actorId: userId, action: 'DRIVER_VEHICLE_SUBMITTED', entityType: 'DriverVehicle', entityId: vehicle.id,
      afterJson: JSON.stringify(vehicle), metadataJson: JSON.stringify({ source: 'DRIVER_APP' }),
    } });
    return vehicle;
  }

  async listVehicles(userId: string) {
    const driver = await this.findByUserId(userId);
    return this.prisma.driverVehicle.findMany({ where: { driverId: driver.id }, include: { documents: { where: { supersededAt: null }, orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } });
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
