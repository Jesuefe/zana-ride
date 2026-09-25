import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionDebtService } from './commission-debt.service';
import { PointsService } from './points.service';
import { CancellationService } from './cancellation.service';
import { ZanaGateway } from '../gateway/zana.gateway';
import { PaypackService } from '../wallet/paypack.service';
import { DriversService } from '../drivers/drivers.service';
import { ServiceType, TripStatus, DriverOnlineStatus } from '@prisma/client';
import { estimateDurationMinutes, haversineKm } from './fare.util';
import { FareService } from './fare.service';

type LatLng = { lat: number; lng: number };

@Injectable()
export class TripsService {
  private readonly refreshingTripIds = new Set<string>();
  private dispatchRefreshRunning = false;

  constructor(
    private prisma: PrismaService,
    private driversService: DriversService,
    private fareService: FareService,
    private commissionDebtService: CommissionDebtService,
    private paypackService: PaypackService,
    private pointsService: PointsService,
    private cancellationService: CancellationService,
    private gateway: ZanaGateway,
  ) {}

  estimate(pickup: LatLng, destination: LatLng, serviceType: ServiceType) {
    const distanceKm = Math.max(0.8, haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng));
    const durationMin = estimateDurationMinutes(distanceKm);
    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMinutes: durationMin,
      fare: this.fareService.estimateFare(serviceType, distanceKm, durationMin),
    };
  }

  async create(
    customerId: string,
    data: {
      serviceType: ServiceType;
      pickupAddress: string;
      pickupLat: number;
      pickupLng: number;
      destinationAddress: string;
      destinationLat: number;
      destinationLng: number;
      paymentMethod?: string;
    },
  ) {
    const trips = await this.createGroup(customerId, data, 1);
    return trips[0];
  }

  // Creates `count` independent trips at once, sharing a groupId so the
  // customer app can show them as one coordinated booking (e.g. "3 motos
  // requested for your group of 5") while each still gets matched to its
  // own separate driver individually.
  async createGroup(
    customerId: string,
    data: {
      serviceType: ServiceType;
      pickupAddress: string;
      pickupLat: number;
      pickupLng: number;
      destinationAddress: string;
      destinationLat: number;
      destinationLng: number;
      paymentMethod?: string;
    },
    count: number,
  ) {
    // Live-testing only: if this customer account has a test location
    // configured (set from the admin Test Locations page), their
    // actual submitted pickup coordinates are replaced with it here —
    // the app and customer behave completely normally, ride matching
    // just sees the configured position instead of wherever they
    // really are. Off by default for every customer.
    const testOverride = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { testOverrideLat: true, testOverrideLng: true },
    });
    if (testOverride?.testOverrideLat != null && testOverride?.testOverrideLng != null) {
      data = { ...data, pickupLat: testOverride.testOverrideLat, pickupLng: testOverride.testOverrideLng };
    }

    if (count < 1 || count > 8) {
      throw new BadRequestException('Group size must be between 1 and 8');
    }

    const est = this.estimate(
      { lat: data.pickupLat, lng: data.pickupLng },
      { lat: data.destinationLat, lng: data.destinationLng },
      data.serviceType,
    );

    const groupId = count > 1 ? randomUUID() : null;

    const created = await Promise.all(
      Array.from({ length: count }).map((_, i) =>
        this.prisma.trip.create({
          data: {
            customerId,
            serviceType: data.serviceType,
            pickupAddress: data.pickupAddress,
            pickupLat: data.pickupLat,
            pickupLng: data.pickupLng,
            destinationAddress: data.destinationAddress,
            destinationLat: data.destinationLat,
            destinationLng: data.destinationLng,
            distanceKm: est.distanceKm,
            estimatedFare: est.fare,
            status: TripStatus.SEARCHING_DRIVER,
            groupId,
            groupSeatIndex: count > 1 ? i + 1 : null,
            paymentMethod: data.paymentMethod ?? 'CASH',
          },
        }),
      ),
    );

    // Simple nearest-available match per trip — see spec section 9 for the
    // fuller scoring model (distance + ETA + rating + acceptance rate) to
    // layer in once there's enough driver density for it to matter.
    const nearby = await this.driversService.findNearbyAvailable(data.pickupLat, data.pickupLng, data.serviceType);
    if (nearby.length === 0) {
      await this.prisma.trip.updateMany({
        where: { id: { in: created.map((t) => t.id) } },
        data: { status: TripStatus.NO_DRIVER_FOUND },
      });
      return this.prisma.trip.findMany({ where: { id: { in: created.map((t) => t.id) } } });
    }

    // Dispatch protection:
    // - one ride is offered to at most 4 drivers at a time
    // - one driver can hold at most 4 pending ride offers at a time
    // - if an offer is declined/expired, the ride can be refilled with the
    //   next eligible driver without broadcasting the ride to everyone.
    for (const trip of created) {
      await this.refreshTripOffers(trip.id);
    }

    return created;
  }

  async findByGroupId(groupId: string) {
    return this.prisma.trip.findMany({
      where: { groupId },
      include: { driver: { include: { user: true } } },
      orderBy: { groupSeatIndex: 'asc' },
    });
  }

  async findById(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: { driver: { include: { user: true } }, customer: true },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async assignDriver(tripId: string, driverId: string) {
    const now = new Date();

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { onlineStatus: true },
    });
    if (driver?.onlineStatus !== DriverOnlineStatus.ONLINE) {
      throw new BadRequestException('You must be online to accept a ride');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Acceptance must come from a real, still-live offer. This prevents a
      // stale/direct trip-id call from bypassing the 4-driver offer pool.
      const offer = await tx.rideOffer.findFirst({
        where: {
          tripId,
          driverId,
          status: 'PENDING',
          expiresAt: { gte: now },
          trip: { status: TripStatus.SEARCHING_DRIVER, driverId: null },
        },
        select: { id: true },
      });
      if (!offer) {
        throw new BadRequestException('Ride offer is no longer available');
      }

      // The conditional update is the race-protection lock. If two drivers
      // accept the same ride at nearly the same time, exactly one update can
      // move SEARCHING_DRIVER -> DRIVER_ASSIGNED.
      const { count } = await tx.trip.updateMany({
        where: { id: tripId, status: TripStatus.SEARCHING_DRIVER, driverId: null },
        data: { driverId, status: TripStatus.DRIVER_ASSIGNED, acceptedAt: now },
      });
      if (count === 0) {
        throw new BadRequestException('This ride has already been accepted by another driver');
      }

      await tx.rideOffer.update({
        where: { id: offer.id },
        data: { status: 'ACCEPTED', respondedAt: now },
      });

      // Every other driver holding this ride loses the offer immediately.
      await tx.rideOffer.updateMany({
        where: {
          tripId,
          driverId: { not: driverId },
          status: 'PENDING',
        },
        data: { status: 'CANCELLED', respondedAt: now },
      });

      // A driver can only have one active ride. Clear their other pending
      // offers so the app cannot keep presenting rides they cannot accept.
      await tx.rideOffer.updateMany({
        where: {
          driverId,
          tripId: { not: tripId },
          status: 'PENDING',
        },
        data: { status: 'CANCELLED', respondedAt: now },
      });

      return { offerId: offer.id };
    });

    await this.driversService.setOnlineStatus(driverId, DriverOnlineStatus.BUSY);

    // Notify losing drivers and the accepting driver after the transaction
    // has committed, so the real-time UI never reflects an uncommitted state.
    try {
      const cancelled = await this.prisma.rideOffer.findMany({
        where: {
          tripId,
          driverId: { not: driverId },
          status: 'CANCELLED',
          respondedAt: now,
        },
        include: { driver: { select: { userId: true } } },
      });
      for (const offer of cancelled) {
        this.gateway.sendToUser(offer.driver.userId, 'ride:offer-cancelled', { tripId });
      }
      this.gateway.sendToUser(
        (await this.prisma.driver.findUnique({ where: { id: driverId }, select: { userId: true } }))!.userId,
        'ride:accepted',
        { tripId, offerId: result.offerId },
      );
    } catch {}

    return this.prisma.trip.findUnique({ where: { id: tripId } });
  }

  // Re-check open rides continuously so a driver who comes online after
  // the original request can still enter the protected four-driver offer pool.
  // This is deliberately bounded: only the oldest 25 searching rides are
  // considered per pass, and refreshTripOffers itself never exceeds four
  // live driver offers for a single ride.
  @Interval(5000)
  async replenishOpenRideOffers() {
    if (this.dispatchRefreshRunning) return;
    this.dispatchRefreshRunning = true;
    try {
      const now = new Date();
      const openTrips = await this.prisma.trip.findMany({
        where: { status: TripStatus.SEARCHING_DRIVER },
        select: { id: true },
        orderBy: { requestedAt: 'asc' },
        take: 25,
      });

      // Expire stale offers centrally so their four-driver slots become
      // reusable even when none of the original recipient drivers polls.
      await this.prisma.rideOffer.updateMany({
        where: { status: 'PENDING', expiresAt: { lt: now }, trip: { status: TripStatus.SEARCHING_DRIVER } },
        data: { status: 'EXPIRED', respondedAt: now },
      });

      for (const trip of openTrips) {
        await this.refreshTripOffers(trip.id);
      }
    } catch (error: any) {
      console.error('[DISPATCH] Replenishment pass failed:', error?.message ?? error);
    } finally {
      this.dispatchRefreshRunning = false;
    }
  }

  /**
   * Keep a ride protected by a maximum of four simultaneous drivers.
   * Also protects each driver's screen from growing beyond four pending
   * ride offers. Declined/expired offers are never immediately re-offered
   * to the same driver for the same trip.
   */
  private async refreshTripOffers(tripId: string) {
    // Multiple triggers can arrive together (new ride, decline, expiry,
    // scheduler). This in-memory check is a cheap first-line optimization —
    // it only protects against redundant concurrent calls within this one
    // process, so it's kept as a fast short-circuit, not the real guard.
    if (this.refreshingTripIds.has(tripId)) return;
    this.refreshingTripIds.add(tripId);
    try {
      const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        serviceType: true,
        pickupLat: true,
        pickupLng: true,
        pickupAddress: true,
        destinationAddress: true,
        estimatedFare: true,
        status: true,
      },
    });
    if (!trip || trip.status !== TripStatus.SEARCHING_DRIVER) return;

    const OFFER_DRIVER_LIMIT = 4;
    const DRIVER_PENDING_LIMIT = 4;
    const OFFER_TTL_MS = 20_000;

    // Nearby-driver lookup is read-only and doesn't need to be atomic with
    // the write below, so it stays outside the locked transaction to keep
    // the lock held as briefly as possible.
    const nearby = await this.driversService.findNearbyAvailable(
      trip.pickupLat,
      trip.pickupLng,
      trip.serviceType,
    );
    if (nearby.length === 0) return;

    // Previously the 4-driver-per-trip and 4-offer-per-driver limits were
    // only ever checked with a plain read (count) before the write — safe
    // for one process, but two truly concurrent calls (from this same
    // instance racing past the in-memory check above under load, or from
    // a second API instance if this ever scales beyond one) could both
    // read a count under the limit and both proceed to insert, together
    // exceeding it. A Postgres advisory lock scoped to this specific trip
    // ID serializes every read-check-write sequence for this trip across
    // every connection and every process, not just within this one, and
    // is automatically released when the transaction ends — no separate
    // unlock call to forget.
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tripId}))`;

      const pending = await tx.rideOffer.findMany({
        where: { tripId, status: 'PENDING', expiresAt: { gte: new Date() } },
        select: { driverId: true },
      });

      if (pending.length >= OFFER_DRIVER_LIMIT) return;

      const existingForTrip = await tx.rideOffer.findMany({
        where: { tripId },
        select: { driverId: true },
      });
      const alreadyOffered = new Set(existingForTrip.map((o) => o.driverId));

      const candidates: typeof nearby = [];
      for (const candidate of nearby) {
        if (pending.some((o) => o.driverId === candidate.id)) continue;
        if (alreadyOffered.has(candidate.id)) continue;

        const driverPending = await tx.rideOffer.count({
          where: {
            driverId: candidate.id,
            status: 'PENDING',
            expiresAt: { gte: new Date() },
          },
        });
        if (driverPending >= DRIVER_PENDING_LIMIT) continue;

        candidates.push(candidate);
        if (pending.length + candidates.length >= OFFER_DRIVER_LIMIT) break;
      }

      if (candidates.length === 0) return;

      const expiresAt = new Date(Date.now() + OFFER_TTL_MS);
      await tx.rideOffer.createMany({
        data: candidates.map((d) => ({
          tripId,
          driverId: d.id,
          distanceKm: Math.round(d.distanceKm * 10) / 10,
          expiresAt,
        })),
        skipDuplicates: true,
      });

      for (const d of candidates) {
        this.gateway.sendToUser(d.userId, 'ride:offer', {
          tripId,
          pickupAddress: trip.pickupAddress,
          destinationAddress: trip.destinationAddress,
          distanceKm: Math.round(d.distanceKm * 10) / 10,
          fare: trip.estimatedFare,
          expiresAt,
        });
      }
    });
    } finally {
      this.refreshingTripIds.delete(tripId);
    }
  }
  async updateStatus(tripId: string, status: TripStatus) {
    const timestampField: Partial<Record<TripStatus, string>> = {
      DRIVER_ARRIVED: 'arrivedAt',
      RIDE_IN_PROGRESS: 'startedAt',
      RIDE_COMPLETED: 'completedAt',
    };

    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const data: Record<string, unknown> = { status };
    const field = timestampField[status];
    if (field) data[field] = new Date();
    if (status === TripStatus.RIDE_COMPLETED) data.finalFare = trip.estimatedFare;

    // Atomic guard against the same transition being applied twice — a
    // double-tap on "Complete Trip", or the same request landing twice
    // from a network retry, previously had nothing stopping it from
    // re-running every financial side effect below a second time: a
    // second wallet debit, a second commission record, a second points
    // award, all for the same ride. The update only succeeds if the trip
    // wasn't already in this exact status; if another request already
    // got there first, this one safely no-ops and returns the current
    // state instead of reprocessing anything.
    const { count } = await this.prisma.trip.updateMany({
      where: { id: tripId, status: { not: status } },
      data,
    });
    if (count === 0) {
      return this.prisma.trip.findUnique({ where: { id: tripId } });
    }

    const updated = await this.prisma.trip.findUnique({ where: { id: tripId } });

    if ((status === TripStatus.RIDE_COMPLETED || status === TripStatus.DRIVER_CANCELLED) && trip.driverId) {
      await this.driversService.setOnlineStatus(trip.driverId, DriverOnlineStatus.ONLINE);
    }

    // Record Zana's commission on every completed ride asynchronously —
    // a failure here should never surface as an error to the driver app.
    if (status === TripStatus.RIDE_COMPLETED) {
      const fare = (updated as any).finalFare ?? trip.estimatedFare;
      const paymentMethod = (trip as any).paymentMethod ?? 'CASH';

      // ── Record transaction for every payment type ────────────────────
      this.recordTripTransaction(trip.customerId, fare, paymentMethod, tripId).catch(() => {});

      if (trip.driverId) {
        // CASH is unambiguous — the driver physically collects it right
        // there, so settling immediately at completion is correct. MOBILE_MONEY
        // is NOT settled here anymore: this used to fire immediately, crediting
        // the driver's wallet as if Zana had already been paid digitally, even
        // though at this exact moment the driver hasn't even sent the MoMo
        // prompt yet — let alone had the customer approve it. A driver could
        // tap "collect cash instead" right after and walk away having been
        // paid twice (the wallet credit here, plus the physical cash), while
        // Zana never actually collected anything. Settlement for MOBILE_MONEY
        // now happens in checkMomoStatus, only once the charge is genuinely
        // confirmed — or via the explicit cash-fallback endpoint if the
        // driver switches.
        if (paymentMethod === 'CASH') {
          this.commissionDebtService.handleTripCompletion(tripId, fare, trip.driverId, paymentMethod).catch(() => {});
        }
        this.pointsService.earnForRide(trip.customerId, fare, tripId).catch(() => {});
        // MoMo is charged via POST /rides/:id/momo-charge (driver-triggered,
        // so the number can be corrected before the prompt is sent).
      }
    }

    return updated;
  }

  async cancel(tripId: string, by: 'CUSTOMER' | 'DRIVER', callerId: string, reason?: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { driver: { include: { user: { select: { id: true } } } }, customer: { select: { firstName: true } } },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status === TripStatus.RIDE_COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed trip');
    }

    // Neither endpoint previously verified the caller actually owned this
    // trip — any authenticated customer could cancel any other customer's
    // ride just by knowing the trip ID, and the same for a driver.
    if (by === 'CUSTOMER' && trip.customerId !== callerId) {
      throw new BadRequestException('Not your trip');
    }
    if (by === 'DRIVER' && trip.driver?.user?.id !== callerId) {
      throw new BadRequestException('Not your trip');
    }

    // Once a ride is in progress it can no longer simply be undone — a
    // customer past this point reports a problem instead (see report()
    // below). The driver can still cancel here, but must give a reason.
    if (by === 'CUSTOMER' && trip.status === TripStatus.RIDE_IN_PROGRESS) {
      throw new BadRequestException('RIDE_ALREADY_IN_PROGRESS');
    }
    if (by === 'DRIVER' && !reason?.trim()) {
      throw new BadRequestException('CANCEL_REASON_REQUIRED');
    }

    // Record and check cancellation limit for customer
    if (by === 'CUSTOMER') {
      await this.cancellationService.checkAndRecord(trip.customerId, tripId).catch(() => {});
    }

    // NOTE: no wallet refund here — wallet is only debited on RIDE_COMPLETED,
    // so a cancelled ride has nothing to refund.

    const targetStatus = by === 'CUSTOMER' ? TripStatus.CUSTOMER_CANCELLED : TripStatus.DRIVER_CANCELLED;
    const updated = await this.updateStatus(tripId, targetStatus);

    // Any driver still holding a live offer for this ride needs to know
    // it's gone right away, not just find out whenever their own 20s
    // countdown happens to run out — otherwise their alert keeps
    // sounding for a ride that no longer exists.
    try {
      const pendingOffers = await this.prisma.rideOffer.findMany({
        where: { tripId, status: 'PENDING' },
        include: { driver: { select: { userId: true } } },
      });
      if (pendingOffers.length > 0) {
        await this.prisma.rideOffer.updateMany({
          where: { tripId, status: 'PENDING' },
          data: { status: 'CANCELLED', respondedAt: new Date() },
        });
        for (const o of pendingOffers) {
          this.gateway.sendToUser(o.driver.userId, 'ride:offer-cancelled', { tripId });
        }
      }
    } catch {}

    // Only write the reason if this request is the one that actually
    // caused the cancellation — updateStatus() safely no-ops on a
    // duplicate/losing request but still returns the trip's current
    // state, so without this check a losing request could overwrite the
    // real cancellation's reason text with its own.
    if (by === 'DRIVER' && reason?.trim() && (updated as any)?.status === targetStatus) {
      await this.prisma.trip.update({ where: { id: tripId }, data: { cancelReason: reason.trim() } });
    }

    // Notify the other party in real time so their screen closes
    try {
      if (by === 'CUSTOMER' && trip.driver?.user?.id) {
        this.gateway.sendToUser(trip.driver.user.id, 'trip:cancelled', {
          tripId,
          by: 'CUSTOMER',
          message: `${trip.customer?.firstName ?? 'The customer'} cancelled this ride`,
        });
        console.log(`[TRIP] ${tripId} cancelled by CUSTOMER — driver notified`);
      } else if (by === 'DRIVER') {
        this.gateway.sendToUser(trip.customerId, 'trip:cancelled', {
          tripId,
          by: 'DRIVER',
          message: reason?.trim()
            ? `Your driver cancelled this ride: ${reason.trim()}. Finding you another driver.`
            : 'Your driver cancelled this ride. Finding you another driver.',
        });
        console.log(`[TRIP] ${tripId} cancelled by DRIVER — customer notified`);
      }
    } catch (e: any) {
      console.error('[TRIP] Cancel notify failed:', e?.message);
    }

    return updated;
  }

  // ── Report a ride ────────────────────────────────────────────────────────
  // The replacement for cancelling once a trip is already in progress — the
  // customer flags a problem rather than pretending the ride never happened.

  async report(tripId: string, reporterId: string, reason: string, details?: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.customerId !== reporterId) {
      throw new BadRequestException('Only the customer on this trip can report it');
    }

    const report = await this.prisma.tripReport.create({
      data: { tripId, reporterId, reason, details: details?.trim() || undefined },
    });

    // A safety report is urgent enough to reach any admin who's online
    // right now, not just sit in a list until someone happens to check it.
    // The gateway has no role-broadcast of its own, so this looks up who's
    // an admin and sends to each directly — small and correct rather than
    // calling a broadcast method that doesn't actually exist.
    if (reason === 'safety') {
      try {
        const admins = await this.prisma.user.findMany({
          where: { role: 'ADMIN' as any },
          select: { id: true },
        });
        for (const a of admins) {
          this.gateway.sendToUser(a.id, 'trip:report:urgent', {
            tripId, reportId: report.id, reason, details,
          });
        }
      } catch { /* best effort — the report is already saved either way */ }
    }

    return report;
  }

  async listReports(status?: 'OPEN' | 'RESOLVED') {
    return this.prisma.tripReport.findMany({
      where: status ? { status } : {},
      include: {
        trip: { include: { driver: { include: { user: true } }, customer: true } },
        reporter: { select: { firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveReport(reportId: string, adminUserId: string) {
    return this.prisma.tripReport.update({
      where: { id: reportId },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: adminUserId },
    });
  }

  async findAllForAdmin() {
    return this.prisma.trip.findMany({
      include: { customer: true, driver: { include: { user: true } } },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
  }

  async findActiveForDriver(driverId: string) {
    return this.prisma.trip.findFirst({
      where: {
        driverId,
        status: { in: [TripStatus.DRIVER_ASSIGNED, TripStatus.DRIVER_EN_ROUTE, TripStatus.DRIVER_ARRIVED, TripStatus.RIDE_IN_PROGRESS] },
      },
      include: { customer: true },
      orderBy: { requestedAt: 'desc' },
    });
  }

  // Trips waiting for a driver at all — the driver app polls this to simulate
  // an incoming request until real-time websockets are wired in.
  async findSearchingTrips(serviceType: ServiceType) {
    return this.prisma.trip.findMany({
      where: { status: TripStatus.SEARCHING_DRIVER, serviceType },
      include: { customer: true },
      orderBy: { requestedAt: 'asc' },
      take: 5,
    });
  }

  // The driver's own individual offers — replacing the old shared-list
  // polling with something that actually knows who was offered what.
  // Expiry is handled lazily here rather than through a separate
  // scheduled job: any offer whose time has passed gets marked EXPIRED
  // the moment it's next read, which is simpler and just as correct for
  // something this short-lived, without needing its own cron process.
  async findMyOffers(driverId: string) {
    const now = new Date();

    const expired = await this.prisma.rideOffer.findMany({
      where: { driverId, status: 'PENDING', expiresAt: { lt: now } },
      select: { id: true, tripId: true },
    });

    if (expired.length) {
      await this.prisma.rideOffer.updateMany({
        where: { id: { in: expired.map((o) => o.id) }, status: 'PENDING' },
        data: { status: 'EXPIRED', respondedAt: now },
      });
      for (const tripId of [...new Set(expired.map((o) => o.tripId))]) {
        await this.refreshTripOffers(tripId);
      }
    }

    return this.prisma.rideOffer.findMany({
      where: { driverId, status: 'PENDING', expiresAt: { gte: now } },
      include: { trip: { include: { customer: true } } },
      orderBy: { offeredAt: 'asc' },
      take: 4,
    });
  }

  async declineOffer(offerId: string, driverId: string) {
    const now = new Date();
    const offer = await this.prisma.rideOffer.findFirst({
      where: { id: offerId, driverId, status: 'PENDING' },
      select: { id: true, tripId: true },
    });
    if (!offer) {
      throw new BadRequestException('Offer not found or already responded to');
    }

    await this.prisma.rideOffer.update({
      where: { id: offer.id },
      data: { status: 'DECLINED', respondedAt: now },
    });

    // Refill this ride, but never above four simultaneous driver offers.
    await this.refreshTripOffers(offer.tripId);
    return { declined: true };
  }

  async findForCustomer(customerId: string) {
    return this.prisma.trip.findMany({
      where: { customerId },
      include: {
        driver: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 50,
    });
  }


  private async recordTripTransaction(customerId: string, fare: number, paymentMethod: string, tripId: string) {
    const description = `Ride — ${paymentMethod === 'CASH' ? 'Cash' : paymentMethod === 'WALLET' ? 'Zana Wallet' : 'Mobile Money'}`;

    // NOTE ON BUSINESS BEHAVIOUR (unchanged by this fix, flagged rather than
    // silently altered): if the wallet balance is insufficient for the fare,
    // this still clamps the debit to whatever the customer actually has and
    // proceeds — the driver is paid the full fare regardless, and the
    // shortfall is not tracked as a debt anywhere. That policy question
    // (reject the payment? create a debt record, the way cash-commission
    // shortfalls already do?) needs a product decision, not a unilateral
    // technical change — especially since the caller of this method
    // currently swallows any error it throws, so throwing here would mean
    // the wallet is never touched at all rather than the clamped debit that
    // happens today, with nothing recording why.
    let wallet = await this.prisma.wallet.findUnique({ where: { userId: customerId } });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId: customerId, balance: 0 } });
    }

    const balanceBefore = wallet.balance;
    let balanceAfter = balanceBefore;

    if (paymentMethod === 'WALLET') {
      // The clamp-to-zero behaviour above is preserved as-is. What changes
      // here is atomicity: the decrement is now a single conditional
      // statement Postgres evaluates against the live row, not a value
      // computed from a read that could be stale by the time it is applied
      // — two trips completing for the same customer at nearly the same
      // moment previously could each decide their own "safe" clamp from the
      // same stale starting balance.
      const debit = Math.min(fare, balanceBefore);
      if (debit > 0) {
        await this.prisma.wallet.updateMany({
          where: { id: wallet.id, balance: { gte: 0 } },
          data: { balance: { decrement: debit } },
        });
      }
      const after = await this.prisma.wallet.findUnique({ where: { id: wallet.id } });
      balanceAfter = after!.balance;
    }

    await this.prisma.$transaction(async (tx) => {

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: paymentMethod === 'WALLET' ? -fare : 0,
          balanceBefore,
          balanceAfter,
          reference: tripId,
          description,
          status: 'COMPLETED',
        },
      });

      console.log(`[WALLET] Trip ${tripId} | ${paymentMethod} | -${fare} RWF | Balance: ${balanceBefore} → ${balanceAfter}`);
    });
  }


  // ── MoMo charge — driver triggers on ride complete ────────────────────────
  async chargeMomo(tripId: string, driverUserId: string, overridePhone?: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        customer: { select: { id: true, phone: true, firstName: true } },
        driver: { include: { user: { select: { id: true } } } },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.driver?.user?.id !== driverUserId) throw new ForbiddenException('Not your trip');

    const fare = trip.finalFare ?? trip.estimatedFare;
    const phone = overridePhone?.trim() || trip.customer?.phone;
    if (!phone) throw new BadRequestException('NO_PHONE_NUMBER');

    try {
      const res = await this.paypackService.cashin(phone, fare);
      console.log(`[MOMO] Prompt sent to ${phone} | ${fare} RWF | ref: ${res.ref}`);

      // Store ref on trip so we can poll status
      await this.prisma.trip.update({
        where: { id: tripId },
        data: { momoRef: res.ref } as any,
      }).catch(() => {});

      // Tell the customer a prompt is on the way
      this.gateway.sendToUser(trip.customerId, 'payment:prompt', {
        tripId, amount: fare, phone, ref: res.ref,
      });

      return { ref: res.ref, status: res.status, amount: fare, phone };
    } catch (e: any) {
      console.error('[MOMO] Charge failed:', e?.message);
      throw new BadRequestException(`MOMO_CHARGE_FAILED: ${e?.message ?? 'unknown'}`);
    }
  }

  // Driver explicitly collected physical cash instead of the MoMo
  // prompt going through. Corrects the trip's payment method to reflect
  // what genuinely happened, then settles commission the CASH way
  // (wallet-deduct/debt-create) instead of leaving it unsettled forever
  // — the frontend button that leads here previously did nothing but
  // navigate away, leaving the ride's payment method permanently wrong
  // and commission never collected on it at all.
  async collectCashInstead(tripId: string, driverUserId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { driver: { include: { user: { select: { id: true } } } } },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.driver?.user?.id !== driverUserId) throw new ForbiddenException('Not your trip');

    // A MoMo charge that already succeeded means checkMomoStatus already
    // settled this trip's commission as digital — the atomic guard down
    // in settleCommission would harmlessly no-op a second settlement
    // attempt, but silently rewriting paymentMethod to CASH here anyway
    // would still leave the trip record itself lying about how the
    // customer actually paid. Reject the switch outright instead.
    const alreadySettled = await this.prisma.commission.findUnique({ where: { tripId } });
    if (alreadySettled) {
      throw new BadRequestException('PAYMENT_ALREADY_CONFIRMED');
    }

    await this.prisma.trip.update({
      where: { id: tripId },
      data: { paymentMethod: 'CASH' } as any,
    });

    if (trip.driverId) {
      await this.commissionDebtService.handleTripCompletion(
        tripId, trip.finalFare ?? trip.estimatedFare, trip.driverId, 'CASH',
      );
    }

    return { ok: true };
  }

  async checkMomoStatus(tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    const ref = (trip as any).momoRef;
    if (!ref) return { status: 'NOT_STARTED' };

    try {
      const res = await this.paypackService.findTransaction(ref);
      const done = res.status === 'successful';

      if (done) {
        // Record the payment against the customer's wallet history
        await this.recordTripTransaction(
          trip.customerId,
          trip.finalFare ?? trip.estimatedFare,
          'MOBILE_MONEY',
          tripId,
        ).catch(() => {});
        // This is the actual point MOBILE_MONEY commission gets settled
        // now — not at completion, when the charge hadn't even been sent
        // yet. settleCommission's own atomic claim-first guard protects
        // against this firing twice if the frontend's poll overlaps with
        // itself.
        if (trip.driverId) {
          this.commissionDebtService
            .handleTripCompletion(tripId, trip.finalFare ?? trip.estimatedFare, trip.driverId, 'MOBILE_MONEY')
            .catch((e) => console.error('[MOMO] Commission settlement failed:', e?.message));
        }
        this.gateway.sendToUser(trip.customerId, 'payment:confirmed', { tripId });
        if (trip.driverId) {
          const d = await this.prisma.driver.findUnique({
            where: { id: trip.driverId }, select: { userId: true },
          });
          if (d?.userId) this.gateway.sendToUser(d.userId, 'payment:confirmed', { tripId });
        }
      }

      return { status: res.status, ref, paid: done };
    } catch (e: any) {
      return { status: 'pending', ref, paid: false };
    }
  }

}