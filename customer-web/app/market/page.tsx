'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Store, Clock } from 'lucide-react';
import { fetchMarkets, Market } from '../../lib/api/marketplace';

export default function MarketsPage() {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = (lat?: number, lng?: number) =>
      fetchMarkets(lat, lng)
        .then(setMarkets)
        .catch(() => {})
        .finally(() => setLoading(false));

    // Distance and fee depend on where the customer is, so ask first.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => load(p.coords.latitude, p.coords.longitude),
        () => load(),
        { timeout: 6000 },
      );
    } else {
      load();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-xl font-black text-gray-900">Buy from the market</h1>
          <p className="text-xs text-gray-500">An agent shops for you and a rider brings it</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && markets.length === 0 && (
          <div className="text-center py-14">
            <Store size={36} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No markets available yet</p>
          </div>
        )}

        {markets.map(m => (
          <button
            key={m.id}
            onClick={() => router.push(`/market/view?id=${m.id}`)}
            className="w-full bg-white rounded-2xl overflow-hidden shadow-sm text-left active:scale-[0.99] transition-transform"
          >
            {m.coverUrl ? (
              <img src={m.coverUrl} alt={m.name} className="w-full h-28 object-cover" />
            ) : (
              <div className="w-full h-28 bg-zana-primary-light flex items-center justify-center">
                <Store size={28} className="text-zana-primary/40" />
              </div>
            )}

            <div className="p-4">
              <div className="flex items-start gap-3">
                {m.imageUrl && (
                  <img src={m.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 -mt-8 border-2 border-white" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500 line-clamp-1">{m.address}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 text-xs">
                <span className="flex items-center gap-1 text-gray-500">
                  <Clock size={11} /> {m.etaMinutes} min
                </span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500">{m.distanceText}</span>
                <span className="text-gray-300">·</span>
                <span className="font-bold text-zana-primary">
                  {m.deliveryFee.toLocaleString()} RWF delivery
                </span>
              </div>

              <p className="text-[11px] text-gray-400 mt-1.5">
                {m.productCount} item{m.productCount === 1 ? '' : 's'} listed today
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
