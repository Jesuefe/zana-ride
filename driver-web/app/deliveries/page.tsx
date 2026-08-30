'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Package, Check, X, Loader2, ChevronRight, Weight } from 'lucide-react';
import { fetchPendingDeliveries, acceptDelivery, PendingDelivery, updateDriverLocation } from '../../lib/api/driver';
import { getCurrentPosition } from '../../lib/location';

const WEIGHT_LABELS: Record<string, string> = {
  UNDER_1KG: '< 1 kg', KG_1_TO_5: '1–5 kg', KG_5_TO_10: '5–10 kg',
  KG_10_TO_20: '10–20 kg', OVER_20KG: '> 20 kg',
};

const WEIGHT_KG: Record<string, number> = {
  UNDER_1KG: 0.5, KG_1_TO_5: 3, KG_5_TO_10: 7.5,
  KG_10_TO_20: 15, OVER_20KG: 22,
};

const MAX_PACKAGES = 3;
const MAX_KG = 15;

export default function DeliveryMarketplace() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<PendingDelivery[]>([]);
  const [selected, setSelected] = useState<PendingDelivery[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCurrentPosition().then(c => {
      if (c) {
        setCoords(c);
        fetchPendingDeliveries(c.lat, c.lng)
          .then(setDeliveries)
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        // Fallback to Kigali centre
        fetchPendingDeliveries(-1.9536, 30.0605)
          .then(setDeliveries)
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    });
    const interval = setInterval(() => {
      if (coords) {
        fetchPendingDeliveries(coords.lat, coords.lng).then(setDeliveries).catch(() => {});
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [coords?.lat, coords?.lng]);

  const selectedKg = selected.reduce((sum, d) => sum + (WEIGHT_KG[d.weight] ?? 0), 0);

  const canSelect = (d: PendingDelivery) => {
    if (selected.find(s => s.id === d.id)) return true; // already selected
    if (selected.length >= MAX_PACKAGES) return false;
    if (selectedKg + (WEIGHT_KG[d.weight] ?? 0) > MAX_KG) return false;
    return true;
  };

  const toggleSelect = (d: PendingDelivery) => {
    setSelected(prev => {
      const exists = prev.find(s => s.id === d.id);
      if (exists) return prev.filter(s => s.id !== d.id);
      if (!canSelect(d)) return prev;
      return [...prev, d];
    });
  };

  const handleAcceptAll = async () => {
    if (!selected.length) return;
    setAccepting(true);
    setError('');
    try {
      await Promise.all(selected.map(d => acceptDelivery(d.id)));
      router.push('/');
    } catch (e: any) {
      setError(e.message ?? 'Could not accept deliveries.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-zana-primary-dark px-4 pt-12 pb-5">
        <button onClick={() => router.back()} className="text-white/70 text-sm mb-3">← Back</button>
        <h1 className="text-white text-xl font-bold">Available Deliveries</h1>
        <p className="text-white/70 text-xs mt-1">
          {coords ? 'Sorted by distance from your location' : 'Loading your location…'}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-white/15 rounded-full px-3 py-1 text-white text-xs">
            {selected.length}/{MAX_PACKAGES} selected
          </div>
          <div className="bg-white/15 rounded-full px-3 py-1 text-white text-xs">
            {selectedKg.toFixed(1)}/{MAX_KG} kg
          </div>
          <div className="bg-white/15 rounded-full px-3 py-1 text-white text-xs">
            {selected.reduce((s, d) => s + d.fee, 0).toLocaleString()} RWF total
          </div>
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-zana-primary" />
          </div>
        )}

        {!loading && deliveries.length === 0 && (
          <div className="text-center py-16">
            <Package size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No deliveries available near you right now.</p>
            <p className="text-xs text-gray-400 mt-1">Pull down to refresh.</p>
          </div>
        )}

        {deliveries.map((d, i) => {
          const isSelected = !!selected.find(s => s.id === d.id);
          const blocked = !isSelected && !canSelect(d);
          return (
            <button
              key={d.id}
              onClick={() => !blocked && toggleSelect(d)}
              disabled={blocked}
              className={`w-full text-left rounded-2xl p-4 shadow-sm transition-all ${
                isSelected
                  ? 'bg-zana-primary-light border-2 border-zana-primary'
                  : blocked
                  ? 'bg-white opacity-40'
                  : 'bg-white border-2 border-transparent'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Package image or icon */}
                {d.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Package size={24} className="text-gray-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{d.itemDescription}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-zana-muted flex items-center gap-0.5">
                          <Weight size={10} /> {WEIGHT_LABELS[d.weight] ?? d.weight}
                        </span>
                        <span className="text-[11px] text-zana-muted">· {d.distanceKm} km away</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-zana-primary">{d.fee.toLocaleString()}</p>
                      <p className="text-[10px] text-zana-muted">RWF</p>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <MapPin size={11} className="text-zana-primary mt-0.5 shrink-0" />
                      <p className="text-[11px] text-gray-600 truncate">{d.pickupAddress}</p>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Navigation size={11} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-gray-600 truncate">{d.dropoffAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Selection indicator */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-zana-primary' : 'border-2 border-gray-200'
                }`}>
                  {isSelected && <Check size={14} className="text-white" />}
                </div>
              </div>

              {/* Rank badge */}
              <div className="absolute -top-1 -left-1">
                {i < 3 && (
                  <span className="w-5 h-5 rounded-full bg-zana-secondary text-gray-900 text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Accept bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-lg">
          {error && <p className="text-xs text-zana-error mb-2">{error}</p>}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {selected.length} package{selected.length > 1 ? 's' : ''} selected
              </p>
              <p className="text-xs text-zana-muted">
                {selectedKg.toFixed(1)} kg · {selected.reduce((s, d) => s + d.fee, 0).toLocaleString()} RWF total
              </p>
            </div>
            <button
              onClick={handleAcceptAll}
              disabled={accepting}
              className="bg-zana-primary text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 disabled:opacity-40"
            >
              {accepting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Accept & Go
            </button>
          </div>
          {/* Route preview */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {selected.map((d, i) => (
              <div key={d.id} className="flex items-center gap-1 shrink-0">
                <div className="bg-zana-primary-light rounded-lg px-2 py-1">
                  <p className="text-[10px] font-semibold text-zana-primary">#{i + 1} {d.itemDescription.slice(0, 10)}</p>
                  <p className="text-[9px] text-zana-muted">{d.distanceKm} km</p>
                </div>
                {i < selected.length - 1 && <ChevronRight size={12} className="text-gray-300 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
