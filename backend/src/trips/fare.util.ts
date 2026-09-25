import { ServiceType } from '@prisma/client';

type FareRates = { base: number; perKm: number; perMin: number; bookingFee: number; min: number };

// Matches the pricing shown in the admin dashboard's Pricing & Zones page.
// Move this into the database (see admin pricing endpoints, section 28 of the
// spec) once fares need to be editable without a redeploy.
const RATES: Record<ServiceType, FareRates> = {
  BIKE: { base: 500, perKm: 250, perMin: 30, bookingFee: 100, min: 1000 },
  ECONOMY: { base: 1000, perKm: 400, perMin: 50, bookingFee: 200, min: 1500 },
  COMFORT: { base: 1500, perKm: 600, perMin: 70, bookingFee: 300, min: 2500 },
};

export function estimateFare(serviceType: ServiceType, distanceKm: number, durationMin: number) {
  const r = RATES[serviceType];
  const raw = r.base + distanceKm * r.perKm + durationMin * r.perMin + r.bookingFee;
  return Math.max(r.min, Math.round(raw));
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

// ~28 km/h average — rough placeholder until a real routing provider
// (Google Routes API, per the spec) supplies actual drive-time estimates.
export function estimateDurationMinutes(distanceKm: number) {
  return Math.max(2, Math.round((distanceKm / 28) * 60));
}
