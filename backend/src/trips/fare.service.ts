import { Injectable, OnModuleInit } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type FareRates = { base: number; perKm: number; perMin: number; bookingFee: number; minimum: number };

// Seed values used to populate the database on first boot. After that the
// database is the source of truth, so pricing can be changed from the admin
// dashboard without a redeploy.
const DEFAULT_RATES: Record<ServiceType, FareRates> = {
  BIKE: { base: 500, perKm: 250, perMin: 30, bookingFee: 100, minimum: 1000 },
  ECONOMY: { base: 1000, perKm: 400, perMin: 50, bookingFee: 200, minimum: 1500 },
  COMFORT: { base: 1500, perKm: 600, perMin: 70, bookingFee: 300, minimum: 2500 },
};

@Injectable()
export class FareService implements OnModuleInit {
  // Cached in memory so fare estimates don't hit the database on every
  // request — refreshed whenever an admin updates pricing.
  private cache: Record<string, FareRates> = { ...DEFAULT_RATES };

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeeded();
    await this.refreshCache();
  }

  private async ensureSeeded() {
    for (const [serviceType, rates] of Object.entries(DEFAULT_RATES)) {
      await this.prisma.fareConfig.upsert({
        where: { serviceType: serviceType as ServiceType },
        update: {},
        create: { serviceType: serviceType as ServiceType, ...rates },
      });
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
      };
    }
  }

  getRates(serviceType: ServiceType): FareRates {
    return this.cache[serviceType] ?? DEFAULT_RATES[serviceType];
  }

  estimateFare(serviceType: ServiceType, distanceKm: number, _durationMin: number) {
    // ZANA Kigali calibrated fare model.
    // Moto anchors:
    // 8.8 km  -> 1,500 RWF
    // 16.4 km -> 2,500 RWF
    //
    // Car anchors:
    // 8.8 km  -> 9,000 RWF
    // 16.4 km -> 20,000 RWF
    //
    // ZANA calculates its own fare. RURA is NOT used to calculate
    // or override the customer fare.
    const MOTO_BASE = 342.10526315789434;
    const MOTO_PER_KM = 131.5789473684211;
    const MOTO_MINIMUM = 500;

    const CAR_BASE = -3736.842105263162;
    const CAR_PER_KM = 1447.368421052632;
    const CAR_MINIMUM = 4000;

    const safeDistanceKm = Math.max(0, distanceKm);

    const isCar =
      serviceType === ServiceType.ECONOMY ||
      serviceType === ServiceType.COMFORT;

    const base = isCar ? CAR_BASE : MOTO_BASE;
    const perKm = isCar ? CAR_PER_KM : MOTO_PER_KM;
    const minimum = isCar ? CAR_MINIMUM : MOTO_MINIMUM;

    const normalFare = Math.max(
      minimum,
      base + safeDistanceKm * perKm,
    );

    // Kigali local time.
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
    const updated = await this.prisma.fareConfig.update({
      where: { serviceType },
      data: rates,
    });
    await this.refreshCache();
    return updated;
  }
}
