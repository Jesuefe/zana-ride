'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { fetchEarnings } from '../../lib/api/driver';

export default function EarningsPage() {
  const router = useRouter();
  const [earnings, setEarnings] = useState<{ todayTotal: number; todayTrips: number; allTimeTotal: number } | null>(null);

  useEffect(() => {
    fetchEarnings().then(setEarnings).catch(() => {});
  }, []);

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Earnings</h1>
      </div>

      <div className="bg-zana-primary-dark rounded-2xl p-5 text-white">
        <p className="text-white/70 text-sm">Today's earnings</p>
        <p className="text-3xl font-bold mt-1">{earnings ? earnings.todayTotal.toLocaleString() : '…'} RWF</p>
        <div className="flex items-center gap-1.5 mt-3 text-white/80 text-xs">
          <TrendingUp size={13} />
          {earnings ? `${earnings.todayTrips} trip${earnings.todayTrips === 1 ? '' : 's'} completed today` : '…'}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4 mt-4">
        <p className="text-xs text-zana-muted">All-time earnings</p>
        <p className="text-xl font-bold text-gray-900 mt-1">{earnings ? earnings.allTimeTotal.toLocaleString() : '…'} RWF</p>
      </div>
    </div>
  );
}
