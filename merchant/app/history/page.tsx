'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, Package } from 'lucide-react';
import { api } from '../../lib/api/client';

type Stats = {
  totalOrders: number; totalRevenue: number;
  todayOrders: number; todayRevenue: number;
  weekOrders: number; weekRevenue: number;
  cancelled: number; active: number;
};

export default function MerchantHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'ALL' | 'WEEK' | 'TODAY'>('ALL');

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/merchant/orders/history').catch(() => []),
      api.get<Stats>('/merchant/orders/stats').catch(() => null),
    ]).then(([h, s]) => {
      setOrders(Array.isArray(h) ? h : []);
      setStats(s);
      setLoading(false);
    });
  }, []);

  const cutoff =
    range === 'TODAY' ? new Date(new Date().setHours(0, 0, 0, 0))
    : range === 'WEEK' ? new Date(Date.now() - 7 * 864e5)
    : null;

  const visible = cutoff
    ? orders.filter(o => new Date(o.createdAt) >= cutoff)
    : orders;

  const revenue =
    range === 'TODAY' ? stats?.todayRevenue
    : range === 'WEEK' ? stats?.weekRevenue
    : stats?.totalRevenue;

  const count =
    range === 'TODAY' ? stats?.todayOrders
    : range === 'WEEK' ? stats?.weekOrders
    : stats?.totalOrders;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-black text-gray-900">Order history</h1>
      </div>

      {/* Revenue */}
      <div className="bg-zana-primary rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={14} className="text-white/70" />
          <p className="text-white/70 text-xs">
            {range === 'TODAY' ? 'Revenue today' : range === 'WEEK' ? 'Revenue this week' : 'Total revenue'}
          </p>
        </div>
        <p className="text-white text-3xl font-black">
          {(revenue ?? 0).toLocaleString()} RWF
        </p>
        <p className="text-white/60 text-xs mt-1">
          {count ?? 0} completed order{count === 1 ? '' : 's'}
          {stats?.active ? ` · ${stats.active} in progress` : ''}
        </p>
        <p className="text-white/50 text-[10px] mt-2">
          Goods value only — Zana's delivery fee is not included.
        </p>
      </div>

      {/* Range */}
      <div className="flex gap-2 mb-4">
        {(['TODAY', 'WEEK', 'ALL'] as const).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 ${
              range === r ? 'border-zana-primary bg-zana-primary text-white' : 'border-gray-100 bg-white text-gray-600'
            }`}>
            {r === 'TODAY' ? 'Today' : r === 'WEEK' ? 'This week' : 'All time'}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-sm text-gray-500 py-10">Loading…</p>}

      {!loading && visible.length === 0 && (
        <div className="text-center py-14">
          <Package size={34} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No completed orders in this period</p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map(o => (
          <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div>
                {o.trackingCode && (
                  <p className="font-mono text-[11px] font-bold text-zana-primary">{o.trackingCode}</p>
                )}
                <p className="text-xs text-gray-500">{o.customer?.firstName ?? 'Customer'}</p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                o.status === 'DELIVERED' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {o.status}
              </span>
            </div>

            <div className="space-y-1 py-2 border-y border-gray-50 my-2">
              {o.items?.map((i: any) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{i.product?.name} ×{i.quantity}</span>
                  <span className="text-gray-500">{(i.price * i.quantity).toLocaleString()} RWF</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[11px] text-gray-400">{fmt(o.createdAt)}</span>
              <span className="font-black text-gray-900">
                {((o.total ?? 0) - (o.deliveryFee ?? 0)).toLocaleString()} RWF
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
