import { ServiceType } from '@prisma/client';

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Estimated drive time is informational only. It is never an input to the
// canonical normal ride fare calculation.
export function estimateDurationMinutes(distanceKm: number) {
  return Math.max(2, Math.round((distanceKm / 28) * 60));
}

// Kept for backwards-compatible imports in delivery/market code; fare pricing
// itself lives exclusively in Trips/FareService.
export type RouteServiceType = ServiceType;
