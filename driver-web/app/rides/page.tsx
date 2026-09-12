'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Navigation, XCircle } from 'lucide-react';
import { api } from '../../lib/api/client';

type RideHistoryItem = {
  id: string;
  status: string;
  pickupAddress: string;
  destinationAddress: string;
  fare: number;
  customerName: string;
  completedAt: string;
  cancelReason: string | null;
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  RIDE_COMPLETED: { text: 'Completed', cls: 'bg-green-50 text-green-700' },
  CUSTOMER_CANCELLED: { text: 'Cancelled by passenger', cls: 'bg-gray-100 text-gray-500' },
  DRIVER_CANCELLED: { text: 'You cancelled', cls: 'bg-red-50 text-red-600' },
};

export default function RidesHistoryPage() {
  const router = useRouter();
  const [rides, setRides] = useState<RideHistoryItem[] | null>(null);

  useEffect(() => {
    api.get<RideHistoryItem[]>('/driver/trips/history')
      .then(setRides)
      .catch(() => setRides([]));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-black text-gray-900">Your rides</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {rides === null && (
          <p className="text-center text-sm text-zana-muted py-12">Loading…</p>
        )}

        {rides !== null && rides.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-zana-muted">No rides yet</p>
          </div>
        )}

        {rides?.map((r) => {
          const statusInfo = STATUS_LABEL[r.status] ?? { text: r.status, cls: 'bg-gray-100 text-gray-500' };
          const isCancelled = r.status !== 'RIDE_COMPLETED';
          return (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-gray-900">{r.customerName}</p>
                  <p className="text-[11px] text-zana-muted">
                    {new Date(r.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date(r.completedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusInfo.cls}`}>
                  {statusInfo.text}
                </span>
              </div>

              <div className="space-y-1.5 mb-2">
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-zana-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-700 truncate">{r.pickupAddress}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Navigation size={12} className="text-zana-secondary-dark mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-700 truncate">{r.destinationAddress}</p>
                </div>
              </div>

              {isCancelled && r.cancelReason && (
                <div className="flex items-start gap-2 bg-red-50 rounded-lg px-3 py-2 mb-2">
                  <XCircle size={12} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-red-700">{r.cancelReason}</p>
                </div>
              )}

              {!isCancelled && (
                <div className="flex items-center justify-between bg-zana-primary-light rounded-lg px-3 py-2">
                  <span className="text-[11px] text-zana-muted">Fare</span>
                  <span className="text-sm font-bold text-gray-900">{r.fare.toLocaleString()} RWF</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
