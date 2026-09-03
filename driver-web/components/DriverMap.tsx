'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type LatLng = { lat: number; lng: number };

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ('pk.eyJ1IjoiYWplc3VlZmUiLCJhIjoiY210anp1bHo5MGlwZDJ6czg5dT' + 'U1NjJ2MiJ9.Z-pUfR_-sTBechdHeRRSCg');

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

function bearing(a: LatLng, b: LatLng): number {
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

// ── Component ─────────────────────────────────────────────────────────────────

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
  const lastPosRef = useRef<LatLng | null>(null);
  const headingRef = useRef(0);
  const routeFetchedRef = useRef(false);
  const posRef = useRef<LatLng | null>(null);
  const tgtRef = useRef<LatLng | undefined>(undefined);
  const spokenRef = useRef('');
  const fetchTimerRef = useRef<any>(null);

  posRef.current = position;
  tgtRef.current = target;

  const [steps, setSteps] = useState<{ instruction: string; distanceText: string; maneuver: string; endLocation: LatLng }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [ready, setReady] = useState(false);

  // ── Init Mapbox ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: position ? [position.lng, position.lat] : [30.0605, -1.9536],
        zoom: navigationMode ? 17 : 14,
        pitch: navigationMode ? 45 : 0,
        bearing: 0,
        attributionControl: false,
        logoPosition: 'bottom-right',
      });

      map.on('load', () => {
        // Add route source and layer
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#00A082', 'line-width': 6, 'line-opacity': 0.9 },
        });

        // Casing for route
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#007A63', 'line-width': 9, 'line-opacity': 0.3 },
        }, 'route-line');

        mapRef.current = map;
        setReady(true);
      });
    });

    return () => {
      clearInterval(fetchTimerRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Fetch route using Google DirectionsService (free tier) ─────────────────
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
      },
      (result: any, status: any) => {
        if (status !== 'OK') return;
        routeFetchedRef.current = true;

        const leg = result.routes[0]?.legs[0];
        if (!leg) return;

        setEta({ duration: leg.duration.text, distance: leg.distance.text });

        // Extract coordinates for Mapbox
        const coords: [number, number][] = [];
        const newSteps: typeof steps = [];

        leg.steps.forEach((s: any) => {
          s.lat_lngs.forEach((ll: any) => coords.push([ll.lng(), ll.lat()]));
          newSteps.push({
            instruction: stripHtml(s.instructions),
            distanceText: s.distance.text,
            maneuver: s.maneuver ?? '',
            endLocation: { lat: s.end_location.lat(), lng: s.end_location.lng() },
          });
        });

        setSteps(newSteps);
        setCurrentStep(0);

        // Draw on Mapbox — we own the camera completely
        const source = map.getSource('route') as any;
        if (source) {
          source.setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          });
        }

        // Non-nav mode: fit bounds to show full route
        if (!navigationMode && coords.length > 1) {
          const lngs = coords.map(c => c[0]);
          const lats = coords.map(c => c[1]);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: { top: 80, bottom: 100, left: 40, right: 40 }, duration: 500 }
          );
        }

        // Add destination marker
        if (!targetMarkerRef.current && tgt) {
          const el = document.createElement('div');
          el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#E6A82E;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)';
          import('mapbox-gl').then(({ default: mapboxgl }) => {
            targetMarkerRef.current = new mapboxgl.Marker({ element: el })
              .setLngLat([tgt.lng, tgt.lat])
              .addTo(map);
          });
        }
      }
    );
  }, [navigationMode]);

  // Fetch route when ready
  useEffect(() => {
    if (!ready || !target) return;

    // Wait for Google Maps to load
    const waitForGoogle = setInterval(() => {
      if ((window as any).google?.maps) {
        clearInterval(waitForGoogle);
        // Set lastPosRef so reroute check works
        lastPosRef.current = posRef.current;
        fetchRoute();
        // Reroute check every 15s if moved >80m from last fetch point
        fetchTimerRef.current = setInterval(() => {
          const pos = posRef.current;
          const lastFetched = lastPosRef.current;
          if (pos && (!lastFetched || haversineM(pos, lastFetched) > 80)) {
            lastPosRef.current = pos;
            fetchRoute();
          }
        }, 15_000);
      }
    }, 500);

    return () => {
      clearInterval(waitForGoogle);
      clearInterval(fetchTimerRef.current);
    };
  }, [ready, target?.lat, target?.lng, fetchRoute]);

  // ── Update driver marker + camera on GPS update ────────────────────────────
  useEffect(() => {
    if (!position || !ready || !mapRef.current) return;

    const map = mapRef.current;
    const pos = position;

    // Calculate heading
    if (lastPosRef.current) {
      const dist = haversineM(lastPosRef.current, pos);
      if (dist > 2) headingRef.current = bearing(lastPosRef.current, pos);
    }
    lastPosRef.current = pos;
    const hdg = headingRef.current;

    // Driver arrow marker
    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (!markerRef.current) {
        const el = document.createElement('div');
        el.id = 'zana-arrow';
        el.innerHTML = `
          <svg width="56" height="56" viewBox="0 0 56 56" style="filter:drop-shadow(0 3px 8px rgba(0,0,0,0.35))">
            <circle cx="28" cy="28" r="24" fill="white"/>
            <path d="M28 10 L36 42 L28 36 L20 42 Z" fill="#00A082"/>
          </svg>`;
        el.style.cssText = 'width:56px;height:56px;cursor:default;';
        markerRef.current = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
          .setLngLat([pos.lng, pos.lat])
          .addTo(map);
      } else {
        markerRef.current.setLngLat([pos.lng, pos.lat]);
      }

      // Rotate marker with heading
      markerRef.current.setRotation(hdg);
    });

    // ── Camera: Mapbox easeTo — smooth, no conflicts ────────────────────────
    if (navigationMode) {
      // Center directly on driver — Mapbox pitch handles the look-ahead perspective
      map.easeTo({
        center: [pos.lng, pos.lat],
        zoom: 17,
        bearing: hdg,
        pitch: 45,
        duration: 400,
      });
    }

    // Advance to next step
    setCurrentStep(prev => {
      if (!steps.length || prev >= steps.length - 1) return prev;
      return haversineM(pos, steps[prev].endLocation) < 30 ? prev + 1 : prev;
    });

  }, [position?.lat, position?.lng, ready, navigationMode]);

  // ── Voice instructions ─────────────────────────────────────────────────────
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

  const step = steps[currentStep];

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {/* Mapbox container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Turn instruction banner */}
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

      {/* Voice toggle */}
      {navigationMode && (
        <button onClick={() => setVoiceOn(v => !v)} style={{
          position: 'absolute', bottom: 90, right: 12, zIndex: 10,
          width: 44, height: 44, borderRadius: '50%',
          background: 'white', border: 'none', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {voiceOn ? '🔊' : '🔇'}
        </button>
      )}

      {/* ETA — non-nav mode */}
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
