'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { io } from 'socket.io-client';
import { getToken } from '../lib/api/client';

/**
 * Listens for new paid orders and raises an audible alarm the merchant
 * cannot miss. Sits in the merchant layout so it works on every page.
 */
export default function OrderAlarm() {
  // This sits in the root layout, so it already fires identically for
  // both merchants and agents — the alarm itself was never actually
  // merchant-specific. The one real gap was here: "View order" always
  // sent whoever tapped it to the merchant orders page, even an agent
  // who'd never have a matching order there. Whoever is currently
  // browsing the agent section stays there when they act on an alert.
  const pathname = usePathname();
  const isAgent = pathname?.startsWith('/agent');
  const ringRef = useRef<HTMLAudioElement | null>(null);
  const [incoming, setIncoming] = useState<{
    orderId: string; trackingCode: string; total: number; itemCount: number;
  } | null>(null);

  const stopRing = () => {
    if (ringRef.current) {
      ringRef.current.pause();
      ringRef.current.currentTime = 0;
      ringRef.current = null;
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com';
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });

    socket.on('order:new', (data: any) => {
      setIncoming(data);
      try {
        const audio = new Audio('/ringtone.mp3');
        audio.loop = true;
        audio.volume = 1;
        audio.play().catch(() => {
          // Autoplay blocked until the merchant interacts with the page —
          // the visual banner still shows.
        });
        ringRef.current = audio;
      } catch {}
      try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch {}
    });

    return () => {
      socket.disconnect();
      stopRing();
    };
  }, []);

  if (!incoming) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-zana-primary-light mx-auto flex items-center justify-center mb-4 animate-bounce">
          <span className="text-4xl">🛎️</span>
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">New order</p>
        <p className="text-3xl font-black text-gray-900 mt-1">
          {incoming.total?.toLocaleString()} RWF
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {incoming.itemCount} item{incoming.itemCount === 1 ? '' : 's'} · Paid
        </p>
        <p className="text-xs font-mono font-bold text-zana-primary mt-3 bg-gray-50 rounded-lg py-2">
          {incoming.trackingCode}
        </p>

        <button
          onClick={() => { stopRing(); setIncoming(null); window.location.href = isAgent ? '/agent' : '/orders'; }}
          className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl mt-5"
        >
          View order
        </button>
        <button
          onClick={() => { stopRing(); setIncoming(null); }}
          className="w-full text-sm text-gray-400 py-2 mt-1"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
