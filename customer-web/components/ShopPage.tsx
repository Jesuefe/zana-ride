'use client';

import { useLang } from '../lib/LangContext';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Store } from 'lucide-react';
import { fetchMarketplaceWithLocation, MarketplaceMerchant } from '../lib/api/marketplace';
import { getStoredPickup } from '../lib/location';

type Props = {
  category: 'FOOD' | 'GIFTS' | 'GOODS';
  title: string;
  emptyMessage: string;
};

// Was previously also responsible for showing a selected store's products
// and the entire cart/checkout flow inline on this same screen — tapping
// a store just swapped local state here rather than actually navigating
// anywhere. Now this page has exactly one job: let the customer browse
// stores and pick one. Everything about a specific store — its products,
// search, and the cart itself — now lives on that store's own dedicated
// page, which is where a customer would naturally expect it to be.
export default function ShopPage({ category, title, emptyMessage }: Props) {
  const { t } = useLang();
  const router = useRouter();
  const pickup = getStoredPickup();

  const [merchants, setMerchants] = useState<MarketplaceMerchant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketplaceWithLocation(category, pickup.lat, pickup.lng)
      .then(setMerchants)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white z-10 px-4 pt-10 pb-3 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && merchants.length === 0 && (
          <div className="text-center py-16">
            <Store size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">{emptyMessage}</p>
            <p className="text-xs text-gray-400 mt-1">{t('Check back soon.')}</p>
          </div>
        )}

        {merchants.map(m => (
          <button
            key={m.id}
            onClick={() => router.push(`/shop/store?id=${m.id}&category=${category}`)}
            className="w-full bg-white rounded-2xl overflow-hidden shadow-sm mb-3 text-left active:scale-[0.99] transition-transform"
          >
            {(m as any).coverUrl ? (
              <img src={(m as any).coverUrl} alt="" className="w-full h-28 object-cover" />
            ) : (
              <div className="w-full h-24 bg-zana-primary-light flex items-center justify-center">
                <Store size={26} className="text-zana-primary/40" />
              </div>
            )}

            <div className="p-4">
              <div className="flex items-start gap-3">
                {(m as any).logoUrl ? (
                  <img
                    src={(m as any).logoUrl}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover shrink-0 -mt-9 border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm -mt-9 border-2 border-white flex items-center justify-center shrink-0">
                    <Store size={18} className="text-zana-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 line-clamp-1">{m.businessName}</p>
                  {m.branch && <p className="text-xs text-gray-400 line-clamp-1">{m.branch}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2.5 mt-3 text-[11px] flex-wrap">
                <span className="flex items-center gap-1 text-gray-500">
                  <MapPin size={10} /> {m.distanceText}
                </span>
                <span className="text-gray-300">·</span>
                <span className="font-bold text-zana-primary">
                  {m.deliveryFee.toLocaleString()} RWF delivery
                </span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500">
                  {m.products.length} item{m.products.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
