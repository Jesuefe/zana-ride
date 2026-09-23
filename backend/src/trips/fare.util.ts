import { ServiceType } from '@prisma/client';

type FareRates = {
  base: number;
  perKm: number;
  min: number;
};

// ZANA Kigali calibrated fare model.
//
// REAL ROUTE ANCHORS supplied from Google Maps + observed/accepted fares:
//   Ihumure Apartment (KG 125 St) -> Rwanco Village: 8.8 km
//     Moto = 1,500 RWF
//     Car  = 9,000 RWF
//   Rwanco Village - Busanza -> Kigali Car Free Zone: 16.4 km
//     Moto = 2,500 RWF
//     Car  = 20,000 RWF
//
// The two anchors are used to fit separate linear curves for moto and car.
// This is deliberately different from the old generic placeholder rates.
//
// Moto fitted curve:
//   fare = 342.105 + (131.579 * km)
//   => 8.8 km = 1,500 RWF
//   => 16.4 km = 2,500 RWF
//
// Car fitted curve:
//   fare = -3,736.842 + (1,447.368 * km)
//   => 8.8 km = 9,000 RWF
//   => 16.4 km = 20,000 RWF
//
// Because the car curve is fitted from long-trip anchors, a minimum fare
// protects short trips from the negative theoretical intercept. The short-trip
// floor is a ZANA product setting, not a claim about a RURA tariff.
//
// RURA reference (NOT used as the ZANA fare):
// The RURA 2021 motorcycle decision lists 300 RWF for up to 2 km,
// 107 RWF/km after 2 km through 40 km, and 187 RWF/km beyond 40 km.
// We expose that reference separately so the admin/audit layer can compare
// ZANA's calibrated price against the regulatory reference.
//
// Rush periods use Kigali local time (Africa/Kigali):
//   Morning: 07:00–10:00
//   Evening: 17:00–19:00
//
// Rush is applied after the normal vehicle fare: normal * 1.20.

const MOTO: FareRates = {
  base: 342.10526315789434,
  perKm: 131.5789473684211,
  min: 500,
};

const CAR: FareRates = {
  base: -3736.842105263162,
  perKm: 1447.368421052632,
  min: 4000,
};

// ECONOMY and COMFORT are both car categories for the current calibrated model.
// We keep one car curve until we have real COMFORT route anchors rather than
// inventing a second pricing curve.
const RATES: Record<ServiceType, FareRates> = {
  BIKE: MOTO,
  ECONOMY: CAR,
  COMFORT: CAR,
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

/**
 * RURA motorcycle fare reference from Board Decision
 * No. 03/BD/RD-TRP/2021.
 *
 * This is a comparison value only. It is intentionally not substituted
 * into the ZANA fare because the ZANA product model is calibrated against
 * the two real Kigali route anchors above.
 */
export function ruraMotoReferenceFare(distanceKm: number) {
  if (distanceKm <= 2) return 300;

  if (distanceKm <= 40) {
    return 300 + (distanceKm - 2) * 107;
  }

  return 300 + (38 * 107) + (distanceKm - 40) * 187;
}

export function estimateFare(
  serviceType: ServiceType,
  distanceKm: number,
  _durationMin: number,
  date = new Date(),
) {
  const r = RATES[serviceType];

  const safeDistanceKm = Math.max(0, distanceKm);
  const normalFare = Math.max(r.min, r.base + safeDistanceKm * r.perKm);
  const rush = isRushHour(date);
  const multiplier = rush ? RUSH_MULTIPLIER : 1;

  const result: {
    fare: number;
    normalFare: number;
    rushMultiplier: number;
    isRushHour: boolean;
    ruraReferenceFare?: number;
  } = {
    fare: Math.round(normalFare * multiplier),
    normalFare: Math.round(normalFare),
    rushMultiplier: multiplier,
    isRushHour: rush,
  };

  if (serviceType === ServiceType.BIKE) {
    result.ruraReferenceFare = Math.round(ruraMotoReferenceFare(safeDistanceKm));
  }

  return result;
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
