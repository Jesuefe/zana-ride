'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../lib/api/client';
import BrandedMap from './BrandedMap';

type Props = {
  deliveryId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  status: string;
};

/**
 * Live view of a parcel in flight. The rider broadcasts position every 15s;
 * this listens for it and moves the marker, so the customer can see the
 * parcel approaching instead of refreshing and hoping.
 */
export default function DeliveryTracker({ deliveryId, pickup, dropoff, status }: Props) {
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com';
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('delivery:position', (d: any) => {
      if (d?.deliveryId !== deliveryId) return;
      if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return;
      setRiderPos({ lat: d.lat, lng: d.lng });
      setLastSeen(new Date());
    });

    return () => { socket.disconnect(); };
  }, [deliveryId]);

  // Rough ETA from the rider to wherever they're heading next.
  useEffect(() => {
    if (!riderPos) return;
    const G = (window as any).google?.maps;
    if (!G) return;

    // Before pickup they're going to the sender; after, to the receiver.
    const target = status === 'PICKED_UP' ? dropoff : pickup;

    new G.DirectionsService().route(
      {
        origin: new G.LatLng(riderPos.lat, riderPos.lng),
        destination: new G.LatLng(target.lat, target.lng),
        travelMode: G.TravelMode.DRIVING,
      },
      (res: any, s: any) => {
        if (s === 'OK') setEta(res.routes[0]?.legs[0]?.duration?.text ?? null);
      },
    );
  }, [riderPos?.lat, riderPos?.lng, status]);

  const stale = lastSeen ? Date.now() - lastSeen.getTime() > 90_000 : false;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <BrandedMap
        origin={pickup}
        destination={dropoff}
        driverPosition={riderPos}
        vehicleType="BIKE"
        height={200}
      />

      <div className="px-4 py-3">
        {!riderPos && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <p className="text-xs text-gray-500">
              Waiting for the rider to start moving…
            </p>
          </div>
        )}

        {riderPos && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${stale ? 'bg-amber-400' : 'bg-zana-primary animate-pulse'}`} />
              <p className="text-sm font-bold text-gray-900">
                {status === 'PICKED_UP' ? 'On the way to you' : 'Collecting your parcel'}
              </p>
            </div>
            {eta && !stale && (
              <span className="text-sm font-black text-zana-primary">{eta}</span>
            )}
          </div>
        )}

        {stale && (
          <p className="text-[11px] text-amber-600 mt-1">
            Position last updated a while ago — the rider may have lost signal.
          </p>
        )}
      </div>
    </div>
  );
}
