'use client';

import { useEffect, useState } from 'react';
import { Package, MapPin, Navigation, Phone } from 'lucide-react';
import { fetchDeliveries, Delivery } from '../../lib/api/merchant';

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

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);

  useEffect(() => {
    const load = () => fetchDeliveries().then(setDeliveries).catch(() => setDeliveries([]));
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Deliveries</h1>
      <p className="text-sm text-gray-500 mb-5">Every package you&apos;ve sent through Zana.</p>

      {deliveries === null && <p className="text-sm text-gray-500">Loading…</p>}

      {deliveries?.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-xl">
          <Package size={26} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No deliveries yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {deliveries?.map((d) => (
          <div key={d.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              {d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Package size={20} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.itemDescription}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {d.receiverName ? `${d.receiverName} · ` : ''}
                      {d.receiverPhone}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[d.status] ?? ''}`}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {d.fee.toLocaleString()} RWF · {d.distanceKm} km
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 pl-1 border-t border-gray-100 pt-3">
              <div className="flex items-start gap-2">
                <MapPin size={12} className="text-zana-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-600 truncate">{d.pickupAddress}</p>
              </div>
              <div className="flex items-start gap-2">
                <Navigation size={12} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-600 truncate">{d.dropoffAddress}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
