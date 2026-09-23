import { ServiceType } from '@prisma/client';

type FareRates = {
  base: number;
  perKm: number;
  min: number;
};

// ZANA Kigali fare structure.
// BIKE = motorcycle/moto.
// ECONOMY and COMFORT = car categories.
//
// Fare formula:
//   normal = max(minimum, base + distanceKm * perKm)
//   rush   = round(normal * 1.20)
//
// Rush periods use Kigali local time (Africa/Kigali):
//   Morning: 07:00–10:00
//   Evening: 17:00–19:00
//
// Keep the rush multiplier separate from the vehicle tariff so moto and car
// fares remain independently configurable.
const RATES: Record<ServiceType, FareRates> = {
  BIKE: { base: 300, perKm: 150, min: 700 },
  ECONOMY: { base: 1000, perKm: 550, min: 2000 },
  COMFORT: { base: 1500, perKm: 600, min: 2500 },
};

const RUSH_MULTIPLIER = 1.2;

function minutesInKigali(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kigali',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function isRushHour(date = new Date()) {
  const minutes = minutesInKigali(date);

  const morningRush = minutes >= 7 * 60 && minutes < 10 * 60;
  const eveningRush = minutes >= 17 * 60 && minutes < 19 * 60;

  return morningRush || eveningRush;
}

export function estimateFare(
  serviceType: ServiceType,
  distanceKm: number,
  _durationMin: number,
  date = new Date(),
) {
  const r = RATES[serviceType];

  // Vehicle fare is calculated independently by service type.
  const normalFare = Math.max(r.min, r.base + distanceKm * r.perKm);
  const rush = isRushHour(date);
  const multiplier = rush ? RUSH_MULTIPLIER : 1;

  return {
    fare: Math.round(normalFare * multiplier),
    normalFare: Math.round(normalFare),
    rushMultiplier: multiplier,
    isRushHour: rush,
  };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Placeholder duration until the routing provider supplies real drive time.
// Duration is displayed/returned but is no longer added to the fare.
export function estimateDurationMinutes(distanceKm: number) {
  return Math.max(2, Math.round((distanceKm / 28) * 60));
}
