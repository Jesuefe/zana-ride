import { KIGALI_CENTER } from './places';

const PICKUP_KEY = 'zana_pickup_coords';

export type Coords = { lat: number; lng: number };

// Reads the last known pickup location from localStorage, falling back to
// Kigali's center if geolocation was never granted or hasn't run yet.
export function getStoredPickup(): Coords {
  if (typeof window === 'undefined') return KIGALI_CENTER;
  try {
    const raw = window.localStorage.getItem(PICKUP_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to default
  }
  return KIGALI_CENTER;
}

export function setStoredPickup(coords: Coords) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PICKUP_KEY, JSON.stringify(coords));
}

function storePickup(coords: Coords) {
  window.localStorage.setItem(PICKUP_KEY, JSON.stringify(coords));
}

// Requests the browser's real GPS location and caches it for the booking
// flow to use as pickup. Silently keeps the previous/default value if the
// user denies permission or the browser has no geolocation support.
export function requestLiveLocation(): Promise<Coords> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(getStoredPickup());
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        storePickup(coords);
        resolve(coords);
      },
      () => resolve(getStoredPickup()),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}
