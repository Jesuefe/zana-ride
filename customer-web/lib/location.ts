export type Coords = { lat: number; lng: number; address?: string };

// Shown whenever a live GPS position can't be obtained. There is deliberately
// no saved or default (Kigali) fallback: a wrong pickup is worse than none.
export const LOCATION_ERROR_MESSAGE =
  "We can't get your location. Turn on location services, allow Zana to use it, then try again.";

export type LocationFailureReason = 'denied' | 'services-off' | 'timeout' | 'unsupported' | 'unknown';
export type LocationFailure = { reason: LocationFailureReason; detail?: string };
export type LocationResult = { coords: Coords } | { failure: LocationFailure };

// Plain-language explanation of why a fix failed, so the rider knows what to
// change instead of guessing. `detail` is the raw error, kept short for support.
export function describeLocationFailure(f?: LocationFailure | null): string {
  if (!f) return LOCATION_ERROR_MESSAGE;
  const detail = f.detail ? ` (${f.detail.slice(0, 80)})` : '';
  switch (f.reason) {
    case 'denied':
      return "We can't get your location because location access is off for Zana. Open your phone Settings → Apps → Zana → Permissions → Location and choose Allow, then try again.";
    case 'services-off':
      return `We can't get your location because your phone's Location is switched off. Turn Location on in your phone's quick settings, then try again.${detail}`;
    case 'timeout':
      return `We can't get your location yet: the GPS didn't answer in time. Move near a window or outside, then try again.${detail}`;
    case 'unsupported':
      return "We can't get your location because this device or browser doesn't support it.";
    default:
      return `${LOCATION_ERROR_MESSAGE}${detail}`;
  }
}

function classify(code: number | undefined, message: string): LocationFailureReason {
  const m = message.toLowerCase();
  if (code === 1 || /denied|permission/.test(m)) return 'denied';
  if (/services? (are )?(not enabled|disabled|off)|location.*(disabled|off)|unavailable/.test(m) || code === 2) return 'services-off';
  if (code === 3 || /time(d)? ?out/.test(m)) return 'timeout';
  return 'unknown';
}

// Browser/WebView geolocation: high-accuracy fix first, then a coarser network
// fix. Never retries after a permission denial.
function getBrowserPosition(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve({ failure: { reason: 'unsupported' } });
      return;
    }
    const onSuccess = (pos: GeolocationPosition) =>
      resolve({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
    const onFail = (err: GeolocationPositionError) =>
      resolve({ failure: { reason: classify(err.code, err.message ?? ''), detail: `web ${err.code}` } });
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        // 1 = PERMISSION_DENIED: a second attempt can't succeed.
        if (err.code === 1) {
          onFail(err);
          return;
        }
        navigator.geolocation.getCurrentPosition(onSuccess, onFail, {
          enableHighAccuracy: false, timeout: 10000, maximumAge: 0,
        });
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
async function getNativePosition(): Promise<LocationResult | { nativeError: string } | undefined> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return undefined;
    const { Geolocation } = await import('@capacitor/geolocation');
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
    }
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      return { failure: { reason: 'denied', detail: `app ${perm.location}` } };
    }
    const attempt = (enableHighAccuracy: boolean, timeout: number) =>
      Geolocation.getCurrentPosition({ enableHighAccuracy, timeout, maximumAge: 0 });
    let pos;
    try {
      pos = await attempt(true, 10000);
    } catch {
      pos = await attempt(false, 10000);
    }
    return { coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
  } catch (e) {
    // Plugin missing from this build, or the native fix failed/timed out:
    // fall back to the browser's own geolocation; if that also fails we
    // report the native reason, which is the more specific one.
    const err = e as { message?: string };
    return { nativeError: String(err?.message ?? 'native location failed') };
  }
}

// Resolves with the live position or the specific reason it failed. Never
// falls back to a stored or default location.
export async function getLiveFix(): Promise<LocationResult> {
  if (typeof window === 'undefined') return { failure: { reason: 'unsupported' } };
  const native = await getNativePosition();
  if (native && ('coords' in native || 'failure' in native)) return native;
  const web = await getBrowserPosition();
  if ('coords' in web) return web;
  if (native && 'nativeError' in native) {
    const reason = classify(undefined, native.nativeError);
    if (reason !== 'unknown') return { failure: { reason, detail: native.nativeError } };
    return { failure: { reason: web.failure.reason, detail: `${web.failure.detail ?? ''} / app: ${native.nativeError}`.trim() } };
  }
  return web;
}

export async function getLivePosition(): Promise<Coords | null> {
  const r = await getLiveFix();
  return 'coords' in r ? r.coords : null;
}

// Same live-only behaviour; kept as aliases so existing screens keep working.
export const requestLiveLocation = getLivePosition;
export const getCurrentPositionFresh = getLivePosition;
