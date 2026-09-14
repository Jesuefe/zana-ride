'use client';

// A sharp, high-pitched, synthesized alert — deliberately not a soft
// notification chime, and not the same warm ringtone used elsewhere for
// incoming voice calls. Generated directly with the Web Audio API rather
// than an audio file, so the exact tone, sharpness and loudness are
// fully controlled rather than depending on whatever asset happens to be
// bundled.
//
// One shared AudioContext, reused across every beep rather than created
// fresh each time — cheap to keep, and avoids hitting browser limits on
// how many audio contexts can exist at once.
let ctx: AudioContext | null = null;
function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function playBeep(audioCtx: AudioContext, startAt: number, durationSec: number) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square'; // sharper, more urgent than a pure sine tone
  osc.frequency.value = 1900; // a high, alarm-like pitch
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  // A brief ramp up and down on each beep, rather than switching the
  // oscillator on and off abruptly — an instant on/off produces an
  // audible click/pop; a few milliseconds of ramp keeps it sharp without
  // that artifact.
  const peak = 0.9; // loud, deliberately — this is a dispatch alert, not a chime
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.01);
  gain.gain.linearRampToValueAtTime(peak, startAt + durationSec - 0.02);
  gain.gain.linearRampToValueAtTime(0, startAt + durationSec);

  osc.start(startAt);
  osc.stop(startAt + durationSec);
}

let loopTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

// BEEP-BEEP-BEEP, a pause, then repeats — matches a vehicle dispatch
// alert rather than a single soft ping. Safe to call repeatedly; a
// second call while already running is a no-op rather than starting a
// second, overlapping loop.
export function startRideAlert() {
  if (running) return;
  const audioCtx = getContext();
  if (!audioCtx) return;
  running = true;

  const BEEP_DUR = 0.14;
  const BEEP_GAP = 0.11;
  const CYCLE_PAUSE = 1.1;
  const cycleLength = BEEP_DUR * 3 + BEEP_GAP * 2 + CYCLE_PAUSE;

  const runCycle = () => {
    if (!running) return;
    const now = audioCtx.currentTime;
    playBeep(audioCtx, now, BEEP_DUR);
    playBeep(audioCtx, now + BEEP_DUR + BEEP_GAP, BEEP_DUR);
    playBeep(audioCtx, now + (BEEP_DUR + BEEP_GAP) * 2, BEEP_DUR);
    loopTimer = setTimeout(runCycle, cycleLength * 1000);
  };
  runCycle();
}

// Stops immediately — called the moment a request is accepted, declined,
// expires, or is cancelled, never left to finish out its current cycle.
export function stopRideAlert() {
  running = false;
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}
