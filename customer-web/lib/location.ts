export type Coords = { lat: number; lng: number; address?: string };

// Shown whenever a live GPS position can't be obtained. There is deliberately
// no saved or default (Kigali) fallback: a wrong pickup is worse than none.
export const LOCATION_ERROR_MESSAGE =
  "We can't get your location. Turn on location services, allow Zana to use it, then try again.";

// Browser/WebView geolocation: high-accuracy fix first, then a coarser network
// fix. Never retries after a permission denial.
function getBrowserPosition(): Promise<Coords | null> {
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

// Inside the Android/iOS app the WebView's own geolocation is unreliable
// (permission prompts and timeouts differ from a normal browser), so use
// Capacitor's native Geolocation plugin, which asks for the OS permission
// properly. Resolves undefined when not in the app or the plugin isn't
// available in this installed build, so the caller falls back to the browser.
async function getNativePosition(): Promise<Coords | null | undefined> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return undefined;
    const { Geolocation } = await import('@capacitor/geolocation');
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
    }
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') return null;
    const attempt = (enableHighAccuracy: boolean, timeout: number) =>
      Geolocation.getCurrentPosition({ enableHighAccuracy, timeout, maximumAge: 0 });
    let pos;
    try {
      pos = await attempt(true, 10000);
    } catch {
      pos = await attempt(false, 10000);
    }
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    // Plugin missing from this build, or the native fix failed/timed out:
    // let the caller try the browser's own geolocation as a second source.
    return undefined;
  }
}

// Gets the device's live GPS position. Resolves null when it can't be
// determined (unsupported, permission denied, timeout, no signal) so callers
// can tell the user instead of guessing. Never falls back to a stored or
// default location.
export async function getLivePosition(): Promise<Coords | null> {
  if (typeof window === 'undefined') return null;
  const native = await getNativePosition();
  if (native !== undefined) return native;
  return getBrowserPosition();
}

// Same live-only behaviour; kept as aliases so existing screens keep working.
export const requestLiveLocation = getLivePosition;
export const getCurrentPositionFresh = getLivePosition;
