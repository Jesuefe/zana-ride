'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';

type LatLng = { lat: number; lng: number };

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

function bearingDeg(a: LatLng, b: LatLng): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((b.lat * Math.PI) / 180);
  const x = Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) -
    Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getManeuverArrow(maneuver: string): string {
  if (maneuver.includes('turn-left') || maneuver === 'turn-left') return '↰';
  if (maneuver.includes('turn-right') || maneuver === 'turn-right') return '↱';
  if (maneuver.includes('slight-left')) return '↖';
  if (maneuver.includes('slight-right')) return '↗';
  if (maneuver.includes('uturn')) return '↩';
  if (maneuver.includes('roundabout')) return '↻';
  if (maneuver.includes('merge') || maneuver.includes('ramp')) return '↗';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const targetMarkerRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const routeIntervalRef = useRef<any>(null);
  const lastPosRef = useRef<LatLng | null>(null);
  const lastRouteFetchRef = useRef<number>(0);
  const lastSpokenRef = useRef('');
  const positionRef = useRef<LatLng | null>(null);
  const targetRef = useRef<LatLng | undefined>(undefined);

  const [steps, setSteps] = useState<{ instruction: string; distanceText: string; maneuver: string; endLocation: LatLng }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [heading, setHeading] = useState(0);
  const [routeError, setRouteError] = useState('');
  const [mapsReady, setMapsReady] = useState(false);

  // Keep refs in sync so callbacks always have fresh values
  positionRef.current = position;
  targetRef.current = target;

  // Initialize map
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!containerRef.current || mapRef.current) return;
      const G = (window as any).google.maps;
      mapRef.current = new G.Map(containerRef.current, {
        center: position ?? { lat: -1.9536, lng: 30.0605 },
        zoom: navigationMode ? 17 : 14,
        mapId: 'zana_driver_nav',
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        zoomControl: !navigationMode,
        tilt: navigationMode ? 45 : 0,
      });

      // Set up DirectionsRenderer once
      rendererRef.current = new G.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#00A082', strokeWeight: 6, strokeOpacity: 0.9 },
      });
      rendererRef.current.setMap(mapRef.current);

      setMapsReady(true);
    });
  }, []);

  // Fetch route from current driver position to target
  const fetchRoute = useCallback(() => {
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    const pos = positionRef.current;
    const tgt = targetRef.current;

    if (!G || !map || !pos || !tgt) return;

    const svc = new G.DirectionsService();
    svc.route({
      origin: new G.LatLng(pos.lat, pos.lng),
      destination: new G.LatLng(tgt.lat, tgt.lng),
      travelMode: G.TravelMode.DRIVING,
      provideRouteAlternatives: false,
      drivingOptions: { departureTime: new Date() },
    }, (result: any, status: any) => {
      if (status !== 'OK') {
        setRouteError(`Route: ${status}`);
        return;
      }
      setRouteError('');
      rendererRef.current?.setDirections(result);

      const leg = result.routes[0]?.legs[0];
      if (!leg) return;

      setEta({ duration: leg.duration.text, distance: leg.distance.text });

      setSteps(leg.steps.map((s: any) => ({
        instruction: stripHtml(s.instructions),
        distanceText: s.distance.text,
        maneuver: s.maneuver ?? '',
        endLocation: { lat: s.end_location.lat(), lng: s.end_location.lng() },
      })));
      setCurrentStep(0);

      if (navigationMode) {
        map.setCenter(new G.LatLng(pos.lat, pos.lng));
        map.setZoom(18);
      } else if (pos && tgt) {
        const bounds = new G.LatLngBounds();
        bounds.extend(new G.LatLng(pos.lat, pos.lng));
        bounds.extend(new G.LatLng(tgt.lat, tgt.lng));
        map.fitBounds(bounds, { top: 60, bottom: 60, left: 20, right: 20 });
      }

      // Update target marker
      if (!targetMarkerRef.current) {
        try {
          const div = document.createElement('div');
          div.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:#E6A82E;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`;
          targetMarkerRef.current = new G.marker.AdvancedMarkerElement({
            position: tgt, map, content: div,
          });
        } catch {
          targetMarkerRef.current = new G.Marker({ position: tgt, map });
        }
      } else {
        try { targetMarkerRef.current.position = tgt; }
        catch { targetMarkerRef.current.setPosition(tgt); }
      }
    });
  }, [navigationMode]);

  // Start/restart route polling when map is ready and target changes
  useEffect(() => {
    if (!mapsReady || !target) return;

    // Fetch immediately
    fetchRoute();

    // Refetch every 15 seconds to keep route current as driver moves
    clearInterval(routeIntervalRef.current);
    routeIntervalRef.current = setInterval(fetchRoute, 15000);

    return () => clearInterval(routeIntervalRef.current);
  }, [mapsReady, target?.lat, target?.lng, fetchRoute]);

  // Update driver marker position on every GPS update
  useEffect(() => {
    if (!position || !mapsReady) return;
    const G = (window as any).google?.maps;
    const map = mapRef.current;
    if (!G || !map) return;

    // Calculate heading from last position
    if (lastPosRef.current) {
      const dist = haversineM(lastPosRef.current, position);
      if (dist > 2) {
        const newHeading = bearingDeg(lastPosRef.current, position);
        setHeading(newHeading);
      }
    }
    lastPosRef.current = position;

    const pos = { lat: position.lat, lng: position.lng };

    // Create or update driver marker
    if (!markerRef.current) {
      const div = document.createElement('div');
      div.id = 'zana-driver-dot';
      div.style.cssText = `
        width: 48px; height: 48px; border-radius: 50%;
        background: #00A082; border: 3px solid white;
        box-shadow: 0 2px 12px rgba(0,160,130,0.6);
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.4s ease;
      `;
      div.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2L19 21L12 17L5 21L12 2Z"/></svg>`;
      try {
        markerRef.current = new G.marker.AdvancedMarkerElement({ position: pos, map, content: div });
      } catch {
        markerRef.current = new G.Marker({ position: pos, map });
      }
    } else {
      try {
        markerRef.current.position = pos;
        const div = document.getElementById('zana-driver-dot');
        if (div) div.style.transform = `rotate(${heading}deg)`;
      } catch {
        markerRef.current.setPosition(pos);
      }
    }

    // Keep map centered on driver in navigation mode
    if (navigationMode) {
      map.panTo(pos);
      map.setHeading?.(heading);
    }

    // Advance to next step when driver reaches step end point
    setCurrentStep(prev => {
      if (steps.length === 0 || prev >= steps.length - 1) return prev;
      const distToStep = haversineM(position, steps[prev].endLocation);
      if (distToStep < 35) return prev + 1;
      return prev;
    });

    // Refetch route if driver has moved >150m since last fetch (rerouting)
    const now = Date.now();
    if (now - lastRouteFetchRef.current > 15000) {
      lastRouteFetchRef.current = now;
      fetchRoute();
    }
  }, [position?.lat, position?.lng, mapsReady]);

  // Voice turn-by-turn instructions
  useEffect(() => {
    if (!navigationMode || !voiceOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    const instruction = steps[currentStep]?.instruction;
    if (!instruction || instruction === lastSpokenRef.current) return;
    lastSpokenRef.current = instruction;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(instruction);
    utt.lang = lang === 'fr' ? 'fr-FR' : lang === 'rw' ? 'rw-RW' : 'en-US';
    utt.rate = 1.0;
    utt.volume = 1.0;
    window.speechSynthesis.speak(utt);
  }, [currentStep, navigationMode, voiceOn, lang]);

  const step = steps[currentStep];
  const arrow = step ? getManeuverArrow(step.maneuver) : '↑';

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Turn-by-turn banner */}
      {navigationMode && step && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-zana-primary-dark/95 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white text-2xl font-bold">{arrow}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold leading-snug line-clamp-2">{step.instruction}</p>
            {step.distanceText && (
              <p className="text-white/60 text-xs mt-0.5">in {step.distanceText}</p>
            )}
          </div>
          {eta && (
            <div className="text-right shrink-0">
              <p className="text-white font-black text-base">{eta.duration}</p>
              <p className="text-white/50 text-[10px]">{eta.distance}</p>
            </div>
          )}
        </div>
      )}

      {/* Voice toggle */}
      {navigationMode && (
        <button
          onClick={() => setVoiceOn(v => !v)}
          className="absolute bottom-20 right-3 z-10 w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-lg"
        >
          {voiceOn ? '🔊' : '🔇'}
        </button>
      )}

      {/* ETA pill (non-navigation mode) */}
      {!navigationMode && eta && (
        <div className="absolute bottom-3 left-3 z-10 bg-white rounded-xl px-3 py-2 shadow text-xs flex items-center gap-2">
          <span className="font-bold text-zana-primary">{eta.duration}</span>
          <span className="text-gray-400">· {eta.distance}</span>
        </div>
      )}

      {/* Route error */}
      {routeError && (
        <div className="absolute top-3 left-3 right-3 z-10 bg-red-600/90 text-white text-xs px-3 py-2 rounded-lg">
          {routeError} — check internet connection
        </div>
      )}
    </div>
  );
}
