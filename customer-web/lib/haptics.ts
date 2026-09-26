'use client';

const canVibrate = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export type HapticPattern = 'tap' | 'success' | 'warning' | 'ride' | 'call';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 12,
  success: [18, 35, 28],
  warning: [45, 45, 45],
  ride: [28, 55, 28],
  call: [300, 120, 300, 120, 500],
};

export function haptic(pattern: HapticPattern = 'tap') {
  if (!canVibrate()) return false;
  try {
    navigator.vibrate(PATTERNS[pattern]);
    return true;
  } catch {
    return false;
  }
}

export function stopHaptic() {
  if (!canVibrate()) return;
  try { navigator.vibrate(0); } catch {}
}

export function startCallVibration() {
  if (!canVibrate()) return;
  try { navigator.vibrate(PATTERNS.call); } catch {}
}

export function startRideVibration() {
  if (!canVibrate()) return;
  try { navigator.vibrate(PATTERNS.ride); } catch {}
}
