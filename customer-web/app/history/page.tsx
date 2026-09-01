'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Car, MapPin, Clock, ChevronRight, Star } from 'lucide-react';
import { api } from '../../lib/api/client';

type TripSummary = {
  id: string; status: string; serviceType: string;
  pickupAddress: string; destinationAddress: string;
  estimatedFare: number; finalFare: number | null;
  requestedAt: string; completedAt: string | null;
  driver?: { user: { firstName: string | null }; rating: number } | null;
};

export default function HistoryPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    api.get<TripSummary[]>('/rides').then(data => {
      setTrips(data);
      const spent = data
        .filter(t => t.status === 'RIDE_COMPLETED')
        .reduce((s, t) => s + (t.finalFare ?? t.estimatedFare), 0);
      setTotalSpent(spent);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    if (s === 'RIDE_COMPLETED') return 'text-green-600 bg-green-50';
    if (s.includes('CANCELLED')) return 'text-red-600 bg-red-50';
    return 'text-blue-600 bg-blue-50';
  };

  const statusLabel = (s: string) => {
    if (s === 'RIDE_COMPLETED') return 'Completed';
    if (s === 'CUSTOMER_CANCELLED') return 'Cancelled';
    if (s === 'DRIVER_CANCELLED') return 'Driver cancelled';
    return s.replace(/_/g, ' ');
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Ride History</h1>
      </div>

      {/* Total spent */}
      <div className="bg-zana-primary rounded-2xl p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-white/70 text-xs">Total spent on rides</p>
          <p className="text-white text-2xl font-bold">{totalSpent.toLocaleString()} RWF</p>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-xs">Total rides</p>
          <p className="text-white text-2xl font-bold">{trips.filter(t => t.status === 'RIDE_COMPLETED').length}</p>
        </div>
      </div>

      {loading && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-zana-primary border-t-transparent" /></div>}

      <div className="space-y-2">
        {trips.length === 0 && !loading && (
          <div className="text-center py-12">
            <Car size={36} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No rides yet</p>
          </div>
        )}
        {trips.map(t => (
          <button key={t.id} onClick={() => t.status === 'RIDE_COMPLETED' && router.push(`/receipt?tripId=${t.id}`)}
            className="w-full text-left bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Car size={14} className="text-zana-primary" />
                <span className="text-sm font-semibold text-gray-900">{t.driver?.user?.firstName ?? 'No driver'}</span>
                {t.driver && <span className="flex items-center gap-0.5 text-xs text-gray-400"><Star size={9} className="text-zana-secondary fill-zana-secondary" />{t.driver.rating.toFixed(1)}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{(t.finalFare ?? t.estimatedFare).toLocaleString()} RWF</span>
                {t.status === 'RIDE_COMPLETED' && <ChevronRight size={14} className="text-gray-300" />}
              </div>
            </div>
            <div className="space-y-1 mb-2">
              <div className="flex items-start gap-1.5">
                <div className="w-2 h-2 rounded-full bg-zana-primary mt-1 shrink-0" />
                <p className="text-xs text-gray-500 truncate">{t.pickupAddress}</p>
              </div>
              <div className="flex items-start gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                <p className="text-xs text-gray-500 truncate">{t.destinationAddress}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock size={9} /> {new Date(t.requestedAt).toLocaleDateString()}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor(t.status)}`}>
                {statusLabel(t.status)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
