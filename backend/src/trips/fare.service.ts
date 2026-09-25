import { Injectable, OnModuleInit } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type FareRates = {
  base: number;
  perKm: number;
  perMin: number;
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
  BIKE: { base: 342, perKm: 132, perMin: 0, bookingFee: 0, minimum: 500, commissionRate: 15, freeWaitingMinutes: 10, waitingPerMinute: 100 },
  ECONOMY: { base: -3737, perKm: 1447, perMin: 0, bookingFee: 0, minimum: 4000, commissionRate: 15, freeWaitingMinutes: 10, waitingPerMinute: 100 },
  COMFORT: { base: -5605, perKm: 2171, perMin: 0, bookingFee: 0, minimum: 6000, commissionRate: 15, freeWaitingMinutes: 10, waitingPerMinute: 100 },
};

// These were the previous FareConfig seed values. They did not drive the
// live calibrated fare engine, so a first production boot after this change
// upgrades only untouched legacy rows. A genuinely customized admin rate is
// left alone.
const LEGACY_RATES: Record<ServiceType, Omit<FareRates, 'commissionRate' | 'freeWaitingMinutes' | 'waitingPerMinute'>> = {
  BIKE: { base: 500, perKm: 250, perMin: 30, bookingFee: 100, minimum: 1000 },
  ECONOMY: { base: 1000, perKm: 400, perMin: 50, bookingFee: 200, minimum: 1500 },
  COMFORT: { base: 1500, perKm: 600, perMin: 70, bookingFee: 300, minimum: 2500 },
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
        await this.prisma.fareConfig.create({ data: { serviceType: type, ...rates } });
        continue;
      }

      const legacy = LEGACY_RATES[type];
      const untouchedLegacy =
        existing.base === legacy.base &&
        existing.perKm === legacy.perKm &&
        existing.perMin === legacy.perMin &&
        existing.bookingFee === legacy.bookingFee &&
        existing.minimum === legacy.minimum;

      if (untouchedLegacy) {
        await this.prisma.fareConfig.update({
          where: { serviceType: type },
          data: rates,
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
        perMin: c.perMin,
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

  estimateFare(serviceType: ServiceType, distanceKm: number, durationMin: number) {
    const rates = this.getRates(serviceType);
    const safeDistanceKm = Math.max(0, distanceKm);
    const safeDurationMin = Math.max(0, durationMin);

    const normalFare = Math.max(
      rates.minimum,
      rates.base +
        safeDistanceKm * rates.perKm +
        safeDurationMin * rates.perMin +
        rates.bookingFee,
    );

    // Existing Kigali rush policy is preserved; admin fare controls change
    // the underlying rate card without changing the platform's time policy.
    const kigaliHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Kigali',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date()),
    );

    const isRushHour =
      (kigaliHour >= 7 && kigaliHour < 10) ||
      (kigaliHour >= 17 && kigaliHour < 19);

    const rushMultiplier = isRushHour ? 1.2 : 1;

    return Math.round(normalFare * rushMultiplier);
  }

  async findAll() {
    return this.prisma.fareConfig.findMany({ orderBy: { serviceType: 'asc' } });
  }

  async update(serviceType: ServiceType, rates: Partial<FareRates>) {
    const allowed: Partial<FareRates> = {};
    for (const key of ['base','perKm','perMin','bookingFee','minimum','commissionRate','freeWaitingMinutes','waitingPerMinute'] as const) {
      if (rates[key] !== undefined) allowed[key] = rates[key];
    }

    const updated = await this.prisma.fareConfig.update({
      where: { serviceType },
      data: allowed,
    });
    await this.refreshCache();
    return updated;
  }
}
