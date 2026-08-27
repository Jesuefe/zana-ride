'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  RotateCcw,
  Locate,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { loadGoogleMaps } from '../lib/mapsLoader';
import { ZANA_MAP_STYLE } from '../lib/mapStyle';

// Maps Google's maneuver codes to a matching arrow so the banner shows the
// actual turn direction rather than a generic "straight ahead" every time.
function maneuverIcon(maneuver: string) {
  if (maneuver.includes('sharp-left') || maneuver.includes('uturn-left')) return RotateCcw;
  if (maneuver.includes('sharp-right') || maneuver.includes('uturn-right')) return RotateCcw;
  if (maneuver.includes('slight-left')) return ArrowUpLeft;
  if (maneuver.includes('slight-right')) return ArrowUpRight;
  if (maneuver.includes('left')) return CornerUpLeft;
  if (maneuver.includes('right')) return CornerUpRight;
  return ArrowUp;
}

type LatLng = { lat: number; lng: number };

type Step = {
  instruction: string;
  distanceText: string;
  maneuver: string;
  endLocation: LatLng;
};

// How close (in km) the driver needs to get to a turn before we advance
// to the next instruction — this is the actual mechanic that makes it
// "turn-by-turn" instead of just showing the first step forever.
const STEP_ADVANCE_THRESHOLD_KM = 0.04;

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

// A simple top-down car silhouette (rounded body, pointed windshield end)
// used as the driver's live marker — rotates to match travel heading.
const CAR_ICON_PATH =
  'M 0,-7 C 1.8,-7 3,-5.6 3,-4 L 3,4.5 C 3,5.7 2.1,6.5 0,6.5 C -2.1,6.5 -3,5.7 -3,4.5 L -3,-4 C -3,-5.6 -1.8,-7 0,-7 Z';

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
  const lastSpokenInstruction = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [heading, setHeading] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [showRecenter, setShowRecenter] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: position ?? { lat: -1.9536, lng: 30.0605 },
        zoom: navigationMode ? 18 : 15,
        tilt: navigationMode ? 45 : 0,
        renderingType: google.maps.RenderingType.VECTOR,
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
          path: CAR_ICON_PATH,
          scale: 1.4,
          fillColor: '#00A082',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 1.5,
          rotation: currentHeading,
          anchor: new google.maps.Point(0, 0),
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
      setCurrentStepIndex(0);
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
                  endLocation: { lat: s.end_location.lat(), lng: s.end_location.lng() },
                })),
              );
              setCurrentStepIndex(0);
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

  // Advances to the next instruction once the driver gets close to the end
  // of the current step — this is what actually makes it "turn-by-turn"
  // instead of freezing on the first instruction for the whole trip.
  useEffect(() => {
    if (!position || steps.length === 0) return;
    const current = steps[currentStepIndex];
    if (!current) return;
    const distanceToStepEnd = haversineKm(position, current.endLocation);
    if (distanceToStepEnd < STEP_ADVANCE_THRESHOLD_KM && currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    }
  }, [position?.lat, position?.lng, steps, currentStepIndex]);

  // Speaks the current turn instruction aloud the moment it changes — using
  // the browser's built-in speech engine, no external service needed.
  useEffect(() => {
    if (!navigationMode || !voiceOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    const instruction = steps[currentStepIndex]?.instruction;
    if (!instruction || instruction === lastSpokenInstruction.current) return;
    lastSpokenInstruction.current = instruction;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(instruction));
  }, [steps, currentStepIndex, navigationMode, voiceOn]);

  const handleRecenter = () => {
    followEnabled.current = true;
    setShowRecenter(false);
    if (mapInstance.current && position) {
      mapInstance.current.moveCamera({ center: position, heading, tilt: 45, zoom: 18 });
    }
  };

  const toggleVoice = () => {
    if (voiceOn) window.speechSynthesis?.cancel();
    setVoiceOn((v) => !v);
  };

  const currentStep = steps[currentStepIndex];
  const nextStep = steps[currentStepIndex + 1];

  return (
    <div className="relative" style={{ height }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {navigationMode && currentStep && (
        <div className="absolute top-3 left-3 right-3">
          <div className="bg-zana-primary-dark text-white rounded-2xl px-4 py-4 shadow-2xl flex items-center gap-4">
            {(() => {
              const Icon = maneuverIcon(currentStep.maneuver);
              return <Icon size={34} strokeWidth={2.4} className="shrink-0" />;
            })()}
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-snug">{currentStep.instruction}</p>
              <p className="text-sm text-white/70 mt-0.5">{currentStep.distanceText}</p>
            </div>
            <button
              onClick={toggleVoice}
              className="shrink-0 w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"
            >
              {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
          {nextStep && (
            <div className="bg-white/95 rounded-xl px-3 py-2 mt-1.5 mx-3 shadow flex items-center gap-2">
              <span className="text-xs font-medium text-zana-muted shrink-0">Then</span>
              {(() => {
                const NextIcon = maneuverIcon(nextStep.maneuver);
                return <NextIcon size={14} className="text-gray-700 shrink-0" />;
              })()}
              <span className="text-xs text-gray-700 truncate">{nextStep.instruction}</span>
            </div>
          )}
        </div>
      )}

      {navigationMode && showRecenter && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-32 right-3 bg-white rounded-full p-3 shadow-lg"
        >
          <Locate size={20} className="text-zana-primary" />
        </button>
      )}

      {navigationMode && eta && (
        <div className="absolute bottom-32 left-3 bg-white/95 rounded-xl px-3 py-2 shadow">
          <span className="text-sm font-bold text-zana-primary">{eta.duration}</span>
          <span className="text-xs text-zana-muted"> · {eta.distance}</span>
        </div>
      )}
    </div>
  );
}
