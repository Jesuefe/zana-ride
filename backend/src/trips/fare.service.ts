import { Injectable, OnModuleInit } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type FareRates = {
  base: number;
  perKm: number;
  bookingFee: number;
  minimum: number;
  commissionRate: number;
  freeWaitingMinutes: number;
  waitingPerMinute: number;
};

// These defaults preserve the existing calibrated ZANA fare curves while
// moving the operational source of truth into FareConfig. Admin changes are
// therefore live and do not require a redeploy.
const DEFAULT_RATES: Record<ServiceType, FareRates> = {
  BIKE: { base: 342, perKm: 132, bookingFee: 0, minimum: 500, commissionRate: 15, freeWaitingMinutes: 10, waitingPerMinute: 100 },
  ECONOMY: { base: -3737, perKm: 1447, bookingFee: 0, minimum: 4000, commissionRate: 15, freeWaitingMinutes: 10, waitingPerMinute: 100 },
  COMFORT: { base: -5605, perKm: 2171, bookingFee: 0, minimum: 6000, commissionRate: 15, freeWaitingMinutes: 10, waitingPerMinute: 100 },
};

// These were the previous FareConfig seed values. They did not drive the
// live calibrated fare engine, so a first production boot after this change
// upgrades only untouched legacy rows. A genuinely customized admin rate is
// left alone.
const LEGACY_RATES: Record<ServiceType, Omit<FareRates, 'commissionRate' | 'freeWaitingMinutes' | 'waitingPerMinute'>> = {
  BIKE: { base: 500, perKm: 250, bookingFee: 100, minimum: 1000 },
  ECONOMY: { base: 1000, perKm: 400, bookingFee: 200, minimum: 1500 },
  COMFORT: { base: 1500, perKm: 600, bookingFee: 300, minimum: 2500 },
};

@Injectable()
export class FareService implements OnModuleInit {
  private cache: Record<string, FareRates> = { ...DEFAULT_RATES };

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeeded();
    await this.refreshCache();
  }

  private async ensureSeeded() {
    for (const [serviceType, rates] of Object.entries(DEFAULT_RATES)) {
      const type = serviceType as ServiceType;
      const existing = await this.prisma.fareConfig.findUnique({ where: { serviceType: type } });

      if (!existing) {
        // Prisma still requires the legacy column, but it is permanently
        // disconnected from pricing. New rows keep it at zero.
        await this.prisma.fareConfig.create({ data: { serviceType: type, ...rates, perMin: 0 } });
        continue;
      }

      const legacy = LEGACY_RATES[type];
      const untouchedLegacy =
        existing.base === legacy.base &&
        existing.perKm === legacy.perKm &&
        existing.bookingFee === legacy.bookingFee &&
        existing.minimum === legacy.minimum;

      if (untouchedLegacy) {
        await this.prisma.fareConfig.update({
          where: { serviceType: type },
          data: { ...rates, perMin: 0 },
        });
      } else {
        // Keep an existing operator-configured card intact, but fill the new
        // operational controls when Prisma added them with their defaults.
        await this.prisma.fareConfig.update({
          where: { serviceType: type },
          data: {
            commissionRate: existing.commissionRate ?? rates.commissionRate,
            freeWaitingMinutes: existing.freeWaitingMinutes ?? rates.freeWaitingMinutes,
            waitingPerMinute: existing.waitingPerMinute ?? rates.waitingPerMinute,
          },
        });
      }
    }
  }

  async refreshCache() {
    const configs = await this.prisma.fareConfig.findMany();
    for (const c of configs) {
      this.cache[c.serviceType] = {
        base: c.base,
        perKm: c.perKm,
        bookingFee: c.bookingFee,
        minimum: c.minimum,
        commissionRate: c.commissionRate,
        freeWaitingMinutes: c.freeWaitingMinutes,
        waitingPerMinute: c.waitingPerMinute,
      };
    }
  }

  getRates(serviceType: ServiceType): FareRates {
    return this.cache[serviceType] ?? DEFAULT_RATES[serviceType];
  }

  estimateFare(serviceType: ServiceType, distanceKm: number, _durationMin: number, now = new Date()) {
    const rates = this.getRates(serviceType);
    const safeDistanceKm = Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0);

    // NORMAL RIDE FARE: duration is informational only.
    // Never use the legacy perMin field here. Waiting is calculated separately
    // from the actual DRIVER_ARRIVED timestamp via calculateWaitingFee().
    const normalFare = Math.max(
      rates.minimum,
      rates.base +
        safeDistanceKm * rates.perKm +
        rates.bookingFee,
    );

    // Existing Kigali rush policy is preserved; admin fare controls change
    // the underlying rate card without changing the platform's time policy.
    const kigaliHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Kigali',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );

    const isRushHour =
      (kigaliHour >= 7 && kigaliHour < 10) ||
      (kigaliHour >= 17 && kigaliHour < 19);

    const rushMultiplier = isRushHour ? 1.2 : 1;

    return Math.round(normalFare * rushMultiplier);
  }

  /**
   * Canonical customer-waiting fee. Waiting starts only at actual ARRIVED,
   * never at request/assignment/en-route/estimated-arrival time.
   */
  calculateWaitingFee(
    serviceType: ServiceType,
    arrivedAt: Date | null | undefined,
    endedAt: Date | null | undefined = new Date(),
  ) {
    if (!arrivedAt) return 0;
    const startMs = new Date(arrivedAt).getTime();
    const endMs = new Date(endedAt ?? new Date()).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

    const rates = this.getRates(serviceType);
    const elapsedMinutes = Math.max(0, Math.ceil((endMs - startMs) / 60000));
    const chargeableMinutes = Math.max(0, elapsedMinutes - rates.freeWaitingMinutes);
    return Math.round(chargeableMinutes * rates.waitingPerMinute);
  }

  async findAll() {
    return this.prisma.fareConfig.findMany({ orderBy: { serviceType: 'asc' } });
  }

  async update(serviceType: ServiceType, rates: Partial<FareRates>) {
    const allowed: Partial<FareRates> = {};
    for (const key of ['base','perKm','bookingFee','minimum','commissionRate','freeWaitingMinutes','waitingPerMinute'] as const) {
      if (rates[key] !== undefined) allowed[key] = rates[key];
    }
    // perMin is intentionally not writable through the operational fare API:
    // it is a deprecated legacy duration field and must never become a live
    // normal-ride pricing input again.

    const updated = await this.prisma.fareConfig.update({
      where: { serviceType },
      data: allowed,
    });
    await this.refreshCache();
    return updated;
  }
}
