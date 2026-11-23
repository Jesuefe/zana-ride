export type Coords = { lat: number; lng: number; address?: string };

// Shown whenever a live GPS position can't be obtained. There is deliberately
// no saved or default (Kigali) fallback: a wrong pickup is worse than none.
export const LOCATION_ERROR_MESSAGE =
  "We can't get your location. Turn on location services, allow Zana to use it, then try again.";

// Gets the device's live GPS position. Resolves null when it can't be
// determined (unsupported, permission denied, timeout, no signal) so callers
// can tell the user instead of guessing. Tries a high-accuracy fix first, then
// a coarser network fix, but never retries after a permission denial and never
// falls back to a stored or default location.
export function getLivePosition(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const onSuccess = (pos: GeolocationPosition) =>
      resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        // 1 = PERMISSION_DENIED: a second attempt can't succeed.
        if (err.code === 1) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

// Same live-only behaviour; kept as aliases so existing screens keep working.
export const requestLiveLocation = getLivePosition;
export const getCurrentPositionFresh = getLivePosition;
