'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';

type LatLng = { lat: number; lng: number };

type DriverPosition = {
  lat: number;
  lng: number;
  heading: number;
};

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

function calcBearing(a: LatLng, b: LatLng): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((b.lat * Math.PI) / 180);
  const x = Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) -
    Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Previously this rendered a full in-app turn-by-turn navigation system —
// Directions API calls on a 20s timer plus on every meaningful position
// change, voice synthesis, step-by-step instruction tracking, tilt/heading
// 3D camera control. All of that is genuinely redundant now that Google's
// own Navigation app handles real turn-by-turn via the external "Get
// Directions" button, and was very likely the actual cause of the slow
// load — this now does exactly what the customer app's own map does:
// one route fetch, a simple marker, and an ETA pill.
export default function DriverMap({
  position,
  target,
  navigationMode = false,
  height = 200,
  lang = 'en',
}: {
  position: LatLng | null;
  target?: LatLng;
  navigationMode?: boolean;
  height?: number | string;
  lang?: 'en' | 'fr' | 'rw';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const targetMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const latestPosRef = useRef<DriverPosition | null>(null);
  const fetchedRef = useRef(false);
  const prevPosRef = useRef<LatLng | null>(null);
  const headingRef = useRef(0);
  const followingRef = useRef(true);
  const boundsFittedRef = useRef(false);

  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [following, setFollowing] = useState(true);
  const [mapsReady, setMapsReady] = useState(false);

  const updateCamera = useCallback((dPos: DriverPosition) => {
    const map = mapRef.current;
    if (!map || !followingRef.current) return;
    map.panTo({ lat: dPos.lat, lng: dPos.lng });
  }, []);

  const updateMarker = useCallback((dPos: DriverPosition) => {
    const map = mapRef.current;
    const G = (window as any).google?.maps;
    if (!map || !G) return;

    const pos = { lat: dPos.lat, lng: dPos.lng };
    const icon = {
      path: 'M 0,-12 L 8,10 L 0,5 L -8,10 Z',
      fillColor: '#00A082',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
      scale: 1.6,
      rotation: dPos.heading,
      anchor: new G.Point(0, 0),
    };

    if (!markerRef.current) {
      markerRef.current = new G.Marker({ position: pos, map, icon, zIndex: 1000, optimized: false });
    } else {
      markerRef.current.setPosition(pos);
      markerRef.current.setIcon(icon);
    }
  }, []);

  const onGpsUpdate = useCallback((dPos: DriverPosition) => {
    latestPosRef.current = dPos;
    updateMarker(dPos);
    updateCamera(dPos);
  }, [updateMarker, updateCamera]);

  // Fetches once per target, not on a repeated timer or every GPS tick —
  // this line is only ever a rough visual reference now, real turn-by-turn
  // guidance is Google's own Navigation app via "Get Directions".
  const fetchRoute = useCallback((from: LatLng, to: LatLng) => {
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    if (!G || !map) return;
    fetchedRef.current = true;

    const svc = new G.DirectionsService();
    svc.route(
      { origin: new G.LatLng(from.lat, from.lng), destination: new G.LatLng(to.lat, to.lng), travelMode: G.TravelMode.DRIVING },
      (result: any, status: any) => {
        if (status !== 'OK') return;
        const leg = result.routes[0]?.legs[0];
        if (!leg) return;

        setEta({ duration: leg.duration.text, distance: leg.distance.text });

        const path: { lat: number; lng: number }[] = [];
        leg.steps.forEach((s: any) => {
          (s.path ?? []).forEach((ll: any) => path.push({ lat: ll.lat(), lng: ll.lng() }));
        });

        if (polylineRef.current) polylineRef.current.setMap(null);
        polylineRef.current = new G.Polyline({
          path, strokeColor: '#00A082', strokeWeight: 6, strokeOpacity: 0.95, geodesic: true, map,
        });

        if (!targetMarkerRef.current) {
          targetMarkerRef.current = new G.Marker({
            position: to, map,
            icon: { path: G.SymbolPath.CIRCLE, scale: 8, fillColor: '#E6A82E', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 },
          });
        }

        if (!boundsFittedRef.current) {
          boundsFittedRef.current = true;
          const bounds = new G.LatLngBounds();
          path.forEach(p => bounds.extend(p));
          map.fitBounds(bounds, { top: 60, bottom: 80, left: 30, right: 30 });
        }
      }
    );
  }, []);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!containerRef.current || mapRef.current) return;
      const G = (window as any).google.maps;

      const initPos = latestPosRef.current ?? (position ? { ...position, heading: 0 } : { lat: -1.9536, lng: 30.0605, heading: 0 });

      const map = new G.Map(containerRef.current, {
        center: { lat: initPos.lat, lng: initPos.lng },
        zoom: 14,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });

      map.addListener('dragstart', () => {
        followingRef.current = false;
        setFollowing(false);
      });

      mapRef.current = map;

      if (latestPosRef.current) {
        updateMarker(latestPosRef.current);
        updateCamera(latestPosRef.current);
      }

      setMapsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!position) return;

    if (prevPosRef.current) {
      const dist = haversineM(prevPosRef.current, position);
      if (dist > 2) headingRef.current = calcBearing(prevPosRef.current, position);
    }
    prevPosRef.current = position;

    onGpsUpdate({ lat: position.lat, lng: position.lng, heading: headingRef.current });
  }, [position?.lat, position?.lng, onGpsUpdate]);

  useEffect(() => {
    if (!mapsReady || !target || !position || fetchedRef.current) return;
    fetchRoute(position, target);
  }, [mapsReady, target?.lat, target?.lng, position, fetchRoute]);

  const recenter = () => {
    followingRef.current = true;
    setFollowing(true);
    if (latestPosRef.current) updateCamera(latestPosRef.current);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {!following && (
        <button onClick={recenter} style={{
          position: 'absolute', bottom: 12, right: 12, zIndex: 10,
          background: 'white', border: 'none', borderRadius: 12,
          padding: '8px 14px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: 13, fontWeight: 700, color: '#00A082',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          📍 Recenter
        </button>
      )}

      {eta && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 10,
          background: 'white', borderRadius: 12, padding: '6px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', gap: 8, alignItems: 'center', fontSize: 12,
        }}>
          <span style={{ fontWeight: 800, color: '#00A082' }}>{eta.duration}</span>
          <span style={{ color: '#9CA3AF' }}>·</span>
          <span style={{ color: '#6B7280' }}>{eta.distance}</span>
        </div>
      )}
    </div>
  );
}
