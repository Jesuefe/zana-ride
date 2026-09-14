'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../lib/api/client';

type Alert = {
  alertId: string;
  customerName: string;
  customerPhone?: string;
  tripId?: string;
  lat?: number;
  lng?: number;
  mapUrl?: string;
  at: string;
};

/**
 * Emergency alerts must interrupt whatever the safety team is doing.
 * Full-screen, loud, and it does not auto-dismiss.
 */
export default function SosListener() {
  const ringRef = useRef<HTMLAudioElement | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const stopRing = () => {
    if (ringRef.current) {
      ringRef.current.pause();
      ringRef.current = null;
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com';
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });

    socket.on('sos:alert', (data: Alert) => {
      setAlerts(prev => [data, ...prev]);
      try {
        const audio = new Audio('/ringtone.mp3');
        audio.loop = true;
        audio.volume = 1;
        audio.play().catch(() => {});
        ringRef.current = audio;
      } catch {}
    });

    return () => { socket.disconnect(); stopRing(); };
  }, []);

  const current = alerts[0];
  if (!current) return null;

  const dismiss = () => {
    stopRing();
    setAlerts(prev => prev.slice(1));
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-red-900/80 px-6">
      <div className="w-full max-w-md bg-white rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
            <span className="text-3xl">🚨</span>
          </div>
          <div>
            <p className="text-xs font-bold text-red-500 uppercase tracking-wide">
              Emergency alert
            </p>
            <p className="text-xl font-black text-gray-900">{current.customerName}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm mb-5">
          {current.customerPhone && (
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <a href={`tel:${current.customerPhone}`} className="font-bold text-zana-primary">
                {current.customerPhone}
              </a>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Time</span>
            <span className="text-gray-900">
              {new Date(current.at).toLocaleTimeString('en-GB')}
            </span>
          </div>
          {current.tripId && (
            <div className="flex justify-between">
              <span className="text-gray-500">Trip</span>
              <span className="font-mono text-xs text-gray-900">
                {current.tripId.slice(0, 8)}
              </span>
            </div>
          )}
        </div>

        {current.mapUrl && current.lat && (
          <a
            href={current.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full text-center bg-zana-primary text-white font-black py-3.5 rounded-2xl mb-2"
          >
            Open location on map
          </a>
        )}

        <button
          onClick={dismiss}
          className="w-full border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-2xl"
        >
          Acknowledge{alerts.length > 1 ? ` (${alerts.length - 1} more)` : ''}
        </button>
      </div>
    </div>
  );
}
