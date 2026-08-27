'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';
import { ZANA_MAP_STYLE } from '../lib/mapStyle';

type LatLng = { lat: number; lng: number };

export default function DriverMap({
  position,
  target,
  navigationMode = false,
  height = 200,
}: {
  position: LatLng | null;
  target?: LatLng;
  navigationMode?: boolean;
  height?: number | string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const positionMarker = useRef<google.maps.Marker | null>(null);
  const targetMarker = useRef<google.maps.Marker | null>(null);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: position ?? { lat: -1.9536, lng: 30.0605 },
        zoom: navigationMode ? 17 : 15,
        styles: ZANA_MAP_STYLE,
        disableDefaultUI: true,
        zoomControl: !navigationMode,
        clickableIcons: false,
      });
      directionsRenderer.current = new google.maps.DirectionsRenderer({
        map: mapInstance.current,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#00A082', strokeWeight: 5 },
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the driver's own live marker up to date and, in navigation mode,
  // keep the camera following them (like turn-by-turn nav apps).
  useEffect(() => {
    if (!ready || !mapInstance.current || !position) return;
    const map = mapInstance.current;

    if (!positionMarker.current) {
      positionMarker.current = new google.maps.Marker({
        position,
        map,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#00A082',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });
    } else {
      positionMarker.current.setPosition(position);
    }

    if (navigationMode) {
      map.panTo(position);
    }
  }, [ready, position?.lat, position?.lng, navigationMode]);

  // Draw the route to the current target (pickup, then destination) and
  // keep a marker on it — recalculates whenever the target changes.
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;

    if (targetMarker.current) {
      targetMarker.current.setMap(null);
      targetMarker.current = null;
    }

    if (!target) {
      directionsRenderer.current?.set('directions', null);
      return;
    }

    targetMarker.current = new google.maps.Marker({
      position: target,
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

    if (position) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        { origin: position, destination: target, travelMode: google.maps.TravelMode.DRIVING },
        (result, status) => {
          if (status === 'OK' && result && directionsRenderer.current) {
            directionsRenderer.current.setDirections(result);
          }
        },
      );

      if (!navigationMode) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(position);
        bounds.extend(target);
        map.fitBounds(bounds, 60);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, target?.lat, target?.lng]);

  return <div ref={mapRef} style={{ width: '100%', height }} />;
}
