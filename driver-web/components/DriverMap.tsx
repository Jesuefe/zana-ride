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

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function maneuverArrow(m: string) {
  if (m.includes('left')) return '↰';
  if (m.includes('right')) return '↱';
  if (m.includes('uturn')) return '↩';
  if (m.includes('roundabout')) return '↻';
  return '↑';
}

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
  // ── Refs — stable across renders ──────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const targetMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const latestPosRef = useRef<DriverPosition | null>(null);
  const lastFetchPosRef = useRef<LatLng | null>(null);
  const prevPosRef = useRef<LatLng | null>(null);
  const headingRef = useRef(0);
  const followingRef = useRef(true);
  const spokenRef = useRef('');
  const fetchTimerRef = useRef<any>(null);
  const boundsFittedRef = useRef(false);

  // ── State — only for UI ───────────────────────────────────────────────────
  const [steps, setSteps] = useState<{
    instruction: string; distanceText: string; maneuver: string; endLocation: LatLng;
  }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [following, setFollowing] = useState(true);
  const [mapsReady, setMapsReady] = useState(false);

  // ── updateCamera — called directly, not via useEffect ────────────────────
  const updateCamera = useCallback((dPos: DriverPosition) => {
    const map = mapRef.current;
    if (!map || !followingRef.current) return;

    if (navigationMode) {
      // Center on driver at street-level zoom
      map.setCenter({ lat: dPos.lat, lng: dPos.lng });
      if (map.getZoom() !== 18) map.setZoom(18);
      // Tilt and heading only work with a Cloud mapId — try, ignore if unsupported
      try { map.setTilt?.(45); } catch {}
      try { map.setHeading?.(dPos.heading); } catch {}
    } else {
      map.panTo({ lat: dPos.lat, lng: dPos.lng });
    }
  }, [navigationMode]);

  // ── updateMarker — called directly ───────────────────────────────────────
  const updateMarker = useCallback((dPos: DriverPosition) => {
    const map = mapRef.current;
    const G = (window as any).google?.maps;
    if (!map || !G) return;

    const pos = { lat: dPos.lat, lng: dPos.lng };

    // Classic Marker with rotating arrow symbol — works without mapId
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
      markerRef.current = new G.Marker({
        position: pos,
        map,
        icon,
        zIndex: 1000,
        optimized: false,
      });
    } else {
      markerRef.current.setPosition(pos);
      markerRef.current.setIcon(icon);
    }
  }, []);

  // ── GPS update handler — single source of truth ───────────────────────────
  const onGpsUpdate = useCallback((dPos: DriverPosition) => {
    latestPosRef.current = dPos;
    updateMarker(dPos);
    updateCamera(dPos);

    // Advance nav step
    setCurrentStep(prev => {
      if (!steps.length || prev >= steps.length - 1) return prev;
      return haversineM(dPos, steps[prev].endLocation) < 30 ? prev + 1 : prev;
    });
  }, [updateMarker, updateCamera, steps]);

  // ── fetchRoute — only calculates, never touches camera ───────────────────
  const fetchRoute = useCallback((from: LatLng, to: LatLng) => {
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    if (!G || !map) return;

    lastFetchPosRef.current = from;

    const svc = new G.DirectionsService();
    svc.route(
      {
        origin: new G.LatLng(from.lat, from.lng),
        destination: new G.LatLng(to.lat, to.lng),
        travelMode: G.TravelMode.DRIVING,
      },
      (result: any, status: any) => {
        if (status !== 'OK') return;

        const leg = result.routes[0]?.legs[0];
        if (!leg) return;

        setEta({ duration: leg.duration.text, distance: leg.distance.text });

        // Extract path for Polyline
        const path: { lat: number; lng: number }[] = [];
        const newSteps: typeof steps = [];

        leg.steps.forEach((s: any) => {
          s.lat_lngs.forEach((ll: any) => path.push({ lat: ll.lat(), lng: ll.lng() }));
          newSteps.push({
            instruction: stripHtml(s.instructions),
            distanceText: s.distance.text,
            maneuver: s.maneuver ?? '',
            endLocation: { lat: s.end_location.lat(), lng: s.end_location.lng() },
          });
        });

        setSteps(newSteps);
        setCurrentStep(0);

        // Draw raw Polyline — never touches camera
        if (polylineRef.current) polylineRef.current.setMap(null);
        polylineRef.current = new G.Polyline({
          path,
          strokeColor: '#00A082',
          strokeWeight: 6,
          strokeOpacity: 0.95,
          geodesic: true,
          map,
        });

        // Destination marker
        if (!targetMarkerRef.current) {
          targetMarkerRef.current = new G.Marker({
            position: to,
            map,
            icon: {
              path: G.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#E6A82E',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 3,
            },
          });
        }

        // Non-nav: fit bounds ONCE only, never again
        if (!navigationMode && !boundsFittedRef.current) {
          boundsFittedRef.current = true;
          const bounds = new G.LatLngBounds();
          path.forEach(p => bounds.extend(p));
          map.fitBounds(bounds, { top: 60, bottom: 80, left: 30, right: 30 });
        }
      }
    );
  }, [navigationMode]);

  // ── Init map once ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!containerRef.current || mapRef.current) return;
      const G = (window as any).google.maps;

      const initPos = latestPosRef.current ?? (position ? { ...position, heading: 0 } : { lat: -1.9536, lng: 30.0605, heading: 0 });

      const map = new G.Map(containerRef.current, {
        center: { lat: initPos.lat, lng: initPos.lng },
        zoom: navigationMode ? 18 : 14,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });

      // Detect manual drag → stop following
      map.addListener('dragstart', () => {
        followingRef.current = false;
        setFollowing(false);
      });

      mapRef.current = map;

      // Apply latest GPS immediately if already available
      if (latestPosRef.current) {
        updateMarker(latestPosRef.current);
        updateCamera(latestPosRef.current);
      }

      setMapsReady(true);
    });

    return () => {
      clearInterval(fetchTimerRef.current);
    };
  }, []);

  // ── React to GPS position prop changes ────────────────────────────────────
  useEffect(() => {
    if (!position) return;

    // Calculate heading from movement
    if (prevPosRef.current) {
      const dist = haversineM(prevPosRef.current, position);
      if (dist > 2) headingRef.current = calcBearing(prevPosRef.current, position);
    }
    prevPosRef.current = position;

    const dPos: DriverPosition = {
      lat: position.lat,
      lng: position.lng,
      heading: headingRef.current,
    };

    onGpsUpdate(dPos);

    // Reroute if >80m off — only if map and target ready
    if (mapsReady && target && lastFetchPosRef.current) {
      const drift = haversineM(position, lastFetchPosRef.current);
      if (drift > 80) fetchRoute(position, target);
    }
  }, [position?.lat, position?.lng, mapsReady, onGpsUpdate]);

  // ── Fetch route when target changes ──────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !target || !position) return;
    fetchRoute(position, target);

    // Periodic reroute check every 20s
    clearInterval(fetchTimerRef.current);
    fetchTimerRef.current = setInterval(() => {
      const pos = latestPosRef.current;
      const last = lastFetchPosRef.current;
      if (pos && last && haversineM(pos, last) > 80) {
        fetchRoute(pos, target);
      }
    }, 20_000);

    return () => clearInterval(fetchTimerRef.current);
  }, [mapsReady, target?.lat, target?.lng]);

  // ── Voice instructions ────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigationMode || !voiceOn || !steps[currentStep]) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const txt = steps[currentStep].instruction;
    if (txt === spokenRef.current) return;
    spokenRef.current = txt;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = lang === 'fr' ? 'fr-FR' : lang === 'rw' ? 'rw-RW' : 'en-US';
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }, [currentStep, navigationMode, voiceOn, lang]);

  // ── Recenter ──────────────────────────────────────────────────────────────
  const recenter = () => {
    followingRef.current = true;
    setFollowing(true);
    const pos = latestPosRef.current;
    if (pos) updateCamera(pos);
  };

  const step = steps[currentStep];

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {/* Map */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Turn instruction */}
      {navigationMode && step && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(0,80,64,0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, color: 'white', flexShrink: 0,
          }}>
            {maneuverArrow(step.maneuver)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'white', fontWeight: 800, fontSize: 15, lineHeight: 1.3, margin: 0 }}>
              {step.instruction}
            </p>
            {step.distanceText && (
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '2px 0 0' }}>
                in {step.distanceText}
              </p>
            )}
          </div>
          {eta && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ color: 'white', fontWeight: 900, fontSize: 17, margin: 0 }}>{eta.duration}</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, margin: 0 }}>{eta.distance}</p>
            </div>
          )}
        </div>
      )}

      {/* Recenter button — shows when driver drags map */}
      {navigationMode && !following && (
        <button onClick={recenter} style={{
          position: 'absolute', bottom: 100, right: 12, zIndex: 10,
          background: 'white', border: 'none', borderRadius: 12,
          padding: '8px 14px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: 13, fontWeight: 700, color: '#00A082',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          📍 Recenter
        </button>
      )}

      {/* Voice toggle */}
      {navigationMode && (
        <button onClick={() => setVoiceOn(v => !v)} style={{
          position: 'absolute', bottom: following ? 100 : 148, right: 12, zIndex: 10,
          width: 44, height: 44, borderRadius: '50%',
          background: 'white', border: 'none', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {voiceOn ? '🔊' : '🔇'}
        </button>
      )}

      {/* ETA pill — non-nav */}
      {!navigationMode && eta && (
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
