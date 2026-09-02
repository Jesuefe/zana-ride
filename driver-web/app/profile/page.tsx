'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, Car, Truck, TrendingUp, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api/client';
import { fetchMyDriverProfile } from '../../lib/api/driver';

type DriverStats = {
  rating: number; totalTrips: number; totalDeliveries: number;
  memberSince: string; walletBalance: number;
  recentRatings: { score: number; comment?: string; rater: { firstName: string } }[];
};

type Debt = { totalDebt: number; debtCount: number };

export default function DriverProfilePage() {
  const router = useRouter();
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchMyDriverProfile().then(async p => {
      setProfile(p);
      // Fetch stats and debt independently so one failure doesn't block the other
      api.get<DriverStats>(`/ratings/driver/${p.id}/stats`)
        .then(setStats)
        .catch(() => {
          // Show profile data even if ratings endpoint fails
          setStats({
            rating: p.rating ?? 0,
            totalTrips: 0,
            totalDeliveries: 0,
            memberSince: new Date().toISOString(),
            walletBalance: 0,
            recentRatings: [],
          });
        });
      api.get<Debt>(`/driver/debt`)
        .then(setDebt)
        .catch(() => setDebt({ totalDebt: 0, debtCount: 0 }));
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-zana-primary-dark px-4 pt-12 pb-6">
        <button onClick={() => router.back()} className="text-white/70 text-sm mb-4">← Back</button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center">
            <Car size={28} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-xl">{profile?.user?.firstName ?? '—'} {profile?.user?.lastName ?? ''}</p>
            <p className="text-white/60 text-sm">{profile?.vehicle} · {profile?.plate}</p>
            <div className="flex items-center gap-1 mt-1">
              <Star size={14} className="text-zana-secondary fill-zana-secondary" />
              <span className="text-white font-semibold">{profile?.rating?.toFixed(1) ?? '0.0'}</span>
              <span className="text-white/50 text-xs">rating</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Commission debt warning */}
        {debt && debt.totalDebt > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Outstanding commission debt</p>
              <p className="text-xs text-amber-600 mt-0.5">
                You owe <strong>{debt.totalDebt.toLocaleString()} RWF</strong> in commission from {debt.debtCount} cash trip{debt.debtCount > 1 ? 's' : ''}. This will be deducted from your next wallet earning.
              </p>
              <p className="text-xs text-amber-500 mt-1">💡 Tip: Keep at least 5,000 RWF in your wallet to avoid debt.</p>
            </div>
          </div>
        )}

        {debt && debt.totalDebt === 0 && (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            <p className="text-sm text-green-700 font-semibold">No outstanding debt — you're all clear!</p>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Car, label: 'Total rides', value: stats?.totalTrips ?? '…', color: 'text-zana-primary' },
            { icon: Truck, label: 'Deliveries', value: stats?.totalDeliveries ?? '…', color: 'text-amber-500' },
            { icon: Star, label: 'Rating', value: stats ? `${stats.rating.toFixed(1)} ⭐` : '…', color: 'text-yellow-500' },
            { icon: Calendar, label: 'Member since', value: stats ? new Date(stats.memberSince).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : '…', color: 'text-blue-500' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white rounded-xl p-4 shadow-sm">
              <Icon size={16} className={`${color} mb-2`} />
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Approval status */}
        {profile?.approvalStatus && profile.approvalStatus !== 'APPROVED' && (
          <div className={`rounded-2xl p-4 ${profile.approvalStatus === 'REJECTED' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}`}>
            <p className="font-semibold text-sm mb-1">
              {profile.approvalStatus === 'REJECTED' ? '❌ Account rejected' : '⏳ Pending approval'}
            </p>
            {profile.rejectionReason && (
              <p className="text-xs text-gray-600">Reason: <strong>{profile.rejectionReason}</strong></p>
            )}
            {profile.approvalStatus === 'REJECTED' && (
              <p className="text-xs text-gray-500 mt-1">Please contact support@zana.rw to appeal.</p>
            )}
          </div>
        )}

        {/* Recent ratings */}
        {stats?.recentRatings && stats.recentRatings.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-semibold text-gray-900 text-sm mb-3">Recent ratings from passengers</p>
            <div className="space-y-3">
              {stats.recentRatings.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex shrink-0">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={12} className={s <= r.score ? 'text-zana-secondary fill-zana-secondary' : 'text-gray-200'} />
                    ))}
                  </div>
                  <div className="flex-1">
                    {r.comment && <p className="text-xs text-gray-600">"{r.comment}"</p>}
                    <p className="text-[10px] text-gray-400">{r.rater.firstName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
