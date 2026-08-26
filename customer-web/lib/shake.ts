'use client';

import { useEffect, useRef } from 'react';

const SHAKE_THRESHOLD = 18;
const SHAKE_COOLDOWN_MS = 3000;

// Detects a firm phone shake using the browser's motion sensor and calls
// onShake(). Used during an active trip to open the safety report modal.
// No-ops silently on desktops/browsers without motion sensor support.
export function useShakeDetector(onShake: () => void, enabled: boolean) {
  const lastShakeAt = useRef(0);
  const lastAccel = useRef({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.DeviceMotionEvent) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

      const delta =
        Math.abs(accel.x - lastAccel.current.x) +
        Math.abs(accel.y - lastAccel.current.y) +
        Math.abs(accel.z - lastAccel.current.z);

      lastAccel.current = { x: accel.x, y: accel.y, z: accel.z };

      const now = Date.now();
      if (delta > SHAKE_THRESHOLD && now - lastShakeAt.current > SHAKE_COOLDOWN_MS) {
        lastShakeAt.current = now;
        onShake();
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [enabled, onShake]);
}

// iOS 13+ requires an explicit user gesture to grant motion sensor access.
// Call this from a button tap (e.g. when the tracking screen first mounts,
// behind a one-time "Enable safety features" prompt).
export async function requestMotionPermission(): Promise<boolean> {
  const DeviceMotionEventTyped = window.DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (typeof DeviceMotionEventTyped?.requestPermission === 'function') {
    try {
      const result = await DeviceMotionEventTyped.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  // Android / most browsers don't require explicit permission.
  return true;
}
