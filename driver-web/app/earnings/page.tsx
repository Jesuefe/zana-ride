'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, Truck, Car, Wallet, ArrowDownToLine, Loader2, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api/client';

type EarningsSummary = {
  todayEarnings: number;
  weekEarnings: number;
  totalEarnings: number;
  totalTrips: number;
  totalDeliveries: number;
  walletBalance: number;
  zanaCommission: number;
};

export default function EarningsPage() {
  const router = useRouter();
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<any>('/driver/earnings'),
      api.get<any>('/wallet/me'),
    ]).then(([earnings, wallet]) => {
      setData({
        todayEarnings: earnings.todayEarnings ?? 0,
        weekEarnings: earnings.weekEarnings ?? 0,
        totalEarnings: earnings.totalEarnings ?? 0,
        totalTrips: earnings.totalTrips ?? 0,
        totalDeliveries: earnings.totalDeliveries ?? 0,
        walletBalance: wallet.balance ?? 0,
        zanaCommission: Math.round((earnings.totalEarnings ?? 0) * 0.15 / 0.85),
      });
    }).catch(() => {});
  }, []);

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount < 1000) { setError('Minimum withdrawal is 1,000 RWF'); return; }
    if (amount > (data?.walletBalance ?? 0)) { setError('Insufficient balance'); return; }
    if (!withdrawPhone || withdrawPhone.replace(/\D/g,'').length < 9) { setError('Enter a valid phone number'); return; }

    setWithdrawing(true); setError('');
    try {
      await api.post('/wallet/withdraw', {
        amount,
        phone: `+250${withdrawPhone.replace(/\D/g,'')}`,
      });
      setWithdrawDone(true);
      setWithdrawAmount('');
      // Refresh balance
      const wallet = await api.get<any>('/wallet/me');
      setData(prev => prev ? { ...prev, walletBalance: wallet.balance } : prev);
    } catch (e: any) {
      setError(e.message ?? 'Withdrawal failed. Try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  const fmt = (n: number) => `${n.toLocaleString()} RWF`;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-zana-primary-dark px-4 pt-12 pb-6">
        <button onClick={() => router.back()} className="text-white/70 text-sm mb-4">← Back</button>
        <h1 className="text-white text-xl font-bold">Earnings & Wallet</h1>
        <p className="text-white/60 text-xs mt-1">15% platform commission applies to all earnings</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Wallet balance */}
        <div className="bg-zana-primary rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className="text-white/70" />
            <p className="text-white/70 text-xs">Available to withdraw</p>
          </div>
          <p className="text-3xl font-bold">{data ? fmt(data.walletBalance) : '…'}</p>
          <p className="text-white/60 text-xs mt-1">After 15% Zana commission deducted</p>
        </div>

        {/* Earnings grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Today's earnings", value: data?.todayEarnings, icon: TrendingUp, color: 'text-green-600' },
            { label: 'This week', value: data?.weekEarnings, icon: TrendingUp, color: 'text-blue-600' },
            { label: 'Total earned', value: data?.totalEarnings, icon: TrendingUp, color: 'text-zana-primary' },
            { label: 'Zana commission', value: data?.zanaCommission, icon: TrendingUp, color: 'text-amber-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl p-4 shadow-sm">
              <Icon size={16} className={`${color} mb-2`} />
              <p className="text-lg font-bold text-gray-900">{value !== undefined ? fmt(value) : '…'}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Trip stats */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="font-semibold text-gray-900 mb-3">Activity</p>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Car size={16} className="text-zana-primary" />
              <div>
                <p className="text-lg font-bold text-gray-900">{data?.totalTrips ?? '…'}</p>
                <p className="text-xs text-gray-500">Rides</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-amber-500" />
              <div>
                <p className="text-lg font-bold text-gray-900">{data?.totalDeliveries ?? '…'}</p>
                <p className="text-xs text-gray-500">Deliveries</p>
              </div>
            </div>
          </div>
        </div>

        {/* Withdrawal */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownToLine size={18} className="text-zana-primary" />
            <p className="font-semibold text-gray-900">Withdraw to Mobile Money</p>
          </div>

          {withdrawDone ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg px-4 py-3">
              <CheckCircle size={18} />
              <p className="text-sm font-semibold">Withdrawal sent! Check your phone.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Amount (RWF)</label>
                  <input
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value.replace(/\D/g,''))}
                    placeholder="Min 1,000 RWF"
                    inputMode="numeric"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">MTN / Airtel number</label>
                  <div className="flex gap-2">
                    <div className="border border-gray-200 rounded-lg px-3 flex items-center text-sm text-gray-500">+250</div>
                    <input
                      value={withdrawPhone}
                      onChange={e => setWithdrawPhone(e.target.value.replace(/\D/g,'').slice(0,9))}
                      placeholder="788 123 456"
                      inputMode="numeric"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmount || !withdrawPhone}
                className="w-full mt-4 bg-zana-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {withdrawing ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
                {withdrawing ? 'Processing…' : 'Withdraw'}
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-2">Withdrawals are processed via Paypack MoMo</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
