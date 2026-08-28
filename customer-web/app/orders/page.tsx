'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, MapPin, Navigation } from 'lucide-react';
import { fetchMyDeliveries, Delivery } from '../../lib/api/deliveries';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Finding a courier',
  COURIER_ASSIGNED: 'Courier assigned',
  PICKED_UP: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-700',
  COURIER_ASSIGNED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

function OrdersContent() {
  const params = useSearchParams();
  const highlightId = params.get('highlight');
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);

  useEffect(() => {
    const load = () => fetchMyDeliveries().then(setDeliveries).catch(() => setDeliveries([]));
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Orders</h1>

      {deliveries === null && <p className="text-sm text-zana-muted">Loading…</p>}

      {deliveries?.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="w-14 h-14 rounded-full bg-zana-primary-light flex items-center justify-center mb-3">
            <Package size={22} className="text-zana-primary" />
          </div>
          <p className="text-sm text-zana-muted">Your deliveries will show up here.</p>
        </div>
      )}

      <div className="space-y-3">
        {deliveries?.map((d) => (
          <div
            key={d.id}
            className={`bg-white rounded-2xl p-4 shadow-sm ${
              d.id === highlightId ? 'ring-2 ring-zana-primary animate-fade-slide-up' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-zana-primary-light flex items-center justify-center shrink-0">
                  <Package size={20} className="text-zana-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.itemDescription}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[d.status] ?? ''}`}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                </div>
                <p className="text-xs text-zana-muted mt-1">
                  {d.fee.toLocaleString()} RWF · {d.distanceKm} km
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 pl-1">
              <div className="flex items-start gap-2">
                <MapPin size={12} className="text-zana-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-700 truncate">{d.pickupAddress}</p>
              </div>
              <div className="flex items-start gap-2">
                <Navigation size={12} className="text-zana-secondary-dark mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-700 truncate">{d.dropoffAddress}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersContent />
    </Suspense>
  );
}
