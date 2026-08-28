'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';
import { ZANA_MAP_STYLE } from '../lib/mapStyle';

type LatLng = { lat: number; lng: number };

export type NearbyMarker = { id: string; lat: number; lng: number };

// How long a marker takes to glide to its new position. Real driver location
// updates arrive every few seconds; without this the marker teleports, which
// looks broken. Interpolating between fixes makes movement feel continuous.
const MARKER_ANIMATION_MS = 1200;

function animateMarker(marker: google.maps.Marker, to: LatLng, durationMs = MARKER_ANIMATION_MS) {
  const from = marker.getPosition();
  if (!from) {
    marker.setPosition(to);
    return;
  }
  const startLat = from.lat();
  const startLng = from.lng();
  const start = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    // Ease-out so the marker settles rather than stopping abruptly.
    const eased = 1 - Math.pow(1 - t, 3);
    marker.setPosition({
      lat: startLat + (to.lat - startLat) * eased,
      lng: startLng + (to.lng - startLng) * eased,
    });
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export default function BrandedMap({
  origin,
  destination,
  nearbyDrivers,
  vehicleType = 'BIKE',
  driverPosition,
  draggablePickup = false,
  onPickupChange,
  onRouteInfo,
  height = 220,
}: {
  origin: LatLng;
  destination?: LatLng;
  nearbyDrivers?: NearbyMarker[];
  vehicleType?: 'BIKE' | 'ECONOMY';
  driverPosition?: LatLng | null;
  draggablePickup?: boolean;
  onPickupChange?: (coords: LatLng) => void;
  onRouteInfo?: (info: { distanceText: string; durationText: string }) => void;
  height?: number | string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const originMarker = useRef<google.maps.Marker | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const nearbyMarkers = useRef<Map<string, google.maps.Marker>>(new Map());
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: origin,
        zoom: 14,
        styles: ZANA_MAP_STYLE,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
      directionsRenderer.current = new google.maps.DirectionsRenderer({
        map: mapInstance.current,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#00A082', strokeWeight: 4 },
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pickup marker — draggable during booking so the passenger can correct
  // an inaccurate GPS fix (common in dense areas or indoors).
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;

    if (!originMarker.current) {
      originMarker.current = new google.maps.Marker({
        position: origin,
        map,
        draggable: draggablePickup,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#00A082',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });
      if (draggablePickup && onPickupChange) {
        originMarker.current.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) onPickupChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      }
    } else {
      originMarker.current.setPosition(origin);
      originMarker.current.setDraggable(draggablePickup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, origin.lat, origin.lng, draggablePickup]);

  // Route + destination marker, with live distance/duration reported back
  // so the caller can show "3.2 km · 9 min remaining".
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;

    if (!destination) {
      destMarker.current?.setMap(null);
      destMarker.current = null;
      directionsRenderer.current?.set('directions', null);
      return;
    }

    if (!destMarker.current) {
      destMarker.current = new google.maps.Marker({
        position: destination,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#E6A82E',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });
    } else {
      destMarker.current.setPosition(destination);
    }

    // Route from the driver's live position when there is one (so the line
    // shrinks as they approach), otherwise from the pickup point.
    const routeStart = driverPosition ?? origin;
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      { origin: routeStart, destination, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === 'OK' && result && directionsRenderer.current) {
          directionsRenderer.current.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (leg && onRouteInfo) {
            onRouteInfo({
              distanceText: leg.distance?.text ?? '',
              durationText: leg.duration?.text ?? '',
            });
          }
        }
      },
    );

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(routeStart);
    bounds.extend(destination);
    map.fitBounds(bounds, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, destination?.lat, destination?.lng, driverPosition?.lat, driverPosition?.lng]);

  // The assigned driver's live position, glided smoothly between updates.
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;

    if (!driverPosition) {
      driverMarker.current?.setMap(null);
      driverMarker.current = null;
      return;
    }

    const iconUrl = vehicleType === 'BIKE' ? '/icons/marker-moto.png' : '/icons/marker-car.png';
    if (!driverMarker.current) {
      driverMarker.current = new google.maps.Marker({
        position: driverPosition,
        map,
        zIndex: 999,
        icon: { url: iconUrl, scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) },
      });
    } else {
      animateMarker(driverMarker.current, driverPosition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, driverPosition?.lat, driverPosition?.lng, vehicleType]);

  // Nearby available drivers — real records from the backend. Markers are
  // reused by driver id so each one glides to its new position rather than
  // being destroyed and recreated (which is what made them "jump").
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;
    const iconUrl = vehicleType === 'BIKE' ? '/icons/marker-moto.png' : '/icons/marker-car.png';
    const incoming = nearbyDrivers ?? [];
    const seen = new Set(incoming.map((d) => d.id));

    for (const [id, marker] of nearbyMarkers.current.entries()) {
      if (!seen.has(id)) {
        marker.setMap(null);
        nearbyMarkers.current.delete(id);
      }
    }

    for (const d of incoming) {
      const existing = nearbyMarkers.current.get(d.id);
      if (existing) {
        animateMarker(existing, { lat: d.lat, lng: d.lng });
      } else {
        nearbyMarkers.current.set(
          d.id,
          new google.maps.Marker({
            position: { lat: d.lat, lng: d.lng },
            map,
            icon: { url: iconUrl, scaledSize: new google.maps.Size(30, 30), anchor: new google.maps.Point(15, 15) },
          }),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, nearbyDrivers, vehicleType]);

  return <div ref={mapRef} style={{ width: '100%', height }} />;
}
