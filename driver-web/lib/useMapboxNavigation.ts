'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type TravelMode = 'DRIVING' | 'WALKING' | 'CYCLING' | 'TWO_WHEELER';

interface MapboxNavigationPlugin {
  initialize(): Promise<{ success: boolean }>;
  showNavigationView(options: { show: boolean }): Promise<{ success: boolean }>;
  startNavigation(options: {
    destinationLatitude: number;
    destinationLongitude: number;
    travelMode?: TravelMode;
  }): Promise<{ success: boolean }>;
  stopNavigation(): Promise<{ success: boolean }>;
  addListener(eventName: string, listener: (event: any) => void): Promise<{ remove: () => void }>;
}

/**
 * Talks to MapboxNavigationPlugin.kt — a small, hand-written native plugin
 * living directly in this project (native/driver/android), calling
 * Mapbox's real Navigation Core SDK and Maps SDK directly. Not a
 * third-party npm plugin — every viable one found for Mapbox on Capacitor
 * was years stale or missing Android support entirely, so this talks
 * straight to Mapbox's own SDK, the same way the earlier Google version
 * did before this project switched vendors.
 *
 * Android only, for now — there is no matching iOS implementation yet.
 * On iOS, and in a plain browser tab (someone visiting driver.zanaride.rw
 * directly rather than through the installed app), Capacitor simply has no
 * native handler registered under this name, so every call below resolves
 * `available: false` and the caller's existing DriverMap view is what
 * actually renders — nothing here ever throws for those callers.
 */
export function useMapboxNavigation() {
  const [available, setAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const listeners = useRef<any[]>([]);
  const pluginRef = useRef<MapboxNavigationPlugin | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { Capacitor, registerPlugin } = await import('@capacitor/core');

      // isPluginAvailable checks whether the NATIVE side actually
      // registered a handler under this name — true only inside the real
      // installed Android app, false on iOS and false in a browser tab,
      // without needing a platform-name check at all.
      if (!Capacitor.isPluginAvailable('MapboxNavigation')) return;

      const plugin = registerPlugin<MapboxNavigationPlugin>('MapboxNavigation');
      if (cancelled) return;
      pluginRef.current = plugin;
      setAvailable(true);

      const readyHandle = await plugin.addListener('onNavigationReady', () => setReady(true));
      const closedHandle = await plugin.addListener('onNavigationClosed', () => setActive(false));
      listeners.current = [readyHandle, closedHandle];

      try {
        // No key is passed from here — the native side reads it from
        // AndroidManifest.xml at startup, set at build time from the
        // GOOGLE_NAV_API_KEY secret (see build.gradle).
        await plugin.initialize();
      } catch {
        // Most likely the manifest key is missing/invalid, the Navigation
        // SDK product isn't enabled for it in Cloud Console yet, or the
        // driver declined Google's one-time navigation terms dialog on
        // this device. `available` stays true either way — start() below
        // retries initialize() once before actually navigating.
      }
    })();

    return () => {
      cancelled = true;
      listeners.current.forEach(h => h.remove?.());
    };
  }, []);

  const start = useCallback(async (lat: number, lng: number, travelMode: TravelMode = 'DRIVING') => {
    const nav = pluginRef.current;
    if (!nav) return false;
    try {
      if (!ready) await nav.initialize();
      await nav.showNavigationView({ show: true });
      await nav.startNavigation({ destinationLatitude: lat, destinationLongitude: lng, travelMode });
      setActive(true);
      return true;
    } catch {
      return false;
    }
  }, [ready]);

  const stop = useCallback(async () => {
    const nav = pluginRef.current;
    if (!nav) return;
    try {
      await nav.stopNavigation();
      await nav.showNavigationView({ show: false });
    } catch {
      // Already stopped/dismissed — nothing to clean up.
    } finally {
      setActive(false);
    }
  }, []);

  return { available, active, start, stop };
}
