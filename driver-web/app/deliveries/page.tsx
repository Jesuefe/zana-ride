'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Package, MapPin, AlertTriangle, Clock, Layers } from 'lucide-react';
import { api } from '../../lib/api/client';
import DriverBottomNav from '../../components/DriverBottomNav';

type Pending = {
  id: string;
  trackingCode?: string | null;
  itemDescription: string;
  pickupAddress: string;
  dropoffAddress: string;
  fee: number;
  distanceKm: number;
  waitingMinutes: number;
  overdue: boolean;
  detourKm: number;
  canAccept: boolean;
  blockedReason: string | null;
  merchant?: { businessName?: string } | null;
};

type Active = {
  id: string;
  trackingCode?: string | null;
  itemDescription: string;
  pickupAddress: string;
  dropoffAddress: string;
  fee: number;
  status: string;
  routeSequence?: number | null;
};

export default function DeliveryPoolPage() {
  const router = useRouter();
  const [pool, setPool] = useState<Pending[]>([]);
  const [active, setActive] = useState<Active[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      p => {
        api.get<Pending[]>(`/driver/deliveries/pending?lat=${p.coords.latitude}&lng=${p.coords.longitude}`)
          .then(r => setPool(Array.isArray(r) ? r : []))
          .catch(() => {})
          .finally(() => setLoading(false));
      },
      () => setLoading(false),
      { timeout: 8000 },
    );
    api.get<Active[]>('/driver/deliveries/active/all')
      .then(r => setActive(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const accept = async (id: string) => {
    setAccepting(id);
    setError('');
    try {
      await api.post(`/driver/deliveries/${id}/accept`);
      load();
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('TOO_MANY_ACTIVE')) {
        const p = msg.split(':');
        setError(`You are already carrying ${p[1]} parcels. Finish one before taking another.`);
      } else if (msg.includes('OFF_ROUTE')) {
        const p = msg.split(':');
        setError(`That job is ${p[1]} km off your current route. Only jobs within ${p[2]} km can be added.`);
      } else if (msg.includes('ALREADY_ACCEPTED')) {
        setError('Another rider took that one.');
        load();
      } else {
        setError('Could not accept that delivery.');
      }
    } finally {
      setAccepting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 pt-12 pb-4">
        <h1 className="text-xl font-black text-gray-900">Delivery pool</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Pick jobs that fit your route. Up to 3 at a time.
        </p>
      </div>

      {/* What the rider is already carrying */}
      {active.length > 0 && (
        <div className="px-4 pt-4">
          <button
            onClick={() => router.push('/delivery')}
            className="w-full bg-zana-primary rounded-2xl p-4 text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <Layers size={15} className="text-white" />
              <p className="text-white font-black text-sm">
                Carrying {active.length} parcel{active.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="space-y-1">
              {active.map((a, i) => (
                <div key={a.id} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-white/25 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                    {a.routeSequence ?? i + 1}
                  </span>
                  <p className="text-white/85 text-xs line-clamp-1 flex-1">
                    {a.itemDescription}
                  </p>
                  <span className="text-white/60 text-[10px] shrink-0">
                    {a.status === 'PICKED_UP' ? 'On board' : 'To collect'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-white/70 text-[11px] mt-2">Tap to continue →</p>
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 pt-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">{error}</p>
          </div>
        </div>
      )}

      {/* The pool */}
      <div className="px-4 pt-4 space-y-2">
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && pool.length === 0 && (
          <div className="text-center py-14">
            <Package size={34} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No deliveries waiting near you</p>
          </div>
        )}

        {pool.map(d => (
          <div
            key={d.id}
            className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${
              d.overdue ? 'border-red-200' : 'border-transparent'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {d.overdue && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">
                      URGENT
                    </span>
                  )}
                  {d.trackingCode && (
                    <span className="font-mono text-[10px] font-bold text-zana-primary">
                      {d.trackingCode}
                    </span>
                  )}
                </div>
                <p className="font-bold text-sm text-gray-900 line-clamp-1 mt-0.5">
                  {d.itemDescription}
                </p>
              </div>
              <span className="font-black text-zana-primary shrink-0 ml-2">
                {d.fee?.toLocaleString()} RWF
              </span>
            </div>

            <div className="space-y-1.5 py-2 border-y border-gray-50 my-2">
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-zana-primary mt-1.5 shrink-0" />
                <p className="text-xs text-gray-600 line-clamp-1">{d.pickupAddress}</p>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <p className="text-xs text-gray-600 line-clamp-1">{d.dropoffAddress}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
              <span className="flex items-center gap-1">
                <MapPin size={10} /> {d.distanceKm} km away
              </span>
              <span className={`flex items-center gap-1 ${d.overdue ? 'text-red-500 font-bold' : ''}`}>
                <Clock size={10} /> waiting {d.waitingMinutes} min
              </span>
              {active.length > 0 && d.detourKm > 0 && (
                <span className={d.canAccept ? 'text-gray-400' : 'text-red-500 font-bold'}>
                  +{d.detourKm} km detour
                </span>
              )}
            </div>

            {d.canAccept ? (
              <button
                onClick={() => accept(d.id)}
                disabled={accepting === d.id}
                className="w-full bg-zana-primary text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {accepting === d.id ? 'Accepting…' : 'Accept delivery'}
              </button>
            ) : (
              <div className="w-full bg-gray-50 rounded-xl py-3 text-center">
                <p className="text-xs font-semibold text-gray-400">
                  {d.blockedReason === 'AT_CAPACITY'
                    ? 'You are carrying the maximum of 3'
                    : 'Too far off your current route'}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <DriverBottomNav />
    </div>
  );
}
