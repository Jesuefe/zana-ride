'use client';

import { useEffect, useRef, useCallback } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';

type LatLng = { lat: number; lng: number };

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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const nearbyMarkersRef = useRef<any[]>([]);
  const initDone = useRef(false);
  const routeTimerRef = useRef<any>(null);

  // Keep live references so callbacks see current values
  const driverRef = useRef(driverPosition);
  const originRef = useRef(origin);
  const destRef = useRef(destination);
  driverRef.current = driverPosition;
  originRef.current = origin;
  destRef.current = destination;

  const makeMarker = (G: any, map: any, pos: LatLng, color: string, size = 14) => {
    const div = document.createElement('div');
    div.innerHTML = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`;
    try { return new G.marker.AdvancedMarkerElement({ position: pos, map, content: div }); }
    catch { return new G.Marker({ position: pos, map }); }
  };

  const fetchRoute = useCallback(() => {
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    const org = originRef.current;
    const dst = destRef.current;
    if (!G || !map || !org || !dst) return;

    const svc = new G.DirectionsService();
    svc.route({
      origin: new G.LatLng(org.lat, org.lng),
      destination: new G.LatLng(dst.lat, dst.lng),
      travelMode: G.TravelMode.DRIVING,
    }, (result: any, status: any) => {
      if (status === 'OK') {
        rendererRef.current?.setDirections(result);
        const leg = result.routes[0]?.legs[0];
        if (leg && onRouteInfo) {
          onRouteInfo({ distanceText: leg.distance.text, durationText: leg.duration.text });
        }
        // Fit all points in view
        const drv = driverRef.current;
        const bounds = new G.LatLngBounds();
        bounds.extend(new G.LatLng(org.lat, org.lng));
        bounds.extend(new G.LatLng(dst.lat, dst.lng));
        if (drv) bounds.extend(new G.LatLng(drv.lat, drv.lng));
        map.fitBounds(bounds, { top: 60, bottom: 60, left: 30, right: 30 });
      } else {
        // Fallback straight line
        new G.Polyline({
          path: [org, dst],
          strokeColor: '#00A082', strokeOpacity: 0.5, strokeWeight: 3, map,
        });
        if (onRouteInfo) onRouteInfo(null);
      }
    });
  }, [onRouteInfo]);

  // Init map once
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!containerRef.current || initDone.current) return;
      initDone.current = true;
      const G = (window as any).google.maps;

      const center = origin ?? driverPosition ?? { lat: -1.9536, lng: 30.0605 };
      mapRef.current = new G.Map(containerRef.current, {
        center, zoom: 14,
        mapId: 'zana_customer_map',
        disableDefaultUI: true,
        gestureHandling: draggablePickup ? 'greedy' : 'none',
      });

      // Route renderer
      rendererRef.current = new G.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#00A082', strokeWeight: 5, strokeOpacity: 0.9 },
      });
      rendererRef.current.setMap(mapRef.current);

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

      // Fetch initial route
      fetchRoute();
    });
  }, []);

  // Live driver marker update — smooth animation
  useEffect(() => {
    if (!driverPosition) return;
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    if (!G || !map) return;

    const pos = { lat: driverPosition.lat, lng: driverPosition.lng };

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
  }, [driverPosition?.lat, driverPosition?.lng]);

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

  // Re-fetch route when origin/destination change
  useEffect(() => {
    if (!initDone.current) return;
    clearTimeout(routeTimerRef.current);
    routeTimerRef.current = setTimeout(fetchRoute, 300);
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, fetchRoute]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <style>{`@keyframes zpulse{0%,100%{transform:scale(1);opacity:0.3}50%{transform:scale(2.5);opacity:0}}`}</style>
    </div>
  );
}
