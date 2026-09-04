'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, MapPin, Check, Clock } from 'lucide-react';
import { api } from '../../../lib/api/client';
import DriverBottomNav from '../../../components/DriverBottomNav';

type Delivery = {
  id: string;
  trackingCode?: string | null;
  itemDescription: string;
  pickupAddress: string;
  dropoffAddress: string;
  fee: number;
  status: string;
  distanceKm?: number;
  createdAt: string;
  deliveredAt?: string | null;
  pickupPhotoUrl?: string | null;
  dropoffPhotoUrl?: string | null;
};

type Stats = {
  totalDeliveries: number;
  totalEarned: number;
  todayDeliveries: number;
  todayEarned: number;
  active: number;
};

const STATUS_STYLE: Record<string, string> = {
  DELIVERED: 'bg-green-50 text-green-700',
  PICKED_UP: 'bg-amber-50 text-amber-700',
  COURIER_ASSIGNED: 'bg-blue-50 text-blue-700',
  CANCELLED: 'bg-red-50 text-red-600',
};

export default function MyDeliveriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Delivery[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'DELIVERED'>('ALL');

  useEffect(() => {
    Promise.all([
      api.get<Delivery[]>('/driver/deliveries/mine').catch(() => []),
      api.get<Stats>('/driver/deliveries/stats').catch(() => null),
    ]).then(([list, s]) => {
      setItems(Array.isArray(list) ? list : []);
      setStats(s);
      setLoading(false);
    });
  }, []);

  const visible = items.filter(d =>
    filter === 'ALL' ? true
    : filter === 'ACTIVE' ? ['COURIER_ASSIGNED', 'PICKED_UP'].includes(d.status)
    : d.status === 'DELIVERED');

  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-black text-gray-900">My deliveries</h1>
      </div>

      {/* Earnings */}
      {stats && (
        <div className="px-4 pt-4">
          <div className="bg-zana-primary rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs">Earned today</p>
              <p className="text-white text-2xl font-black">{stats.todayEarned.toLocaleString()} RWF</p>
              <p className="text-white/60 text-[11px] mt-0.5">
                {stats.todayDeliveries} deliver{stats.todayDeliveries === 1 ? 'y' : 'ies'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs">All time</p>
              <p className="text-white text-lg font-bold">{stats.totalEarned.toLocaleString()} RWF</p>
              <p className="text-white/60 text-[11px] mt-0.5">{stats.totalDeliveries} completed</p>
            </div>
          </div>

          {stats.active > 0 && (
            <button
              onClick={() => router.push('/delivery')}
              className="w-full mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <p className="text-sm font-bold text-amber-800 flex-1 text-left">
                {stats.active} delivery in progress — tap to continue
              </p>
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 px-4 pt-4 pb-1">
        {(['ALL', 'ACTIVE', 'DELIVERED'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-bold px-4 py-2 rounded-full border-2 ${
              filter === f
                ? 'bg-zana-primary text-white border-zana-primary'
                : 'bg-white text-gray-600 border-gray-100'
            }`}>
            {f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'In progress' : 'Completed'}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3 space-y-2">
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="text-center py-14">
            <Package size={34} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Nothing here yet</p>
          </div>
        )}

        {visible.map(d => (
          <div key={d.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                {d.trackingCode && (
                  <p className="font-mono text-[11px] font-bold text-zana-primary">{d.trackingCode}</p>
                )}
                <p className="font-bold text-sm text-gray-900 line-clamp-1">{d.itemDescription}</p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ml-2 ${
                STATUS_STYLE[d.status] ?? 'bg-gray-100 text-gray-600'
              }`}>
                {d.status.replace(/_/g, ' ')}
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

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <Clock size={11} />
                {d.status === 'DELIVERED' ? fmt(d.deliveredAt) : fmt(d.createdAt)}
                {d.distanceKm != null && <span>· {d.distanceKm} km</span>}
              </div>
              <span className="font-black text-zana-primary">{d.fee?.toLocaleString()} RWF</span>
            </div>

            {/* Proof photos the driver took */}
            {(d.pickupPhotoUrl || d.dropoffPhotoUrl) && (
              <div className="flex gap-2 mt-3">
                {d.pickupPhotoUrl && (
                  <a href={d.pickupPhotoUrl} target="_blank" rel="noreferrer" className="flex-1">
                    <img src={d.pickupPhotoUrl} alt="Pickup"
                      className="w-full h-20 object-cover rounded-xl border border-gray-100" />
                    <p className="text-[9px] text-gray-400 mt-1 text-center">Pickup</p>
                  </a>
                )}
                {d.dropoffPhotoUrl && (
                  <a href={d.dropoffPhotoUrl} target="_blank" rel="noreferrer" className="flex-1">
                    <img src={d.dropoffPhotoUrl} alt="Drop-off"
                      className="w-full h-20 object-cover rounded-xl border border-gray-100" />
                    <p className="text-[9px] text-gray-400 mt-1 text-center">Drop-off</p>
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <DriverBottomNav />
    </div>
  );
}
