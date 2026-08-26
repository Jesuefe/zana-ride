'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';
import { ZANA_MAP_STYLE } from '../lib/mapStyle';

type LatLng = { lat: number; lng: number };

type NearbyCar = { id: string; position: LatLng; type: 'BIKE' | 'ECONOMY' };

// Scatters a few simulated nearby drivers around the pickup point, purely
// visual (matches the spirit of "cars nearby" seen on ride-hailing home
// screens). Real positions would come from the backend's driver-location
// feed once that's streamed over a websocket.
function generateNearbyCars(center: LatLng, count: number): NearbyCar[] {
  return Array.from({ length: count }).map((_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const distanceKm = 0.3 + Math.random() * 1.4;
    // Rough km-to-degree conversion, fine at city scale.
    const dLat = (distanceKm / 111) * Math.cos(angle);
    const dLng = (distanceKm / (111 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle);
    return {
      id: `car-${i}`,
      position: { lat: center.lat + dLat, lng: center.lng + dLng },
      type: Math.random() > 0.5 ? 'BIKE' : 'ECONOMY',
    };
  });
}

export default function BrandedMap({
  origin,
  destination,
  showNearbyCars = false,
  height = 220,
}: {
  origin: LatLng;
  destination?: LatLng;
  showNearbyCars?: boolean;
  height?: number;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const [ready, setReady] = useState(false);

  // Initialize the map once.
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

  // Update markers/route whenever origin/destination change.
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const originMarker = new google.maps.Marker({
      position: origin,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#00A082',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
      },
    });
    markersRef.current.push(originMarker);

    if (destination) {
      const destMarker = new google.maps.Marker({
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
      markersRef.current.push(destMarker);

      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
        (result, status) => {
          if (status === 'OK' && result && directionsRenderer.current) {
            directionsRenderer.current.setDirections(result);
          }
        },
      );

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destination);
      map.fitBounds(bounds, 60);
    } else {
      map.setCenter(origin);

      if (showNearbyCars) {
        const cars = generateNearbyCars(origin, 5);
        cars.forEach((car) => {
          const marker = new google.maps.Marker({
            position: car.position,
            map,
            icon: {
              url: car.type === 'BIKE' ? '/icons/motorbike.png' : '/icons/car.png',
              scaledSize: new google.maps.Size(34, 34),
              anchor: new google.maps.Point(17, 17),
            },
          });
          markersRef.current.push(marker);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, origin.lat, origin.lng, destination?.lat, destination?.lng, showNearbyCars]);

  return <div ref={mapRef} style={{ width: '100%', height }} />;
}
