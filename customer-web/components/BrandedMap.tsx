'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';

type LatLng = { lat: number; lng: number };

function distanceToRouteMeters(point: LatLng, path: any[]) {
  if (path.length < 2) return null;
  const latScale = 111320;
  const lngScale = Math.cos((point.lat * Math.PI) / 180) * 111320;
  const px = point.lng * lngScale, py = point.lat * latScale;
  let minDistance = Number.POSITIVE_INFINITY;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const ax = a.lng() * lngScale, ay = a.lat() * latScale;
    const bx = b.lng() * lngScale, by = b.lat() * latScale;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const cx = ax + t * dx, cy = ay + t * dy;
    minDistance = Math.min(minDistance, Math.hypot(px - cx, py - cy));
  }
  return Math.round(minDistance);
}

export default function BrandedMap({
  origin,
  destination,
  driverPosition,
  height = 200,
  nearbyDrivers,
  vehicleType,
  draggablePickup,
  onPickupChange,
  onRouteInfo,
  navigationStart,
  navigationDestination,
  onRouteDeviation,
  onMapClick,
}: {
  origin?: LatLng;
  destination?: LatLng;
  driverPosition?: LatLng | null;
  height?: number | string;
  nearbyDrivers?: { lat: number; lng: number; id: string }[];
  vehicleType?: string;
  draggablePickup?: boolean;
  onPickupChange?: (coords: LatLng) => void;
  onRouteInfo?: (info: { distanceText: string; durationText: string } | null) => void;
  navigationStart?: LatLng | null;
  navigationDestination?: LatLng | null;
  onRouteDeviation?: (info: { offRoute: boolean; distanceMeters: number } | null) => void;
  onMapClick?: (coords: LatLng) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const nearbyMarkersRef = useRef<any[]>([]);
  const initDone = useRef(false);
  const routeTimerRef = useRef<any>(null);
  const routePathRef = useRef<any[]>([]);
  const routePolylinesRef = useRef<any[]>([]);
  const offRouteCountRef = useRef(0);
  const mapClickRef = useRef(onMapClick);
  mapClickRef.current = onMapClick;

  // Keep live references so callbacks see current values
  const driverRef = useRef(driverPosition);
  const originRef = useRef(origin);
  const destRef = useRef(destination);
  const navigationStartRef = useRef(navigationStart);
  const navigationDestinationRef = useRef(navigationDestination);
  driverRef.current = driverPosition;
  originRef.current = origin;
  destRef.current = destination;
  navigationStartRef.current = navigationStart;
  navigationDestinationRef.current = navigationDestination;

  const makeMarker = (G: any, map: any, pos: LatLng, color: string, size = 14) => {
    const div = document.createElement('div');
    div.innerHTML = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`;
    try { return new G.marker.AdvancedMarkerElement({ position: pos, map, content: div }); }
    catch { return new G.Marker({ position: pos, map }); }
  };

  const fetchRoute = useCallback(async () => {
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    const org = originRef.current;
    const dst = destRef.current;
    const navStart = navigationStartRef.current;
    const navDst = navigationDestinationRef.current;
    const routeOrigin = navStart ?? org;
    const routeDestination = navDst ?? dst;
    if (!G || !map || !routeOrigin || !routeDestination) return;

    try {
      // Use the modern Routes library so motorcycle trips use Google's
      // motorized TWO_WHEELER routing rather than ordinary car directions.
      const { Route } = await G.importLibrary('routes');
      const travelMode = vehicleType?.toUpperCase() === 'BIKE' ? 'TWO_WHEELER' : 'DRIVE';
      const result = await Route.computeRoutes({
        origin: { lat: routeOrigin.lat, lng: routeOrigin.lng },
        destination: { lat: routeDestination.lat, lng: routeDestination.lng },
        travelMode,
        routingPreference: 'TRAFFIC_AWARE',
        fields: ['path', 'distanceMeters', 'durationMillis', 'staticDurationMillis', 'viewport', 'warnings'],
      });
      const route = result?.routes?.[0];
      if (!route?.path?.length) throw new Error('Google returned no road route');

      routePolylinesRef.current.forEach(line => line.setMap(null));
      routePolylinesRef.current = route.createPolylines({
        polylineOptions: { strokeColor: '#00A082', strokeWeight: 5, strokeOpacity: 0.92 },
      });
      routePolylinesRef.current.forEach(line => line.setMap(map));

      // Store Google Maps LatLng objects because route-deviation checks use
      // lat()/lng() accessors.
      routePathRef.current = route.path.map((point: any) =>
        new G.LatLng(Number(point.lat), Number(point.lng)),
      );
      offRouteCountRef.current = 0;

      const distanceMeters = Number(route.distanceMeters ?? 0);
      const durationMillis = Number(route.durationMillis ?? 0);
      if (onRouteInfo && distanceMeters > 0 && durationMillis > 0) {
        onRouteInfo({
          distanceText: `${(distanceMeters / 1000).toFixed(1)} km`,
          durationText: `~${Math.max(1, Math.ceil(durationMillis / 60000))} min`,
        });
      }

      const bounds = new G.LatLngBounds();
      routePathRef.current.forEach((point: any) => bounds.extend(point));
      const drv = driverRef.current;
      if (drv) bounds.extend(new G.LatLng(drv.lat, drv.lng));
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 30, right: 30 });
    } catch (error) {
      routePolylinesRef.current.forEach(line => line.setMap(null));
      routePolylinesRef.current = [];
      routePathRef.current = [];
      offRouteCountRef.current = 0;
      onRouteDeviation?.(null);
      onRouteInfo?.(null);
      // Do not draw a straight line and present it as a road route.
      console.warn('[Zana map] Road route unavailable:', error instanceof Error ? error.message : 'Unknown routing error');
    }
  }, [onRouteInfo, onRouteDeviation, vehicleType]);

  // Init map once. Surface configuration/authentication failures instead
  // of leaving an unexplained blank map or an unhandled promise rejection.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !containerRef.current || initDone.current) return;
      initDone.current = true;
      const G = (window as any).google.maps;

      const center = origin ?? driverPosition ?? { lat: -1.9536, lng: 30.0605 };
      mapRef.current = new G.Map(containerRef.current, {
        center, zoom: 14,
        mapId: 'zana_customer_map',
        disableDefaultUI: true,
        gestureHandling: draggablePickup || onMapClick ? 'greedy' : 'none',
      });

      // Markers
      if (origin) originMarkerRef.current = makeMarker(G, mapRef.current, origin, '#00A082', 16);
      if (destination) destMarkerRef.current = makeMarker(G, mapRef.current, destination, '#E6A82E', 16);

      // Draggable pickup
      if (draggablePickup && origin && onPickupChange) {
        const pickupDiv = document.createElement('div');
        pickupDiv.innerHTML = `<div style="width:22px;height:22px;border-radius:50%;background:#00A082;border:3px solid white;box-shadow:0 2px 10px rgba(0,160,130,0.5);cursor:grab"></div>`;
        try {
          const m = new G.marker.AdvancedMarkerElement({
            position: origin, map: mapRef.current, content: pickupDiv, gmpDraggable: true,
          });
          m.addListener('dragend', (e: any) => {
            const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            onPickupChange(pos);
          });
          originMarkerRef.current = m;
        } catch {
          const m = new G.Marker({ position: origin, map: mapRef.current, draggable: true });
          m.addListener('dragend', () => {
            const pos = m.getPosition();
            if (pos) onPickupChange({ lat: pos.lat(), lng: pos.lng() });
          });
          originMarkerRef.current = m;
        }
      }

      // Driver marker with pulse
      if (driverPosition) {
        const div = document.createElement('div');
        div.id = 'cust-driver-dot';
        div.innerHTML = `<div style="position:relative;width:24px;height:24px">
          <div style="position:absolute;inset:0;border-radius:50%;background:#00A082;opacity:0.3;animation:zpulse 2s infinite"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;background:#00A082;border:2px solid white"></div>
        </div>`;
        try { driverMarkerRef.current = new G.marker.AdvancedMarkerElement({ position: driverPosition, map: mapRef.current, content: div }); }
        catch { driverMarkerRef.current = new G.Marker({ position: driverPosition, map: mapRef.current }); }
      }

      // Let destination search select a point on the existing map.
      if (mapClickRef.current) {
        mapRef.current.addListener('click', (event: any) => {
          const point = event?.latLng;
          if (point) {
            mapRef.current.panTo(point);
            mapClickRef.current?.({ lat: point.lat(), lng: point.lng() });
          }
        });
      }
      // Fetch initial route
      fetchRoute();
    }).catch((error) => {
      if (cancelled) return;
      console.error('[Zana map] Google Maps failed to initialize:', error);
      setMapError(
        'Map unavailable. Please check the Google Maps key and website restrictions.',
      );
    });

    return () => {
      cancelled = true;
      clearTimeout(routeTimerRef.current);
    };
  }, []);

  // Live driver marker update — smooth animation
  useEffect(() => {
    if (!driverPosition) return;
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    if (!G || !map) return;

    const pos = { lat: driverPosition.lat, lng: driverPosition.lng };

    if (onRouteDeviation && routePathRef.current.length > 1) {
      const distanceMeters = distanceToRouteMeters(pos, routePathRef.current);
      if (distanceMeters != null) {
        const isFar = distanceMeters > 150;
        offRouteCountRef.current = isFar ? offRouteCountRef.current + 1 : 0;
        onRouteDeviation({ offRoute: offRouteCountRef.current >= 2, distanceMeters });
      }
    }

    if (!driverMarkerRef.current) {
      const div = document.createElement('div');
      div.id = 'cust-driver-dot';
      div.innerHTML = `<div style="position:relative;width:24px;height:24px">
        <div style="position:absolute;inset:0;border-radius:50%;background:#00A082;opacity:0.3;animation:zpulse 2s infinite"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#00A082;border:2px solid white"></div>
      </div>`;
      try { driverMarkerRef.current = new G.marker.AdvancedMarkerElement({ position: pos, map, content: div }); }
      catch { driverMarkerRef.current = new G.Marker({ position: pos, map }); }
    } else {
      try { driverMarkerRef.current.position = pos; }
      catch { driverMarkerRef.current.setPosition(pos); }
    }
  }, [driverPosition?.lat, driverPosition?.lng, onRouteDeviation]);

  // Nearby driver markers (search screen)
  useEffect(() => {
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    if (!G || !map || !nearbyDrivers) return;
    nearbyMarkersRef.current.forEach(m => { try { m.map = null; } catch { m.setMap(null); } });
    nearbyMarkersRef.current = nearbyDrivers.map(d => {
      const div = document.createElement('div');
      div.innerHTML = `<div style="width:12px;height:12px;border-radius:50%;background:#00A082;border:2px solid white;opacity:0.8"></div>`;
      try { return new G.marker.AdvancedMarkerElement({ position: d, map, content: div }); }
      catch { return new G.Marker({ position: d, map }); }
    });
  }, [nearbyDrivers]);

  // Re-fetch the Google route whenever the trip endpoints or live navigation start changes.
  useEffect(() => {
    if (!initDone.current) return;
    clearTimeout(routeTimerRef.current);
    routeTimerRef.current = setTimeout(fetchRoute, 300);
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, navigationDestination?.lat, navigationDestination?.lng, fetchRoute]);

  // During an active trip, keep the customer's route aligned to the driver's latest
  // GPS position so the customer can compare the vehicle with Google's recommended route.
  useEffect(() => {
    if (!navigationStart || !navigationDestination || !initDone.current) return;
    const timer = setInterval(fetchRoute, 15000);
    return () => clearInterval(timer);
  }, [navigationStart?.lat, navigationStart?.lng, navigationDestination?.lat, navigationDestination?.lng, fetchRoute]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {mapError && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute', inset: 0, zIndex: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, textAlign: 'center',
            background: '#f3f6f5', color: '#52615a',
            fontSize: 13, lineHeight: 1.5,
          }}
        >
          {mapError}
        </div>
      )}
      {vehicleType?.toUpperCase() === 'BIKE' && destination && (
        <div
          role="note"
          style={{
            position: 'absolute', left: 10, bottom: 10, zIndex: 2,
            maxWidth: 'calc(100% - 20px)', padding: '6px 9px',
            borderRadius: 9, background: 'rgba(255,255,255,.94)',
            color: '#52615a', fontSize: 10, lineHeight: 1.35,
            boxShadow: '0 1px 5px rgba(0,0,0,.14)',
          }}
        >
          Motorcycle routes are in beta. Follow local road signs and restrictions.
        </div>
      )}
      <style>{`@keyframes zpulse{0%,100%{transform:scale(1);opacity:0.3}50%{transform:scale(2.5);opacity:0}}`}</style>
    </div>
  );
}
