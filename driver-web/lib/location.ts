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
//
// On-device this uses @capacitor-community/background-geolocation instead
// of the plain browser API — the browser's navigator.geolocation.watchPosition
// is aggressively throttled or stopped outright by Android the moment the
// screen locks or the app is backgrounded, which defeats the entire point
// of tracking a driver who isn't staring at their phone the whole trip.
// The plugin has no web implementation at all, so a browser tab falls
// straight through to the original behaviour below, unchanged.
export function watchPosition(onUpdate: (coords: Coords) => void): () => void {
  if (typeof window === 'undefined' || !navigator.geolocation) return () => {};

  let nativeWatcherId: string | null = null;
  let usingNative = false;
  let browserWatchId: number | null = null;

  (async () => {
    try {
      const { Capacitor, registerPlugin } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;

      const BackgroundGeolocation = registerPlugin<{
        addWatcher(
          options: {
            backgroundMessage: string;
            backgroundTitle: string;
            requestPermissions: boolean;
            distanceFilter: number;
          },
          callback: (location: { latitude: number; longitude: number } | null, error?: any) => void,
        ): Promise<string>;
        removeWatcher(options: { id: string }): Promise<void>;
      }>('BackgroundGeolocation');

      usingNative = true;
      nativeWatcherId = await BackgroundGeolocation.addWatcher(
        {
          // Required for background updates to actually be delivered at
          // all — without a backgroundMessage, the plugin only reports
          // location while the app is in the foreground, silently
          // dropping the exact capability this exists for.
          backgroundMessage: 'Zana is sharing your location for an active trip.',
          backgroundTitle: 'Zana — location active',
          requestPermissions: true,
          distanceFilter: 15,
        },
        (location) => {
          if (location) onUpdate({ lat: location.latitude, lng: location.longitude });
        },
      );
    } catch {
      // Plugin not available for some reason — fall back below.
      usingNative = false;
    }

    // Only start the plain browser watch if the native path didn't take
    // over, so the two don't both fire and double-report position.
    if (!usingNative) {
      browserWatchId = navigator.geolocation.watchPosition(
        (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true },
      );
    }
  })();

  return () => {
    if (nativeWatcherId) {
      import('@capacitor/core').then(({ registerPlugin }) => {
        registerPlugin<{ removeWatcher(options: { id: string }): Promise<void> }>(
          'BackgroundGeolocation',
        ).removeWatcher({ id: nativeWatcherId! });
      });
    }
    if (browserWatchId !== null) {
      navigator.geolocation.clearWatch(browserWatchId);
    }
  };
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
