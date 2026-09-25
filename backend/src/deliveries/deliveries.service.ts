import { Injectable, NotFoundException, BadRequestException, BadGatewayException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeliveryStatus, PackageWeight } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { ZanaGateway } from '../gateway/zana.gateway';
import { PaypackService } from '../wallet/paypack.service';
import { LocationCodeService } from './location-code.service';
import { haversineKm, estimateDurationMinutes } from '../trips/fare.util';
import { CommissionDebtService } from '../trips/commission-debt.service';
import { assertValidDeliveryTransition } from './delivery-state-machine';

// Deliveries are priced on distance like rides, with a multiplier for heavier
// packages — a 20kg load is a different job from an envelope even over the
// same route.
const WEIGHT_MULTIPLIER: Record<PackageWeight, number> = {
  UNDER_1KG: 1,
  KG_1_TO_5: 1.15,
  KG_5_TO_10: 1.35,
  KG_10_TO_20: 1.6,
  OVER_20KG: 2,
};

const DELIVERY_BASE = 700;
const DELIVERY_PER_KM = 300;
const DELIVERY_PER_MIN = 30;
const DELIVERY_MINIMUM = 1200;

export type CreateDeliveryInput = {
  itemDescription: string;
  weight: PackageWeight;
  imageBase64?: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  locationCode?: string;
  receiverName?: string;
  receiverPhone: string;
  // The customer's own MoMo number for MOBILE_MONEY payment — previously
  // never collected at all, so the backend silently charged whatever
  // phone number happened to be on the account, with no way for the
  // customer to use a different number or even see which one would be
  // charged. Matches how a driver can already correct the phone before
  // charging a ride via momo-charge; a customer deserves the same.
  momoPhone?: string;
};

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private gateway: ZanaGateway,
    private paypack: PaypackService,
    private locationCodes: LocationCodeService,
    private commissionDebt: CommissionDebtService,
  ) {}

  quote(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number, weight: PackageWeight) {
    const distanceKm = Math.max(0.8, haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng));
    const durationMin = estimateDurationMinutes(distanceKm);
    const raw =
      (DELIVERY_BASE + distanceKm * DELIVERY_PER_KM + durationMin * DELIVERY_PER_MIN) * WEIGHT_MULTIPLIER[weight];
    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMinutes: durationMin,
      fee: Math.max(DELIVERY_MINIMUM, Math.round(raw)),
    };
  }

  async create(input: CreateDeliveryInput, owner: { customerId?: string; merchantId?: string }) {
    // The dropoff can come either from a map selection or from a Zana
    // location code the receiver shared.
    let dropoffLat = input.dropoffLat;
    let dropoffLng = input.dropoffLng;
    let dropoffAddress = input.dropoffAddress;

    if (input.locationCode) {
      const resolved = await this.locationCodes.resolve(input.locationCode);
      dropoffLat = resolved.lat;
      dropoffLng = resolved.lng;
      dropoffAddress = resolved.address ?? `Shared location (${resolved.code})`;
    }

    if (dropoffLat === undefined || dropoffLng === undefined) {
      throw new BadRequestException('A delivery location or location code is required');
    }

    const { distanceKm, fee } = this.quote(
      input.pickupLat,
      input.pickupLng,
      dropoffLat,
      dropoffLng,
      input.weight,
    );

    let imageUrl: string | null = null;
    if (input.imageBase64) {
      imageUrl = await this.storage.uploadPackageImage(input.imageBase64);
    }

    // ── Take payment before the delivery exists ───────────────────────────
    // A courier should never be dispatched for an unpaid job.
    const paymentMethod = (input as any).paymentMethod ?? 'WALLET';
    const payerId = owner.customerId;

    if (paymentMethod === 'WALLET' && payerId) {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId: payerId } });
      const balance = wallet?.balance ?? 0;
      if (!wallet || balance < fee) {
        throw new BadRequestException(`INSUFFICIENT_WALLET_BALANCE:${balance}:${fee}`);
      }
    }

    const delivery = await this.prisma.delivery.create({
      data: {
        customerId: owner.customerId,
        merchantId: owner.merchantId,
        itemDescription: input.itemDescription,
        weight: input.weight,
        imageUrl,
        pickupAddress: input.pickupAddress,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        dropoffAddress: dropoffAddress ?? 'Shared location',
        dropoffLat,
        dropoffLng,
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        distanceKm,
        fee,
        status: DeliveryStatus.REQUESTED,
        trackingCode: 'ZD' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        paymentMethod,
      } as any,
    });

    // ── Settle the fee ────────────────────────────────────────────────────
    if (payerId && fee > 0) {
      if (paymentMethod === 'WALLET') {
        await this.debitWallet(payerId, fee, delivery.id);
        await this.prisma.delivery.update({
          where: { id: delivery.id }, data: { paid: true } as any,
        });
        this.logger.log(`[DELIVERY] ${(delivery as any).trackingCode} paid from wallet | ${fee} RWF`);
      } else if (paymentMethod === 'MOBILE_MONEY') {
        const customer = await this.prisma.user.findUnique({
          where: { id: payerId }, select: { phone: true },
        });
        // A customer-entered number takes priority — previously this
        // always silently used the account's own registered phone with
        // no way to charge a different number at all.
        const chargePhone = input.momoPhone?.trim() || customer?.phone;
        if (!chargePhone) {
          // Previously silently did nothing here — no charge attempted,
          // no error thrown, but the delivery still got created and
          // would then sit permanently stuck (never payable, so never
          // dispatchable) with no explanation to the customer at all.
          throw new BadRequestException('NO_PHONE_NUMBER');
        }
        try {
            const res = await this.paypack.cashin(chargePhone, fee);
            await this.prisma.delivery.update({
              where: { id: delivery.id }, data: { momoRef: res.ref } as any,
            });
            this.logger.log(`[DELIVERY] MoMo prompt sent to ${chargePhone} | ${fee} RWF`);
          } catch (e: any) {
            this.logger.error(`[DELIVERY] MoMo charge failed: ${e?.message}`);
            throw new BadRequestException('MOMO_CHARGE_FAILED');
          }
      }
      // CASH is settled with the rider on handover — nothing to do here.
    }

    // Only burn the code once a delivery actually exists for it.
    if (input.locationCode) {
      await this.locationCodes.consume(input.locationCode).catch(() => {});
    }

    return delivery;
  }

  // Mirrors checkTopUpStatus's exact proven pattern — same real Paypack
  // poll, same atomic-claim guard against a double-process race, adapted
  // to this model's plain `paid` boolean instead of a status enum. This
  // is what actually closes the gap where a delivery was previously
  // dispatchable the instant a MoMo charge was *initiated*, regardless
  // of whether the customer ever approved it.
  async checkDeliveryPaymentStatus(deliveryId: string, customerId: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.customerId !== customerId) throw new ForbiddenException('Not your delivery');

    if ((delivery as any).paid || (delivery as any).paymentMethod === 'CASH') {
      return { status: 'confirmed' };
    }
    if (delivery.status === 'CANCELLED') {
      return { status: 'failed' };
    }
    const ref = (delivery as any).momoRef;
    if (!ref) return { status: 'pending' };

    const remote = await this.paypack.findTransaction(ref);
    const remoteStatus = remote.status?.toLowerCase();
    const isFailed = remoteStatus === 'failed' || remoteStatus === 'cancelled' || remoteStatus === 'canceled';
    const isStillPending = remoteStatus === 'pending';

    if (!isFailed && !isStillPending) {
      // Same double-process protection as the wallet flow — the
      // customer's own poll and any future background reconciler could
      // both observe paid: false at nearly the same moment.
      const claimed = await this.prisma.delivery.updateMany({
        where: { id: deliveryId, paid: false } as any,
        data: { paid: true } as any,
      });
      if (claimed.count === 0) {
        const current = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
        return { status: (current as any)?.paid ? 'confirmed' : 'pending' };
      }
      return { status: 'confirmed' };
    }

    if (isFailed) {
      // No point holding a delivery around that can never actually be
      // paid for and dispatched.
      await this.prisma.delivery.update({
        where: { id: deliveryId },
        data: { status: 'CANCELLED' as any },
      }).catch(() => {});
      return { status: 'failed' };
    }

    return { status: 'pending' };
  }

  async findById(id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: { driver: { include: { user: true } } },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  async findForCustomer(customerId: string) {
    return this.prisma.delivery.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { driver: { include: { user: true } } },
    });
  }

  async findForMerchant(merchantId: string) {
    return this.prisma.delivery.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      include: { driver: { include: { user: true } } },
    });
  }

  async updateStatus(id: string, status: DeliveryStatus) {
    const current = await this.prisma.delivery.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Delivery not found');

    // The one place every status mutation in the system now passes
    // through — driver pickup/complete, admin override, anything added
    // later. Previously nothing stopped a delivery jumping straight from
    // REQUESTED to DELIVERED with no real pickup ever happening.
    assertValidDeliveryTransition(current.status, status);

    const data: any = { status };
    if (status === DeliveryStatus.PICKED_UP) data.pickedUpAt = new Date();
    if (status === DeliveryStatus.DELIVERED) {
      data.deliveredAt = new Date();
      // Schedule the package photo for removal a week after confirmation.
      data.imageDeleteAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // Atomic, conditional on the status this call actually validated
    // against — two concurrent requests both reading REQUESTED and both
    // trying to write COURIER_ASSIGNED can now only have one actually
    // succeed; the second finds count === 0 and knows someone else won.
    const { count } = await this.prisma.delivery.updateMany({
      where: { id, status: current.status },
      data,
    });
    if (count === 0) {
      throw new BadRequestException('STATUS_ALREADY_CHANGED');
    }

    const updated = await this.prisma.delivery.findUnique({
      where: { id },
      include: { order: { include: { merchant: true } } },
    });
    // Genuinely shouldn't happen — this row was just the target of the
    // atomic update above — but TypeScript is right that findUnique's
    // return type allows it, and a silent null here would be worse than
    // a clear failure.
    if (!updated) throw new NotFoundException('Delivery not found after update');

    // Tell everyone who cares that the parcel moved
    try {
      const payload = {
        deliveryId: id,
        status,
        trackingCode: (updated as any).trackingCode,
      };
      if (updated.customerId) this.gateway.sendToUser(updated.customerId, 'delivery:status', payload);
      const merchantUserId = (updated as any).order?.merchant?.userId;
      if (merchantUserId) this.gateway.sendToUser(merchantUserId, 'delivery:status', payload);

      // Admin previously had no live path for this at all — same small,
      // direct reuse of sendToUser as everywhere else, not new
      // infrastructure, just a new set of recipients.
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN' as any }, select: { id: true },
      });
      for (const a of admins) this.gateway.sendToUser(a.id, 'delivery:status', payload);
    } catch (e: any) {
      console.error('[DELIVERY] Status notify failed:', e?.message);
    }

    // Whatever the driver is still carrying just changed — the stop that
    // was just picked up or delivered is done either way, but everything
    // still remaining should reflect the driver's position now, not
    // wherever they were when they first accepted these jobs.
    if ((status === DeliveryStatus.PICKED_UP || status === DeliveryStatus.DELIVERED) && updated.driverId) {
      await this.reorderRoute(updated.driverId).catch(() => {});
    }

    return updated;
  }

  // The audit's Critical Issue #1 — pickup and complete previously wrote
  // directly to the database inside the controller with no check that
  // the caller was actually the assigned driver. Both now resolve the
  // real driver record from the authenticated user, verify ownership,
  // then delegate to the same validated, atomic updateStatus every other
  // caller — including admin — goes through, rather than duplicating
  // the write.
  async pickupDelivery(deliveryId: string, userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new ForbiddenException('Not a driver account');

    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverId !== driver.id) {
      throw new ForbiddenException('This delivery is not assigned to you');
    }

    return this.updateStatus(deliveryId, DeliveryStatus.PICKED_UP);
  }

  async completeDelivery(deliveryId: string, userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new ForbiddenException('Not a driver account');

    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverId !== driver.id) {
      throw new ForbiddenException('This delivery is not assigned to you');
    }

    // updateStatus's own atomic guard is what actually makes this
    // idempotent — a second, near-simultaneous complete call reads the
    // same starting status, loses the race on the conditional write, and
    // gets STATUS_ALREADY_CHANGED before ever reaching the payment step
    // below. That ordering is what prevents a driver being paid twice
    // for one delivery, not a separate check here.
    const updated = await this.updateStatus(deliveryId, DeliveryStatus.DELIVERED);

    if (delivery.driverId) {
      await this.commissionDebt
        .handleDeliveryCompletion(deliveryId, delivery.fee, delivery.driverId, delivery.paymentMethod)
        .catch((e) => console.error('[DELIVERY] Commission settlement failed:', e?.message));
    }

    // The old force-set-paid-at-completion fallback that lived here is
    // gone — it existed to paper over deliveries that reached completion
    // without ever having their MoMo payment actually confirmed. Now
    // that acceptDelivery() itself refuses an unpaid, non-cash delivery
    // before a driver can ever take it, a delivery genuinely cannot
    // reach this point unless paid is already correctly true (or it's
    // cash, settled separately). Silently flipping it here again would
    // just resurrect the exact bug this whole fix closes.

    // Preserved from the old controller-side write — a delivery that
    // originated from a merchant food order needs that order marked
    // delivered too, not just the delivery record itself.
    if ((delivery as any).orderId) {
      await this.prisma.order.update({
        where: { id: (delivery as any).orderId },
        data: { status: 'DELIVERED' },
      }).catch(() => {});
    }

    return updated;
  }

  // Admin Delivery KPIs — one authoritative aggregation layer, all done
  // in the database rather than loading records into memory. Financial
  // figures are summed from the same Commission/CommissionDebt records
  // the completion flow itself writes — never recalculated independently
  // here, so there's no way for this to disagree with what actually
  // happened.
  async getAdminKpis(from: Date, to: Date) {
    const dateFilter = { gte: from, lte: to };

    const [statusCounts, deliveredAgg, cashAgg, digitalAgg, commissionSumRow, debtOutstanding, debtSettled, durationRow] =
      await Promise.all([
        this.prisma.delivery.groupBy({
          by: ['status'],
          where: { createdAt: dateFilter },
          _count: { _all: true },
        }),
        this.prisma.delivery.aggregate({
          where: { status: 'DELIVERED', createdAt: dateFilter },
          _sum: { fee: true },
          _avg: { fee: true },
          _count: { _all: true },
        }),
        this.prisma.delivery.aggregate({
          where: { status: 'DELIVERED', createdAt: dateFilter, paymentMethod: 'CASH' },
          _sum: { fee: true },
        }),
        this.prisma.delivery.aggregate({
          where: { status: 'DELIVERED', createdAt: dateFilter, paymentMethod: { not: 'CASH' } },
          _sum: { fee: true },
        }),
        // Commission has no real relation to Delivery (same gap found
        // earlier this session), so this joins them directly in SQL
        // rather than pulling every delivery commission ever into
        // memory and filtering there — the same result, but the
        // database does the filtering, not the application.
        this.prisma.$queryRaw<{ total: bigint | null }[]>`
          SELECT SUM(c.amount) as total
          FROM "Commission" c
          JOIN "Delivery" d ON d.id = c."deliveryId"
          WHERE d.status = 'DELIVERED' AND d."createdAt" >= ${from} AND d."createdAt" <= ${to}
        `,
        this.prisma.commissionDebt.aggregate({
          where: { deliveryId: { not: null }, paidAt: null },
          _sum: { amount: true },
        }),
        this.prisma.commissionDebt.aggregate({
          where: { deliveryId: { not: null }, paidAt: { not: null }, createdAt: dateFilter },
          _sum: { amount: true },
        }),
        this.prisma.$queryRaw<{ avg_total: number | null; avg_assign: number | null; avg_pickup_to_delivery: number | null }[]>`
          SELECT
            AVG(EXTRACT(EPOCH FROM ("deliveredAt" - "createdAt")) / 60) as avg_total,
            AVG(EXTRACT(EPOCH FROM ("assignedAt" - "createdAt")) / 60) as avg_assign,
            AVG(EXTRACT(EPOCH FROM ("deliveredAt" - "pickedUpAt")) / 60) as avg_pickup_to_delivery
          FROM "Delivery"
          WHERE status = 'DELIVERED' AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        `,
      ]);

    const countFor = (s: string) => statusCounts.find(c => c.status === s)?._count._all ?? 0;
    const totalRequested = statusCounts.reduce((sum, c) => sum + c._count._all, 0);
    const deliveredCount = deliveredAgg._count._all;
    const totalCommission = Number(commissionSumRow[0]?.total ?? 0);

    const gmv = deliveredAgg._sum.fee ?? 0;
    const duration = durationRow[0];

    return {
      range: { from, to },
      volume: {
        totalRequested,
        requested: countFor('REQUESTED'),
        assigned: countFor('COURIER_ASSIGNED'),
        pickedUp: countFor('PICKED_UP'),
        delivered: countFor('DELIVERED'),
        cancelled: countFor('CANCELLED'),
      },
      financial: {
        gmv,
        zanaCommission: totalCommission,
        driverEarnings: gmv - totalCommission,
        cashGmv: cashAgg._sum.fee ?? 0,
        digitalGmv: digitalAgg._sum.fee ?? 0,
        outstandingCommissionDebt: debtOutstanding._sum.amount ?? 0,
        commissionDebtSettled: debtSettled._sum.amount ?? 0,
      },
      performance: {
        completionRate: totalRequested > 0 ? Math.round((deliveredCount / totalRequested) * 1000) / 10 : null,
        averageDeliveryValue: deliveredCount > 0 ? Math.round(deliveredAgg._avg.fee ?? 0) : null,
        // Minutes, rounded — null rather than 0 or NaN when there's
        // nothing completed yet in this range to average.
        averageDeliveryDurationMinutes: duration?.avg_total != null ? Math.round(Number(duration.avg_total)) : null,
        averageAssignmentTimeMinutes: duration?.avg_assign != null ? Math.round(Number(duration.avg_assign)) : null,
        averagePickupToDeliveryMinutes: duration?.avg_pickup_to_delivery != null ? Math.round(Number(duration.avg_pickup_to_delivery)) : null,
      },
    };
  }

  // and clears out location codes that were never redeemed.
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredData() {
    const due = await this.prisma.delivery.findMany({
      where: { imageDeleteAfter: { lte: new Date() }, imageUrl: { not: null } },
      select: { id: true, imageUrl: true },
    });

    for (const d of due) {
      if (!d.imageUrl) continue;
      try {
        await this.storage.deleteByUrl(d.imageUrl);
        await this.prisma.delivery.update({
          where: { id: d.id },
          data: { imageUrl: null, imageDeleteAfter: null },
        });
      } catch (err) {
        this.logger.warn(`Failed to clean up image for delivery ${d.id}: ${err}`);
      }
    }

    await this.prisma.locationCode.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  }

  // Target for a job to be claimed before it starts shouting for attention.
  private static readonly ACCEPT_TARGET_MS = 5 * 60 * 1000;

  /**
   * The open pool a rider chooses from. Sorted by urgency rather than pure
   * distance, so a parcel that has been waiting does not sit unclaimed just
   * because something closer keeps arriving.
   *
   * When the rider already holds jobs we also mark which ones fit their run,
   * so they can see at a glance what they are allowed to take.
   */
  async findPendingForDriver(lat: number, lng: number, radiusKm = 10, driverId?: string) {
    const deliveries = await this.prisma.delivery.findMany({
      where: {
        status: 'REQUESTED',
        driverId: null,
        // A driver shouldn't see something they'd immediately be
        // rejected for accepting — a digital payment that hasn't
        // actually been confirmed yet shouldn't appear as available,
        // even though acceptDelivery() itself also blocks it directly.
        OR: [{ paymentMethod: 'CASH' } as any, { paid: true } as any],
      },
      include: {
        customer: { select: { firstName: true, phone: true } },
        merchant: { select: { businessName: true } },
        order: { include: { market: { select: { name: true } } } },
      },
    });

    const held = driverId
      ? await this.prisma.delivery.findMany({
          where: { driverId, status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } },
        })
      : [];

    const atCapacity = held.length >= DeliveriesService.MAX_CONCURRENT;
    const now = Date.now();

    return deliveries
      .map(d => {
        const waitingMs = now - new Date(d.createdAt).getTime();
        const overdue = waitingMs > DeliveriesService.ACCEPT_TARGET_MS;
        const detourKm = held.length > 0 ? this.detourFromRoute(held, d) : 0;

        return {
          ...d,
          distanceKm: Math.round(haversineKm(lat, lng, d.pickupLat, d.pickupLng) * 10) / 10,
          waitingMinutes: Math.floor(waitingMs / 60000),
          overdue,
          detourKm: Math.round(detourKm * 10) / 10,
          // Why the rider can or cannot take this one
          canAccept: !atCapacity && (held.length === 0 || detourKm <= DeliveriesService.MAX_DETOUR_KM),
          blockedReason: atCapacity
            ? 'AT_CAPACITY'
            : held.length > 0 && detourKm > DeliveriesService.MAX_DETOUR_KM
              ? 'OFF_ROUTE'
              : null,
        };
      })
      .filter(d => d.distanceKm <= radiusKm)
      .sort((a, b) => {
        // Anything past the 5 minute target jumps the queue.
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        // Then jobs that fit the rider's existing run.
        if (a.canAccept !== b.canAccept) return a.canAccept ? -1 : 1;
        // Then whatever is closest.
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, 12);
  }

  // How many jobs one rider may hold, and how far a new job may pull them
  // off the run they already committed to.
  private static readonly MAX_CONCURRENT = 3;
  private static readonly MAX_DETOUR_KM = 3.5;

  async acceptDelivery(deliveryId: string, driverId: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverId) throw new BadRequestException('ALREADY_ACCEPTED');

    // Cash is collected in person at dropoff, so there's nothing to
    // confirm up front. But a digital payment only ever had its charge
    // *initiated* here (paypack.cashin only starts the MoMo prompt) —
    // nothing previously verified the customer actually approved it
    // before a courier could be dispatched, picked up, and completed
    // for a payment that may never have gone through at all.
    if ((delivery as any).paymentMethod !== 'CASH' && !(delivery as any).paid) {
      throw new BadRequestException('PAYMENT_NOT_CONFIRMED');
    }

    // Same gap found and fixed on the ride side this morning — the
    // display already hides delivery offers from an offline driver, but
    // nothing here ever actually verified it.
    const acceptingDriver = await this.prisma.driver.findUnique({
      where: { id: driverId }, select: { onlineStatus: true },
    });
    if (acceptingDriver?.onlineStatus !== 'ONLINE') {
      throw new BadRequestException('You must be online to accept a delivery');
    }

    // What is this rider already carrying?
    const held = await this.prisma.delivery.findMany({
      where: { driverId, status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } },
      orderBy: { routeSequence: 'asc' },
    });

    if (held.length >= DeliveriesService.MAX_CONCURRENT) {
      throw new BadRequestException(
        `TOO_MANY_ACTIVE:${held.length}:${DeliveriesService.MAX_CONCURRENT}`,
      );
    }

    // A second or third job must sit roughly along the run already accepted,
    // otherwise the rider ends up criss-crossing the city and everything
    // arrives late.
    if (held.length > 0) {
      const detour = this.detourFromRoute(held, delivery);
      if (detour > DeliveriesService.MAX_DETOUR_KM) {
        throw new BadRequestException(
          `OFF_ROUTE:${detour.toFixed(1)}:${DeliveriesService.MAX_DETOUR_KM}`,
        );
      }
    }

    // The earlier "if (delivery.driverId) throw" check above only ever
    // caught the ordinary, non-racing case — it reads the row, but
    // doesn't hold any lock on it, so two drivers both passing that
    // check at nearly the same moment could both reach this exact write.
    // A plain unconditional update here meant whichever request the
    // database happened to process second would silently overwrite the
    // first driver's real, successful acceptance — the identical bug
    // already found and fixed on the ride side this morning, just never
    // caught here despite this delivery-batching feature having been
    // built the same day. This only succeeds if the delivery is still
    // genuinely unclaimed at the moment of the actual write itself.
    const { count } = await this.prisma.delivery.updateMany({
      where: { id: deliveryId, driverId: null },
      data: {
        driverId,
        status: 'COURIER_ASSIGNED',
        assignedAt: new Date(),
        routeSequence: held.length + 1, // placeholder — reorderRoute fixes this right below
      } as any,
    });

    if (count === 0) {
      throw new BadRequestException('ALREADY_ACCEPTED');
    }

    const updated = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });

    // Was previously left at pure acceptance order — now recomputed by
    // actual distance from wherever the driver currently is.
    await this.reorderRoute(driverId);

    this.logger.log(
      `[DELIVERY] ${(updated as any).trackingCode} accepted — rider now holds ${held.length + 1}`,
    );
    return updated;
  }

  // Shortest distance from the candidate's pickup and drop-off to any point
  // already on the rider's route. Straight-line, which is good enough to
  // reject obviously wrong jobs without paying for a routing API call.
  private detourFromRoute(held: any[], candidate: any): number {
    const routePoints: { lat: number; lng: number }[] = [];
    for (const d of held) {
      if (d.status === 'COURIER_ASSIGNED') {
        routePoints.push({ lat: d.pickupLat, lng: d.pickupLng });
      }
      routePoints.push({ lat: d.dropoffLat, lng: d.dropoffLng });
    }
    if (routePoints.length === 0) return 0;

    const nearest = (lat: number, lng: number) =>
      Math.min(...routePoints.map(p => haversineKm(lat, lng, p.lat, p.lng)));

    return Math.max(
      nearest(candidate.pickupLat, candidate.pickupLng),
      nearest(candidate.dropoffLat, candidate.dropoffLng),
    );
  }

  // Recomputes the run order for everything a rider currently holds, using
  // a straightforward nearest-next-stop pass from their current position —
  // not full route optimization (no traffic, no deadlines, no capacity
  // weighting yet), just picking whichever remaining stop is genuinely
  // closest each time, rather than the previous behavior of ordering
  // purely by which delivery happened to be accepted first. A driver who
  // accepted a far pickup first and a much closer one second was
  // previously told to go to the far one first regardless.
  //
  // Only ever reorders what the driver hasn't reached yet — called right
  // after a new delivery joins the held set, and again right after a
  // pickup or dropoff completes, never on a timer or continuously while
  // the driver is already en route to their current next stop.
  private async reorderRoute(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { lastLat: true, lastLng: true },
    });
    const held = await this.prisma.delivery.findMany({
      where: { driverId, status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } },
    });
    if (held.length === 0) return;

    let fromLat = driver?.lastLat ?? held[0].pickupLat;
    let fromLng = driver?.lastLng ?? held[0].pickupLng;
    const remaining = [...held];
    const ordered: typeof held = [];

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = remaining[i];
        // Not yet picked up → the relevant next point is its pickup;
        // already on board → the relevant next point is its dropoff.
        const targetLat = d.status === 'PICKED_UP' ? d.dropoffLat : d.pickupLat;
        const targetLng = d.status === 'PICKED_UP' ? d.dropoffLng : d.pickupLng;
        const dist = haversineKm(fromLat, fromLng, targetLat, targetLng);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      ordered.push(next);
      fromLat = next.status === 'PICKED_UP' ? next.dropoffLat : next.pickupLat;
      fromLng = next.status === 'PICKED_UP' ? next.dropoffLng : next.pickupLng;
    }

    await Promise.all(
      ordered.map((d, i) =>
        this.prisma.delivery.update({ where: { id: d.id }, data: { routeSequence: i + 1 } as any }),
      ),
    );
  }

  // Every job the rider is currently carrying, in the order they should run it.
  async activeForDriver(driverId: string) {
    return this.prisma.delivery.findMany({
      where: { driverId, status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } },
      orderBy: [{ routeSequence: 'asc' }, { assignedAt: 'asc' }],
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        merchant: { select: { businessName: true, businessAddress: true, businessLat: true, businessLng: true } },
      },
    });
  }

  // ── Proof-of-handling photos ──────────────────────────────────────────────
  // The driver photographs the parcel at pickup and at drop-off. Upload
  // failures must never block the delivery, so callers treat this as
  // best-effort and the driver can continue regardless.
  async attachPhoto(deliveryId: string, stage: 'pickup' | 'dropoff', imageBase64: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');

    const url = await this.storage.uploadImage(imageBase64, `deliveries/${stage}`);
    if (!url) throw new BadGatewayException('IMAGE_UPLOAD_UNAVAILABLE');

    return this.prisma.delivery.update({
      where: { id: deliveryId },
      data: stage === 'pickup'
        ? ({ pickupPhotoUrl: url } as any)
        : ({ dropoffPhotoUrl: url } as any),
    });
  }

  // Shared tracking lookup — the same code works for customer, merchant,
  // driver and admin, so everyone sees one consistent record.
  async findByTrackingCode(code: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { trackingCode: code.trim().toUpperCase() } as any,
      include: {
        driver: { include: { user: { select: { firstName: true, phone: true } } } },
        order: { include: { merchant: true, items: { include: { product: true } } } },
      },
    });
    if (delivery) {
      // Commission has no real relation to Delivery — fetched
      // separately and attached here, same authoritative records the
      // completion flow itself writes, never recalculated.
      const [commission, debt] = await Promise.all([
        this.prisma.commission.findUnique({ where: { deliveryId: delivery.id } }),
        this.prisma.commissionDebt.findFirst({ where: { deliveryId: delivery.id } }),
      ]);
      return {
        type: 'DELIVERY',
        ...delivery,
        financials: commission ? {
          gmv: delivery.fee,
          paymentMethod: delivery.paymentMethod,
          paid: delivery.paid,
          zanaCommission: commission.amount,
          driverEarnings: delivery.fee - commission.amount,
          commissionDebt: debt?.amount ?? 0,
          debtStatus: debt ? (debt.paidAt ? 'PAID' : 'OUTSTANDING') : 'N/A',
          settlement: debt?.settledVia ?? null,
        } : null,
      };
    }

    const order = await this.prisma.order.findUnique({
      where: { trackingCode: code.trim().toUpperCase() } as any,
      include: { merchant: true, items: { include: { product: true } }, delivery: true },
    });
    if (order) return { type: 'ORDER', ...order };

    throw new NotFoundException('No delivery or order found with that code');
  }


  private async debitWallet(userId: string, amount: number, deliveryId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException('WALLET_NOT_FOUND');

    // Atomic conditional decrement — two delivery payments racing for the
    // same wallet (a double-tap on "Send", two open tabs) re-check this
    // WHERE clause against whatever the balance actually is at write time,
    // not a value read moments earlier that could already be stale.
    const debited = await this.prisma.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (debited.count === 0) throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');

    const after = await this.prisma.wallet.findUnique({ where: { id: wallet.id } });
    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -amount,
        balanceBefore: wallet.balance,
        balanceAfter: after!.balance,
        reference: deliveryId,
        description: 'Package delivery',
        status: 'COMPLETED',
      } as any,
    });
  }

  async checkDeliveryPayment(deliveryId: string) {
    const d = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!d) throw new NotFoundException('Delivery not found');
    if ((d as any).paid) return { paid: true, status: 'successful' };
    const ref = (d as any).momoRef;
    if (!ref) return { paid: false, status: 'NOT_STARTED' };
    try {
      const res = await this.paypack.findTransaction(ref);
      if (res.status === 'successful') {
        await this.prisma.delivery.update({
          where: { id: deliveryId }, data: { paid: true } as any,
        });
        return { paid: true, status: res.status };
      }
      return { paid: false, status: res.status };
    } catch {
      return { paid: false, status: 'pending' };
    }
  }


  // Everything this driver has handled, newest first. Drivers need to see
  // what they delivered and what it earned them, not just the live job.
  async findForDriver(driverId: string, limit = 60) {
    return this.prisma.delivery.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: { include: { merchant: true, market: true } },
      },
    });
  }

  async driverDeliveryStats(driverId: string) {
    const all = await this.prisma.delivery.findMany({
      where: { driverId },
      select: { status: true, fee: true, deliveredAt: true },
    });

    const done = all.filter(d => d.status === 'DELIVERED');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const today = done.filter(d => d.deliveredAt && d.deliveredAt >= startOfDay);

    return {
      totalDeliveries: done.length,
      totalEarned: done.reduce((s, d) => s + (d.fee ?? 0), 0),
      todayDeliveries: today.length,
      todayEarned: today.reduce((s, d) => s + (d.fee ?? 0), 0),
      active: all.filter(d =>
        ['COURIER_ASSIGNED', 'PICKED_UP'].includes(d.status)).length,
    };
  }


  // Rider position while carrying parcels. Pushed to the customer, the
  // merchant and admin so everyone watches the same dot.
  async broadcastDriverPosition(driverId: string, lat: number, lng: number) {
    const active = await this.prisma.delivery.findMany({
      where: { driverId, status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } },
      include: { order: { include: { merchant: { select: { userId: true } } } } },
    });
    if (active.length === 0) return { broadcast: 0 };

    let sent = 0;
    for (const d of active) {
      const payload = {
        deliveryId: d.id,
        trackingCode: (d as any).trackingCode,
        status: d.status,
        lat, lng,
        at: new Date().toISOString(),
      };
      if (d.customerId) { this.gateway.sendToUser(d.customerId, 'delivery:position', payload); sent++; }
      const merchantUserId = (d as any).order?.merchant?.userId;
      if (merchantUserId) { this.gateway.sendToUser(merchantUserId, 'delivery:position', payload); sent++; }
    }

    // Admins watch every parcel in flight.
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' }, select: { id: true },
    });
    for (const a of admins) {
      this.gateway.sendToUser(a.id, 'delivery:position', {
        driverId, lat, lng,
        deliveries: active.map(d => ({ id: d.id, code: (d as any).trackingCode, status: d.status })),
        at: new Date().toISOString(),
      });
    }

    return { broadcast: sent };
  }

  // ── Reviews ───────────────────────────────────────────────────────────────

  async submitReview(userId: string, data: {
    target: 'DELIVERY' | 'MERCHANT' | 'MARKET';
    rating: number;
    comment?: string;
    deliveryId?: string;
    merchantId?: string;
    marketId?: string;
    orderId?: string;
  }) {
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('RATING_MUST_BE_1_TO_5');
    }

    // Only rate something you were actually part of.
    if (data.target === 'DELIVERY') {
      if (!data.deliveryId) throw new BadRequestException('DELIVERY_ID_REQUIRED');
      const d = await this.prisma.delivery.findUnique({ where: { id: data.deliveryId } });
      if (!d) throw new NotFoundException('Delivery not found');
      if (d.customerId !== userId) throw new ForbiddenException('NOT_YOUR_DELIVERY');
      if (d.status !== 'DELIVERED') throw new BadRequestException('DELIVERY_NOT_COMPLETE');

      const already = await this.prisma.review.findFirst({
        where: { deliveryId: data.deliveryId, fromUserId: userId },
      });
      if (already) throw new BadRequestException('ALREADY_REVIEWED');
    }

    if (data.target === 'MERCHANT' && data.orderId) {
      const o = await this.prisma.order.findUnique({ where: { id: data.orderId } });
      if (!o) throw new NotFoundException('Order not found');
      if (o.customerId !== userId) throw new ForbiddenException('NOT_YOUR_ORDER');

      const already = await this.prisma.review.findFirst({
        where: { orderId: data.orderId, fromUserId: userId, target: 'MERCHANT' },
      });
      if (already) throw new BadRequestException('ALREADY_REVIEWED');
    }

    return this.prisma.review.create({
      data: {
        target: data.target as any,
        rating: data.rating,
        comment: data.comment,
        fromUserId: userId,
        deliveryId: data.deliveryId ?? null,
        merchantId: data.merchantId ?? null,
        marketId: data.marketId ?? null,
        orderId: data.orderId ?? null,
      } as any,
    });
  }

  async ratingSummary(target: 'MERCHANT' | 'MARKET', id: string) {
    const reviews = await this.prisma.review.findMany({
      where: target === 'MERCHANT' ? { merchantId: id } : { marketId: id },
      select: { rating: true },
    });
    if (reviews.length === 0) return { average: null, count: 0 };
    const total = reviews.reduce((s, r) => s + r.rating, 0);
    return {
      average: Math.round((total / reviews.length) * 10) / 10,
      count: reviews.length,
    };
  }


  // ── Admin oversight ───────────────────────────────────────────────────────

  /**
   * Deliveries nobody has picked up. A parcel in an area with no online riders
   * would otherwise sit in the pool indefinitely with nobody watching, so
   * admin needs to see them and step in.
   */
  async unassignedDeliveries() {
    const rows = await this.prisma.delivery.findMany({
      where: { status: 'REQUESTED', driverId: null },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        order: { include: { merchant: true, market: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();
    return rows.map(d => {
      const waitingMinutes = Math.floor((now - new Date(d.createdAt).getTime()) / 60000);
      return {
        ...d,
        waitingMinutes,
        // Past five minutes it has missed the acceptance target; past twenty
        // it needs someone to intervene rather than wait.
        severity: waitingMinutes > 20 ? 'CRITICAL'
          : waitingMinutes > 5 ? 'OVERDUE'
          : 'WAITING',
      };
    });
  }

  /**
   * Riders who could take a given delivery, nearest first. Shows everyone
   * online rather than filtering hard, because an admin assigning manually
   * usually knows something the algorithm does not.
   */
  async driversNearDelivery(deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');

    const drivers = await this.prisma.driver.findMany({
      where: { approvalStatus: 'APPROVED' },
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    });

    const active = await this.prisma.delivery.groupBy({
      by: ['driverId'],
      where: { status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } },
      _count: { id: true },
    });
    const load = new Map<string, number>(
      active.map(a => [a.driverId as string, a._count.id as number]),
    );

    return drivers
      .map(d => {
        const carrying: number = load.get(d.id) ?? 0;
        const km = (d.lastLat != null && d.lastLng != null)
          ? haversineKm(d.lastLat, d.lastLng, delivery.pickupLat, delivery.pickupLng)
          : null;
        const fresh = d.lastLocationAt
          ? Date.now() - new Date(d.lastLocationAt).getTime() < 10 * 60 * 1000
          : false;

        return {
          id: d.id,
          name: [d.user?.firstName, d.user?.lastName].filter(Boolean).join(' ') || 'Driver',
          phone: d.user?.phone,
          onlineStatus: d.onlineStatus,
          carrying,
          atCapacity: carrying >= DeliveriesService.MAX_CONCURRENT,
          distanceKm: km == null ? null : Math.round(km * 10) / 10,
          locationFresh: fresh,
        };
      })
      .sort((a, b) => {
        // Online and free first, then nearest.
        if (a.atCapacity !== b.atCapacity) return a.atCapacity ? 1 : -1;
        const aOn = a.onlineStatus === 'ONLINE', bOn = b.onlineStatus === 'ONLINE';
        if (aOn !== bOn) return aOn ? -1 : 1;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }

  /**
   * Admin assigns a rider directly. This deliberately bypasses the route and
   * capacity checks that apply when a rider self-selects — an admin doing
   * this is solving a problem the automatic rules created.
   */
  async assignDriver(deliveryId: string, driverId: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverId) throw new BadRequestException('ALREADY_ASSIGNED');

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: { select: { id: true, firstName: true } } },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const held = await this.prisma.delivery.count({
      where: { driverId, status: { in: ['COURIER_ASSIGNED', 'PICKED_UP'] } },
    });

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        driverId,
        status: 'COURIER_ASSIGNED',
        assignedAt: new Date(),
        routeSequence: held + 1,
      } as any,
    });

    // The rider did not choose this, so tell them clearly.
    if (driver.user?.id) {
      this.gateway.sendToUser(driver.user.id, 'delivery:assigned', {
        deliveryId,
        trackingCode: (updated as any).trackingCode,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        fee: delivery.fee,
        assignedByAdmin: true,
      });
    }
    if (delivery.customerId) {
      this.gateway.sendToUser(delivery.customerId, 'delivery:status', {
        deliveryId,
        status: 'COURIER_ASSIGNED',
        trackingCode: (updated as any).trackingCode,
      });
    }

    this.logger.log(
      `[DELIVERY] ${(updated as any).trackingCode} manually assigned to ${driver.user?.firstName ?? driverId}`,
    );
    return updated;
  }

}