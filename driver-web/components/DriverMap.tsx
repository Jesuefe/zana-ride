'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Locate } from 'lucide-react';
import { loadGoogleMaps } from '../lib/mapsLoader';
import { ZANA_MAP_STYLE } from '../lib/mapStyle';

type LatLng = { lat: number; lng: number };

type Step = {
  instruction: string; // plain text, HTML stripped
  distanceText: string;
  maneuver: string; // e.g. "turn-right", "" for straight
};

// Strips Google's HTML-formatted instructions ("Turn <b>right</b> onto...")
// down to plain text for display.
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function bearingBetween(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

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
  const lastPosition = useRef<LatLng | null>(null);
  const followEnabled = useRef(true);
  const [ready, setReady] = useState(false);
  const [heading, setHeading] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [showRecenter, setShowRecenter] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: position ?? { lat: -1.9536, lng: 30.0605 },
        zoom: navigationMode ? 18 : 15,
        tilt: navigationMode ? 45 : 0,
        styles: ZANA_MAP_STYLE,
        disableDefaultUI: true,
        zoomControl: !navigationMode,
        clickableIcons: false,
        gestureHandling: 'greedy',
      });
      directionsRenderer.current = new google.maps.DirectionsRenderer({
        map: mapInstance.current,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#00A082', strokeWeight: 6 },
      });

      // Any manual drag pauses auto-follow until the driver taps re-centre —
      // same behaviour as real nav apps.
      if (navigationMode) {
        mapInstance.current.addListener('dragstart', () => {
          followEnabled.current = false;
          setShowRecenter(true);
        });
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update the driver's marker, compute a travel bearing from consecutive
  // GPS fixes, and — in navigation mode — keep the camera locked to a
  // rotated "chase cam" view following that bearing.
  useEffect(() => {
    if (!ready || !mapInstance.current || !position) return;
    const map = mapInstance.current;

    let currentHeading = heading;
    if (lastPosition.current) {
      const dist = Math.hypot(position.lat - lastPosition.current.lat, position.lng - lastPosition.current.lng);
      if (dist > 0.00003) {
        currentHeading = bearingBetween(lastPosition.current, position);
        setHeading(currentHeading);
      }
    }
    lastPosition.current = position;

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
          rotation: currentHeading,
        },
      });
    } else {
      positionMarker.current.setPosition(position);
      const icon = positionMarker.current.getIcon() as google.maps.Symbol;
      positionMarker.current.setIcon({ ...icon, rotation: currentHeading });
    }

    if (navigationMode && followEnabled.current) {
      map.moveCamera({ center: position, heading: currentHeading, tilt: 45, zoom: 18 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, position?.lat, position?.lng, navigationMode]);

  // Draw the route to the current target and pull real turn-by-turn steps
  // out of Google's own routing result for the instruction banner.
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;

    if (targetMarker.current) {
      targetMarker.current.setMap(null);
      targetMarker.current = null;
    }

    if (!target) {
      directionsRenderer.current?.set('directions', null);
      setSteps([]);
      setEta(null);
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
            const leg = result.routes[0]?.legs[0];
            if (leg) {
              setEta({ duration: leg.duration?.text ?? '', distance: leg.distance?.text ?? '' });
              setSteps(
                leg.steps.map((s) => ({
                  instruction: stripHtml(s.instructions),
                  distanceText: s.distance?.text ?? '',
                  maneuver: (s as any).maneuver ?? '',
                })),
              );
            }
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

  const handleRecenter = () => {
    followEnabled.current = true;
    setShowRecenter(false);
    if (mapInstance.current && position) {
      mapInstance.current.moveCamera({ center: position, heading, tilt: 45, zoom: 18 });
    }
  };

  const currentStep = steps[0];
  const nextStep = steps[1];

  return (
    <div className="relative" style={{ height }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {navigationMode && currentStep && (
        <div className="absolute top-3 left-3 right-3">
          <div className="bg-zana-primary-dark text-white rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3">
            <ArrowUp size={22} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{currentStep.instruction}</p>
              <p className="text-xs text-white/70">{currentStep.distanceText}</p>
            </div>
          </div>
          {nextStep && (
            <div className="bg-white/95 rounded-xl px-3 py-1.5 mt-1.5 mx-3 shadow flex items-center gap-2">
              <span className="text-[11px] font-medium text-zana-muted">Then</span>
              <ArrowUp size={12} className="text-gray-700" />
              <span className="text-[11px] text-gray-700 truncate">{nextStep.instruction}</span>
            </div>
          )}
        </div>
      )}

      {navigationMode && showRecenter && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-3 right-3 bg-white rounded-full p-2.5 shadow-lg"
        >
          <Locate size={18} className="text-zana-primary" />
        </button>
      )}

      {navigationMode && eta && (
        <div className="absolute bottom-3 left-3 bg-white/95 rounded-xl px-3 py-1.5 shadow text-xs">
          <span className="font-bold text-zana-primary">{eta.duration}</span>
          <span className="text-zana-muted"> · {eta.distance}</span>
        </div>
      )}
    </div>
  );
}
