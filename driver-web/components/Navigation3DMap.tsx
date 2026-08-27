'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { loadGoogleMaps3d } from '../lib/mapsLoader3d';

type LatLng = { lat: number; lng: number };

type Step = {
  instruction: string;
  distanceText: string;
  endLocation: LatLng;
};

const STEP_ADVANCE_THRESHOLD_KM = 0.04;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
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

// Experimental: renders a real photorealistic 3D scene (actual building
// textures, not just shapes) using Google's Preview-status 3D Maps feature.
// This is genuinely the most advanced visual available on the web today,
// but it's Preview/Alpha — Google can change or break it without notice,
// and it's heavier to render than a normal map. Falls back to an error
// banner (never a blank screen) if it fails to load on a given device.
export default function Navigation3DMap({
  position,
  target,
  height = 260,
}: {
  position: LatLng | null;
  target?: LatLng;
  height?: number | string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const map3dRef = useRef<any>(null);
  const targetMarkerRef = useRef<any>(null);
  const lastPosition = useRef<LatLng | null>(null);
  const lastSpokenInstruction = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [heading, setHeading] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps3d();
        if (cancelled || !containerRef.current) return;
        const { Map3DElement } = await (window as any).google.maps.importLibrary('maps3d');

        const start = position ?? { lat: -1.9536, lng: 30.0605 };
        const map3d = new Map3DElement({
          center: { lat: start.lat, lng: start.lng, altitude: 40 },
          range: 220,
          tilt: 70,
          heading: 0,
          mode: 'HYBRID',
        });
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(map3d);
        map3dRef.current = map3d;
        setReady(true);
      } catch (err) {
        console.error('3D Maps failed to load, falling back:', err);
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the camera to follow the driver with a heading-locked "chase" view,
  // and keep a pin marker on their live position.
  useEffect(() => {
    if (!ready || !map3dRef.current || !position) return;
    const map3d = map3dRef.current;

    let currentHeading = heading;
    if (lastPosition.current) {
      const dist = Math.hypot(position.lat - lastPosition.current.lat, position.lng - lastPosition.current.lng);
      if (dist > 0.00003) {
        currentHeading = bearingBetween(lastPosition.current, position);
        setHeading(currentHeading);
      }
    }
    lastPosition.current = position;

    try {
      map3d.center = { lat: position.lat, lng: position.lng, altitude: 40 };
      map3d.heading = currentHeading;
      map3d.tilt = 70;
      map3d.range = 220;
    } catch {
      // Some alpha builds only support flyCameraTo — ignore direct-set failures.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, position?.lat, position?.lng]);

  // Places a marker at the current target (pickup, then destination). Wrapped
  // defensively — this is an alpha API and exact marker method names have
  // shifted between Google's preview releases, so a failure here shouldn't
  // take down the rest of the navigation experience.
  useEffect(() => {
    if (!ready || !map3dRef.current) return;
    (async () => {
      try {
        if (targetMarkerRef.current) {
          targetMarkerRef.current.remove?.();
          targetMarkerRef.current = null;
        }
        if (!target) return;
        const { Marker3DElement } = await (window as any).google.maps.importLibrary('maps3d');
        const marker = new Marker3DElement({ position: { lat: target.lat, lng: target.lng, altitude: 0 } });
        map3dRef.current.append(marker);
        targetMarkerRef.current = marker;
      } catch (err) {
        console.warn('3D target marker unavailable on this build:', err);
      }
    })();
  }, [ready, target?.lat, target?.lng]);

  // Fetch turn-by-turn steps via the normal (2D) Directions API — routing
  // data is identical regardless of which map renders it.
  useEffect(() => {
    if (!position || !target || typeof window === 'undefined' || !(window as any).google?.maps?.DirectionsService) {
      setSteps([]);
      setEta(null);
      return;
    }
    const directionsService = new (window as any).google.maps.DirectionsService();
    directionsService.route(
      { origin: position, destination: target, travelMode: (window as any).google.maps.TravelMode.DRIVING },
      (result: any, status: string) => {
        if (status === 'OK' && result) {
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            setEta({ duration: leg.duration?.text ?? '', distance: leg.distance?.text ?? '' });
            setSteps(
              leg.steps.map((s: any) => ({
                instruction: stripHtml(s.instructions),
                distanceText: s.distance?.text ?? '',
                endLocation: { lat: s.end_location.lat(), lng: s.end_location.lng() },
              })),
            );
            setCurrentStepIndex(0);
          }
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng]);

  useEffect(() => {
    if (!position || steps.length === 0) return;
    const current = steps[currentStepIndex];
    if (!current) return;
    if (haversineKm(position, current.endLocation) < STEP_ADVANCE_THRESHOLD_KM && currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    }
  }, [position?.lat, position?.lng, steps, currentStepIndex]);

  useEffect(() => {
    if (!voiceOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    const instruction = steps[currentStepIndex]?.instruction;
    if (!instruction || instruction === lastSpokenInstruction.current) return;
    lastSpokenInstruction.current = instruction;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(instruction));
  }, [steps, currentStepIndex, voiceOn]);

  const currentStep = steps[currentStepIndex];
  const nextStep = steps[currentStepIndex + 1];

  if (failed) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 bg-zana-primary-light text-center px-6"
        style={{ height }}
      >
        <AlertTriangle size={22} className="text-amber-600" />
        <p className="text-xs text-gray-700">
          The experimental 3D view isn't available on this device right now. Try the standard map instead.
        </p>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-zana-primary-light">
          <p className="text-xs text-zana-muted">Loading 3D view…</p>
        </div>
      )}

      {currentStep && (
        <div className="absolute top-3 left-3 right-3">
          <div className="bg-zana-primary-dark text-white rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3">
            <ArrowUp size={22} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{currentStep.instruction}</p>
              <p className="text-xs text-white/70">{currentStep.distanceText}</p>
            </div>
            <button
              onClick={() => {
                if (voiceOn) window.speechSynthesis?.cancel();
                setVoiceOn((v) => !v);
              }}
              className="shrink-0 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center"
            >
              {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
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

      {eta && (
        <div className="absolute bottom-3 left-3 bg-white/95 rounded-xl px-3 py-1.5 shadow text-xs">
          <span className="font-bold text-zana-primary">{eta.duration}</span>
          <span className="text-zana-muted"> · {eta.distance}</span>
        </div>
      )}

      <div className="absolute bottom-3 right-3 bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-1 rounded-full">
        Experimental 3D
      </div>
    </div>
  );
}
