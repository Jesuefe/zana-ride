'use client';

import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';

type LatLng = { lat: number; lng: number };
type NearbyDriver = { lat: number; lng: number; id: string };

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
  nearbyDrivers?: NearbyDriver[];
  vehicleType?: string;
  draggablePickup?: boolean;
  onPickupChange?: (coords: LatLng) => void;
  onRouteInfo?: (info: { distanceText: string; durationText: string } | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const initDone = useRef(false);

  const makeMarker = (G: any, map: any, pos: LatLng, color: string) => {
    const div = document.createElement('div');
    div.innerHTML = `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`;
    try {
      return new G.marker.AdvancedMarkerElement({ position: pos, map, content: div });
    } catch {
      return new G.Marker({ position: pos, map });
    }
  };

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!containerRef.current || initDone.current) return;
      initDone.current = true;
      const G = (window as any).google.maps;

      const center = origin ?? driverPosition ?? { lat: -1.9536, lng: 30.0605 };
      mapRef.current = new G.Map(containerRef.current, {
        center,
        zoom: 14,
        mapId: 'zana_customer_map',
        disableDefaultUI: true,
        gestureHandling: 'none',
      });

      if (origin) originMarkerRef.current = makeMarker(G, mapRef.current, origin, '#00A082');
      if (destination) destMarkerRef.current = makeMarker(G, mapRef.current, destination, '#E6A82E');

      if (driverPosition) {
        const div = document.createElement('div');
        div.id = 'driver-dot';
        div.innerHTML = `<div style="position:relative;width:20px;height:20px">
          <div style="position:absolute;inset:0;border-radius:50%;background:#00A082;opacity:0.25;animation:zpulse 2s infinite"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;background:#00A082;border:2px solid white"></div>
        </div>`;
        try {
          driverMarkerRef.current = new G.marker.AdvancedMarkerElement({ position: driverPosition, map: mapRef.current, content: div });
        } catch {
          driverMarkerRef.current = new G.Marker({ position: driverPosition, map: mapRef.current });
        }
      }

      // Draw route using DirectionsService (already enabled on the key)
      if (origin && destination) {
        const svc = new G.DirectionsService();
        const renderer = new G.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#00A082', strokeWeight: 4, strokeOpacity: 0.9 },
        });
        renderer.setMap(mapRef.current);
        svc.route({
          origin: new G.LatLng(origin.lat, origin.lng),
          destination: new G.LatLng(destination.lat, destination.lng),
          travelMode: G.TravelMode.DRIVING,
        }, (result: any, status: any) => {
          if (status === 'OK') {
            renderer.setDirections(result);
            polylineRef.current = renderer;
            const leg = result.routes[0]?.legs[0];
            if (leg && onRouteInfo) {
              onRouteInfo({ distanceText: leg.distance.text, durationText: leg.duration.text });
            }
          } else {
            // Fallback straight line
            polylineRef.current = new G.Polyline({
              path: [origin, destination],
              strokeColor: '#00A082',
              strokeOpacity: 0.5,
              strokeWeight: 3,
              map: mapRef.current,
            });
          }
          // Fit bounds
          const bounds = new G.LatLngBounds();
          bounds.extend(origin);
          bounds.extend(destination);
          if (driverPosition) bounds.extend(driverPosition);
          mapRef.current.fitBounds(bounds, 48);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update driver position
  useEffect(() => {
    if (!driverMarkerRef.current || !driverPosition) return;
    try { driverMarkerRef.current.position = driverPosition; }
    catch { driverMarkerRef.current.setPosition(driverPosition); }
  }, [driverPosition?.lat, driverPosition?.lng]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <style>{`@keyframes zpulse{0%,100%{transform:scale(1);opacity:0.25}50%{transform:scale(2);opacity:0}}`}</style>
    </div>
  );
}
