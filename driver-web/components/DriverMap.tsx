'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader';

type LatLng = { lat: number; lng: number };

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

type Step = {
  instruction: string;
  distanceText: string;
  maneuver: string;
  endLocation: LatLng;
};

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

function bearingDeg(a: LatLng, b: LatLng): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
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
  const polylineRef = useRef<any>(null);
  const targetMarkerRef = useRef<any>(null);
  const lastPosRef = useRef<LatLng | null>(null);
  const lastSpokenRef = useRef('');

  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [heading, setHeading] = useState(0);

  // Init map
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!containerRef.current || mapRef.current) return;
      const G = (window as any).google.maps;

      mapRef.current = new G.Map(containerRef.current, {
        center: position ?? { lat: -1.9536, lng: 30.0605 },
        zoom: navigationMode ? 17 : 14,
        // Use mapId for vector map support — NO tilt/heading on raster maps
        mapId: 'zana_driver_nav',
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        zoomControl: !navigationMode,
      });
    });
  }, []);

  // Update driver marker position and heading
  useEffect(() => {
    if (!position || !mapRef.current) return;
    const G = (window as any).google?.maps;
    if (!G) return;

    // Calculate heading from previous position
    if (lastPosRef.current) {
      const dist = haversineM(lastPosRef.current, position);
      if (dist > 3) {
        const newHeading = bearingDeg(lastPosRef.current, position);
        setHeading(newHeading);
      }
    }
    lastPosRef.current = position;

    // Update or create driver marker using AdvancedMarkerElement
    const pos = position;
    if (!markerRef.current) {
      const div = document.createElement('div');
      div.id = 'driver-marker';
      div.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="18" fill="#00A082" stroke="white" stroke-width="3" opacity="0.9"/>
        <circle cx="20" cy="20" r="7" fill="white"/>
      </svg>`;
      div.style.transform = `rotate(${heading}deg)`;
      div.style.transition = 'transform 0.5s ease';
      try {
        markerRef.current = new G.marker.AdvancedMarkerElement({
          position: pos, map: mapRef.current, content: div, zIndex: 10,
        });
      } catch {
        markerRef.current = new G.Marker({ position: pos, map: mapRef.current });
      }
    } else {
      try {
        markerRef.current.position = pos;
        const div = document.getElementById('driver-marker');
        if (div) div.style.transform = `rotate(${heading}deg)`;
      } catch {
        markerRef.current.setPosition(pos);
      }
    }

    // Pan map to driver — no tilt or heading rotation on raster
    if (navigationMode && mapRef.current) {
      mapRef.current.panTo(pos);
    }

    // Check step advancement
    if (steps.length > 0 && currentStep < steps.length) {
      const step = steps[currentStep];
      const dist = haversineM(position, step.endLocation);
      if (dist < 40 && currentStep < steps.length - 1) {
        setCurrentStep(c => c + 1);
      }
    }
  }, [position?.lat, position?.lng]);

  // Fetch route when target changes — using Routes API (not deprecated DirectionsService)
  useEffect(() => {
    if (!position || !target || !mapRef.current) return;
    const G = (window as any).google?.maps;
    if (!G) return;

    const fetchRoute = async () => {
      try {
        // Use Routes API via fetch (not deprecated DirectionsService)
        const body = {
          origin: { location: { latLng: { latitude: position.lat, longitude: position.lng } } },
          destination: { location: { latLng: { latitude: target.lat, longitude: target.lng } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          languageCode: lang === 'rw' ? 'en' : lang,
          regionCode: 'RW',
        };

        const apiKey = 'AIzaSyD4o-fXIpmGozrClaP1niC407cgRCrzSTI';
        const res = await fetch(
          `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.steps',
            },
            body: JSON.stringify(body),
          }
        );

        if (!res.ok) throw new Error('Routes API error');
        const data = await res.json();
        const route = data.routes?.[0];
        if (!route) return;

        // Decode polyline and draw it
        const encodedPolyline = route.polyline?.encodedPolyline;
        if (encodedPolyline && G.geometry?.encoding) {
          const path = G.geometry.encoding.decodePath(encodedPolyline);

          if (polylineRef.current) polylineRef.current.setMap(null);
          polylineRef.current = new G.Polyline({
            path,
            strokeColor: '#00A082',
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map: mapRef.current,
          });
        }

        // Set ETA
        const durationSecs = parseInt(route.duration?.replace('s', '') ?? '0');
        const mins = Math.round(durationSecs / 60);
        const distKm = ((route.distanceMeters ?? 0) / 1000).toFixed(1);
        setEta({ duration: `${mins} min`, distance: `${distKm} km` });

        // Extract steps for turn-by-turn
        const leg = route.legs?.[0];
        if (leg?.steps) {
          const newSteps: Step[] = leg.steps.map((s: any) => ({
            instruction: stripHtml(s.navigationInstruction?.instructions ?? s.localizedValues?.distance?.text ?? ''),
            distanceText: s.localizedValues?.distance?.text ?? '',
            maneuver: s.navigationInstruction?.maneuver ?? '',
            endLocation: {
              lat: s.endLocation?.latLng?.latitude ?? target.lat,
              lng: s.endLocation?.latLng?.longitude ?? target.lng,
            },
          }));
          setSteps(newSteps);
          setCurrentStep(0);
        }
      } catch {
        // Fallback: just draw a straight line
        if (polylineRef.current) polylineRef.current.setMap(null);
        polylineRef.current = new G.Polyline({
          path: [position, target],
          strokeColor: '#00A082',
          strokeOpacity: 0.5,
          strokeWeight: 3,
          map: mapRef.current,
        });
      }
    };

    fetchRoute();
    const interval = setInterval(fetchRoute, 10000);

    // Target marker
    if (!targetMarkerRef.current) {
      const div = document.createElement('div');
      div.innerHTML = '<div style="width:16px;height:16px;border-radius:50%;background:#E6A82E;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>';
      try {
        targetMarkerRef.current = new G.marker.AdvancedMarkerElement({
          position: target, map: mapRef.current, content: div,
        });
      } catch {
        targetMarkerRef.current = new G.Marker({ position: target, map: mapRef.current });
      }
    } else {
      try { targetMarkerRef.current.position = target; }
      catch { targetMarkerRef.current.setPosition(target); }
    }

    if (!navigationMode) {
      const bounds = new G.LatLngBounds();
      bounds.extend(position);
      bounds.extend(target);
      mapRef.current.fitBounds(bounds, 60);
    }

    return () => clearInterval(interval);
  }, [target?.lat, target?.lng, lang]);

  // Voice — speak current step instruction
  useEffect(() => {
    if (!navigationMode || !voiceOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    const instruction = steps[currentStep]?.instruction;
    if (!instruction || instruction === lastSpokenRef.current) return;
    lastSpokenRef.current = instruction;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(instruction);
    utt.lang = lang === 'rw' ? 'rw-RW' : lang === 'fr' ? 'fr-FR' : 'en-US';
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
  }, [steps, currentStep, navigationMode, voiceOn, lang]);

  const currentInstruction = steps[currentStep]?.instruction;
  const maneuver = steps[currentStep]?.maneuver ?? '';

  // Arrow direction from maneuver
  const arrow = maneuver.includes('left') ? '←' : maneuver.includes('right') ? '→' : '↑';

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Turn-by-turn banner */}
      {navigationMode && currentInstruction && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-zana-primary-dark/90 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-bold">{arrow}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold leading-tight truncate">{currentInstruction}</p>
            {steps[currentStep]?.distanceText && (
              <p className="text-white/60 text-xs mt-0.5">in {steps[currentStep].distanceText}</p>
            )}
          </div>
          {eta && (
            <div className="text-right shrink-0">
              <p className="text-white font-bold text-sm">{eta.duration}</p>
              <p className="text-white/50 text-[10px]">{eta.distance}</p>
            </div>
          )}
        </div>
      )}

      {/* Voice toggle */}
      {navigationMode && (
        <button
          onClick={() => setVoiceOn(v => !v)}
          className="absolute bottom-16 right-3 z-10 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"
        >
          <span className="text-base">{voiceOn ? '🔊' : '🔇'}</span>
        </button>
      )}

      {/* ETA badge (non-navigation mode) */}
      {!navigationMode && eta && (
        <div className="absolute bottom-3 left-3 z-10 bg-white rounded-xl px-3 py-2 shadow text-xs">
          <span className="font-bold text-zana-primary">{eta.duration}</span>
          <span className="text-gray-400 ml-1">· {eta.distance}</span>
        </div>
      )}
    </div>
  );
}
