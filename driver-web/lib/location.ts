'use client';

export type Coords = { lat: number; lng: number };

// Gets a single fresh GPS reading. Used on load and as a fallback.
export function getCurrentPosition(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

// Starts continuous GPS tracking, calling onUpdate with each new reading.
// Returns a cleanup function to stop watching.
export function watchPosition(onUpdate: (coords: Coords) => void): () => void {
  if (typeof window === 'undefined' || !navigator.geolocation) return () => {};
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => {},
    { enableHighAccuracy: true },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}
