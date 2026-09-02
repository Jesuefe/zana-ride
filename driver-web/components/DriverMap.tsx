'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';

type LatLng = { lat: number; lng: number };

// ── Helpers ─────────────────────────────────────────────────────────────────

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

function bearing(a: LatLng, b: LatLng): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((b.lat * Math.PI) / 180);
  const x =
    Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) -
    Math.sin((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function maneuverArrow(m: string): string {
  if (m.includes('left')) return '↰';
  if (m.includes('right')) return '↱';
  if (m.includes('uturn')) return '↩';
  if (m.includes('roundabout')) return '↻';
  return '↑';
}

// ── Component ────────────────────────────────────────────────────────────────

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
  const routePolyRef = useRef<any>(null);   // raw Polyline — we own zoom completely
  const stepMarkersRef = useRef<any[]>([]);
  const lastPosRef = useRef<LatLng | null>(null);
  const headingRef = useRef(0);
  const routeFetchedRef = useRef(false);
  const posRef = useRef<LatLng | null>(null);
  const tgtRef = useRef<LatLng | undefined>(undefined);
  const spokenRef = useRef('');
  const fetchTimerRef = useRef<any>(null);

  posRef.current = position;
  tgtRef.current = target;

  const [steps, setSteps] = useState<{
    instruction: string;
    distanceText: string;
    maneuver: string;
    endLocation: LatLng;
  }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [ready, setReady] = useState(false);
  const [routeError, setRouteError] = useState('');

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!containerRef.current || mapRef.current) return;
      const G = (window as any).google.maps;

      mapRef.current = new G.Map(containerRef.current, {
        center: position ?? { lat: -1.9536, lng: 30.0605 },
        zoom: 18,
        mapId: 'zana_nav',
        disableDefaultUI: true,
        gestureHandling: navigationMode ? 'none' : 'greedy',
        tilt: navigationMode ? 45 : 0,
        heading: 0,
        clickableIcons: false,
      });

      setReady(true);
    });
  }, []);

  // ── Fetch route from DirectionsService, draw as raw Polyline ──────────────
  const fetchRoute = useCallback(() => {
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    const pos = posRef.current;
    const tgt = tgtRef.current;
    if (!G || !map || !pos || !tgt) return;

    const svc = new G.DirectionsService();
    svc.route(
      {
        origin: new G.LatLng(pos.lat, pos.lng),
        destination: new G.LatLng(tgt.lat, tgt.lng),
        travelMode: G.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result: any, status: any) => {
        if (status !== 'OK') {
          setRouteError(`No route (${status})`);
          return;
        }
        setRouteError('');
        routeFetchedRef.current = true;

        const leg = result.routes[0]?.legs[0];
        if (!leg) return;

        setEta({ duration: leg.duration.text, distance: leg.distance.text });

        // Build full path from all step polylines
        const path: LatLng[] = [];
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

        // Draw raw Polyline — WE control zoom, not Google
        if (routePolyRef.current) routePolyRef.current.setMap(null);
        routePolyRef.current = new G.Polyline({
          path,
          strokeColor: '#00A082',
          strokeWeight: 6,
          strokeOpacity: 0.9,
          map,
        });

        // Destination marker
        if (!targetMarkerRef.current) {
          const div = document.createElement('div');
          div.innerHTML = `<div style="width:16px;height:16px;border-radius:50%;background:#E6A82E;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`;
          try {
            targetMarkerRef.current = new G.marker.AdvancedMarkerElement({ position: tgt, map, content: div });
          } catch {
            targetMarkerRef.current = new G.Marker({ position: tgt, map });
          }
        } else {
          try { targetMarkerRef.current.position = tgt; }
          catch { targetMarkerRef.current.setPosition(tgt); }
        }

        // Non-nav mode: fit bounds once
        if (!navigationMode) {
          const bounds = new G.LatLngBounds();
          path.forEach(p => bounds.extend(p));
          map.fitBounds(bounds, { top: 60, bottom: 80, left: 30, right: 30 });
        }
      }
    );
  }, [navigationMode]);

  // Fetch route when map + target are ready
  useEffect(() => {
    if (!ready || !target) return;
    fetchRoute();
    clearInterval(fetchTimerRef.current);
    // Refetch every 20s (rerouting if driver goes off route)
    fetchTimerRef.current = setInterval(fetchRoute, 20000);
    return () => clearInterval(fetchTimerRef.current);
  }, [ready, target?.lat, target?.lng, fetchRoute]);

  // ── Update driver marker + camera on every GPS update ────────────────────
  useEffect(() => {
    if (!position || !ready) return;
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    if (!G || !map) return;

    const pos = { lat: position.lat, lng: position.lng };

    // Calculate heading from movement
    if (lastPosRef.current) {
      const dist = haversineM(lastPosRef.current, position);
      if (dist > 1.5) {
        headingRef.current = bearing(lastPosRef.current, position);
      }
    }
    lastPosRef.current = position;
    const hdg = headingRef.current;

    // ── Driver marker (arrow pointing in direction of travel) ──
    if (!markerRef.current) {
      const div = document.createElement('div');
      div.id = 'zana-nav-arrow';
      div.style.cssText = 'width:56px;height:56px;display:flex;align-items:center;justify-content:center;';
      div.innerHTML = `
        <svg width="56" height="56" viewBox="0 0 56 56" style="transform:rotate(${hdg}deg);transition:transform 0.4s ease;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.35))">
          <circle cx="28" cy="28" r="24" fill="white"/>
          <path d="M28 10 L36 42 L28 36 L20 42 Z" fill="#00A082"/>
        </svg>`;
      try {
        markerRef.current = new G.marker.AdvancedMarkerElement({ position: pos, map, content: div });
      } catch {
        markerRef.current = new G.Marker({ position: pos, map });
      }
    } else {
      try {
        markerRef.current.position = pos;
        const svg = document.querySelector('#zana-nav-arrow svg') as HTMLElement;
        if (svg) svg.style.transform = `rotate(${hdg}deg)`;
      } catch {
        markerRef.current.setPosition(pos);
      }
    }

    // ── Camera: driver at bottom third, map rotates with heading ──
    if (navigationMode) {
      const LOOK_AHEAD = 0.00035; // ~39m ahead
      const rad = (hdg * Math.PI) / 180;
      const camLat = pos.lat + LOOK_AHEAD * Math.cos(rad);
      const camLng = pos.lng + LOOK_AHEAD * Math.sin(rad);

      if (map.moveCamera) {
        map.moveCamera({
          center: { lat: camLat, lng: camLng },
          zoom: 18,
          heading: hdg,
          tilt: 45,
        });
      } else {
        map.setCenter({ lat: camLat, lng: camLng });
        map.setZoom(18);
        map.setHeading?.(hdg);
        map.setTilt?.(45);
      }
    }

    // ── Advance step when driver reaches end of current step ──
    setCurrentStep(prev => {
      if (!steps.length || prev >= steps.length - 1) return prev;
      const dist = haversineM(position, steps[prev].endLocation);
      return dist < 30 ? prev + 1 : prev;
    });

  }, [position?.lat, position?.lng, ready, navigationMode]);

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
    u.volume = 1;
    window.speechSynthesis.speak(u);
  }, [currentStep, navigationMode, voiceOn, lang]);

  const step = steps[currentStep];

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {/* Map canvas */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Turn instruction banner */}
      {navigationMode && step && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(0,80,64,0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
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

      {/* Voice toggle */}
      {navigationMode && (
        <button
          onClick={() => setVoiceOn(v => !v)}
          style={{
            position: 'absolute', bottom: 100, right: 12, zIndex: 10,
            width: 44, height: 44, borderRadius: '50%',
            background: 'white', border: 'none', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {voiceOn ? '🔊' : '🔇'}
        </button>
      )}

      {/* ETA pill — non-nav mode */}
      {!navigationMode && eta && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 10,
          background: 'white', borderRadius: 12, padding: '6px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', gap: 8, alignItems: 'center',
          fontSize: 12,
        }}>
          <span style={{ fontWeight: 800, color: '#00A082' }}>{eta.duration}</span>
          <span style={{ color: '#9CA3AF' }}>·</span>
          <span style={{ color: '#6B7280' }}>{eta.distance}</span>
        </div>
      )}

      {/* Route error */}
      {routeError && (
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
          background: 'rgba(239,68,68,0.9)', color: 'white',
          borderRadius: 10, padding: '8px 12px', fontSize: 12,
        }}>
          {routeError} — check internet
        </div>
      )}
    </div>
  );
}
