'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLivePosition, type Coords } from './location';
import { reverseGeocode } from './geocode';

export type PickupStatus = 'locating' | 'ready' | 'failed';

// Live pickup for booking screens. `pickup` stays null until a real GPS fix
// arrives (or the rider deliberately sets one with `setManual`); if the fix
// fails, status is 'failed' and the screen must say so and offer `retry`.
export function useLivePickup(enabled = true) {
  const [pickup, setPickup] = useState<Coords | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<PickupStatus>('locating');
  const attempt = useRef(0);

  const resolveAddress = useCallback((c: Coords, id: number) => {
    reverseGeocode(c.lat, c.lng).then((a) => {
      if (id === attempt.current && a) setAddress(a);
    });
  }, []);

  // Runs one GPS attempt. State is only set from the async callback.
  const run = useCallback(() => {
    const id = ++attempt.current;
    getLivePosition().then((c) => {
      if (id !== attempt.current) return;
      if (c) {
        setPickup(c);
        setStatus('ready');
        resolveAddress(c, id);
      } else {
        setPickup(null);
        setStatus('failed');
      }
    });
  }, [resolveAddress]);

  const retry = useCallback(() => {
    setStatus('locating');
    setAddress(null);
    run();
  }, [run]);

  // A rider-chosen pickup (typed search or dragged pin) replaces the GPS one
  // and cancels any fix still in flight.
  const setManual = useCallback((c: Coords, knownAddress?: string) => {
    const id = ++attempt.current;
    setPickup({ lat: c.lat, lng: c.lng });
    setStatus('ready');
    if (knownAddress) setAddress(knownAddress);
    else {
      setAddress(null);
      resolveAddress(c, id);
    }
  }, [resolveAddress]);

  useEffect(() => {
    if (!enabled) return;
    run();
    const ref = attempt;
    return () => { ref.current++; };
  }, [run, enabled]);

  return { pickup, address, status, retry, setManual };
}
