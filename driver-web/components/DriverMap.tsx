'use client';

import { useEffect, useRef, useState } from 'react';
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
  const x = Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) - Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(dLng);
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
  const targetMarkerRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const lastPosRef = useRef<LatLng | null>(null);
  const lastSpokenRef = useRef('');

  const [steps, setSteps] = useState<{ instruction: string; distanceText: string; maneuver: string; endLocation: LatLng }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [heading, setHeading] = useState(0);

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
      });
    });
  }, []);

  // Update driver marker
  useEffect(() => {
    if (!position || !mapRef.current) return;
    const G = (window as any).google?.maps;
    if (!G) return;
    const pos = position;

    if (lastPosRef.current) {
      const dist = haversineM(lastPosRef.current, position);
      if (dist > 3) setHeading(bearingDeg(lastPosRef.current, position));
    }
    lastPosRef.current = position;

    if (!markerRef.current) {
      const div = document.createElement('div');
      div.id = 'zana-driver-marker';
      div.style.cssText = `width:44px;height:44px;border-radius:50%;background:#00A082;border:3px solid white;box-shadow:0 2px 12px rgba(0,160,130,0.5);display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);transition:transform 0.5s`;
      div.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2L19 21L12 17L5 21L12 2Z"/></svg>`;
      try {
        markerRef.current = new G.marker.AdvancedMarkerElement({ position: pos, map: mapRef.current, content: div });
      } catch {
        markerRef.current = new G.Marker({ position: pos, map: mapRef.current });
      }
    } else {
      try {
        markerRef.current.position = pos;
        const div = document.getElementById('zana-driver-marker');
        if (div) div.style.transform = `rotate(${heading}deg)`;
      } catch {
        markerRef.current.setPosition(pos);
      }
    }

    if (navigationMode) mapRef.current.panTo(pos);

    // Step advancement
    if (steps.length > 0 && currentStep < steps.length) {
      if (haversineM(position, steps[currentStep].endLocation) < 40 && currentStep < steps.length - 1) {
        setCurrentStep(c => c + 1);
      }
    }
  }, [position?.lat, position?.lng]);

  // Fetch route using DirectionsService (enabled on this key)
  useEffect(() => {
    if (!position || !target) return;

    // Wait for map to be initialized — retry up to 3 seconds
    let attempts = 0;
    const tryFetch = () => {
      const G = (window as any).google?.maps;
      if (!G || !mapRef.current) {
        if (attempts++ < 30) setTimeout(tryFetch, 100);
        return;
      }

      const svc = new G.DirectionsService();

      if (!rendererRef.current) {
        rendererRef.current = new G.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#00A082', strokeWeight: 5, strokeOpacity: 0.9 },
        });
        rendererRef.current.setMap(mapRef.current);
      }

      const fetchRoute = () => {
        svc.route({
          origin: new G.LatLng(position.lat, position.lng),
          destination: new G.LatLng(target.lat, target.lng),
          travelMode: G.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        }, (result: any, status: any) => {
          if (status !== 'OK') return;
          rendererRef.current.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (!leg) return;
          setEta({ duration: leg.duration.text, distance: leg.distance.text });

          const newSteps = leg.steps.map((s: any) => ({
            instruction: stripHtml(s.instructions),
            distanceText: s.distance.text,
            maneuver: s.maneuver ?? '',
            endLocation: { lat: s.end_location.lat(), lng: s.end_location.lng() },
          }));
          setSteps(newSteps);
          setCurrentStep(0);

          if (!navigationMode) {
            const bounds = new G.LatLngBounds();
            bounds.extend(position);
            bounds.extend(target);
            mapRef.current.fitBounds(bounds, 60);
          }
        });
      };

      fetchRoute();

      // Target marker
      if (!targetMarkerRef.current) {
        try {
        const div = document.createElement('div');
        div.innerHTML = `<div style="width:16px;height:16px;border-radius:50%;background:#E6A82E;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`;
        targetMarkerRef.current = new G.marker.AdvancedMarkerElement({ position: target, map: mapRef.current, content: div });
      } catch {
        targetMarkerRef.current = new G.Marker({ position: target, map: mapRef.current });
      }
    } else {
      try { targetMarkerRef.current.position = target; } catch { targetMarkerRef.current.setPosition(target); }
    }

      clearInterval(routeInterval);
      routeInterval = setInterval(fetchRoute, 10000);
    };

    let routeInterval: any;
    tryFetch();

    return () => clearInterval(routeInterval);
  }, [target?.lat, target?.lng, lang]);

  // Voice instructions
  useEffect(() => {
    if (!navigationMode || !voiceOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    const instruction = steps[currentStep]?.instruction;
    if (!instruction || instruction === lastSpokenRef.current) return;
    lastSpokenRef.current = instruction;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(instruction);
    utt.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
  }, [steps, currentStep, navigationMode, voiceOn, lang]);

  const currentInstruction = steps[currentStep]?.instruction ?? '';
  const maneuver = steps[currentStep]?.maneuver ?? '';
  const arrow = maneuver.includes('left') ? '←' : maneuver.includes('right') ? '→' : '↑';

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

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

      {navigationMode && (
        <button onClick={() => setVoiceOn(v => !v)}
          className="absolute bottom-16 right-3 z-10 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-base">
          {voiceOn ? '🔊' : '🔇'}
        </button>
      )}

      {!navigationMode && eta && (
        <div className="absolute bottom-3 left-3 z-10 bg-white rounded-xl px-3 py-2 shadow text-xs">
          <span className="font-bold text-zana-primary">{eta.duration}</span>
          <span className="text-gray-400 ml-1">· {eta.distance}</span>
        </div>
      )}
    </div>
  );
}
