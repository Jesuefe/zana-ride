'use client';

import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';

type LatLng = { lat: number; lng: number };

const MAPS_KEY = 'AIzaSyD4o-fXIpmGozrClaP1niC407cgRCrzSTI';

async function fetchRoutePolyline(origin: LatLng, destination: LatLng): Promise<any[]> {
  try {
    const res = await fetch(
      `https://routes.googleapis.com/directions/v2:computeRoutes?key=${MAPS_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-FieldMask': 'routes.polyline,routes.duration,routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
          travelMode: 'TWO_WHEELER',
          routingPreference: 'TRAFFIC_AWARE',
          regionCode: 'RW',
        }),
      }
    );
    const data = await res.json();
    const encoded = data.routes?.[0]?.polyline?.encodedPolyline;
    if (!encoded) return [];
    const G = (window as any).google.maps;
    return G.geometry?.encoding?.decodePath(encoded) ?? [];
  } catch {
    return [];
  }
}

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

  useEffect(() => {
    loadGoogleMaps().then(async () => {
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
        // No tilt or heading — not supported on raster maps
      });

      // Draw route polyline if we have both points
      if (origin && destination) {
        const path = await fetchRoutePolyline(origin, destination);
        if (path.length > 0) {
          polylineRef.current = new G.Polyline({
            path,
            strokeColor: '#00A082',
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map: mapRef.current,
          });
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
      }

      // Origin marker (green dot)
      if (origin) {
        const div = document.createElement('div');
        div.innerHTML = '<div style="width:14px;height:14px;border-radius:50%;background:#00A082;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>';
        try {
          originMarkerRef.current = new G.marker.AdvancedMarkerElement({
            position: origin, map: mapRef.current, content: div,
          });
        } catch {
          originMarkerRef.current = new G.Marker({ position: origin, map: mapRef.current });
        }
      }

      // Destination marker (amber dot)
      if (destination) {
        const div = document.createElement('div');
        div.innerHTML = '<div style="width:14px;height:14px;border-radius:50%;background:#E6A82E;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>';
        try {
          destMarkerRef.current = new G.marker.AdvancedMarkerElement({
            position: destination, map: mapRef.current, content: div,
          });
        } catch {
          destMarkerRef.current = new G.Marker({ position: destination, map: mapRef.current });
        }
      }

      // Driver marker (pulsing green circle)
      if (driverPosition) {
        const div = document.createElement('div');
        div.id = 'driver-dot';
        div.innerHTML = `<div style="position:relative;width:20px;height:20px">
          <div style="position:absolute;inset:0;border-radius:50%;background:#00A082;opacity:0.3;animation:pulse 2s infinite"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;background:#00A082;border:2px solid white"></div>
        </div>`;
        try {
          driverMarkerRef.current = new G.marker.AdvancedMarkerElement({
            position: driverPosition, map: mapRef.current, content: div,
          });
        } catch {
          driverMarkerRef.current = new G.Marker({ position: driverPosition, map: mapRef.current });
        }
      }
    });
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
      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:0.3}50%{transform:scale(1.8);opacity:0}}`}</style>
    </div>
  );
}
