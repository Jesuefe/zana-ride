'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, Truck, Car, Wallet, ArrowDownToLine, Loader2, CheckCircle, AlertCircle, Banknote } from 'lucide-react';
import { api } from '../../lib/api/client';

type EarningsSummary = {
  todayEarnings: number;
  weekEarnings: number;
  totalEarnings: number;
  totalTrips: number;
  totalDeliveries: number;
  walletBalance: number;
  zanaCommission: number;
  cashCollectedToday: number;
  zanaDue: number;
  netBalance: number;
  recentDebts: { id: string; amount: number; createdAt: string }[];
};

export default function EarningsPage() {
  const router = useRouter();
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [error, setError] = useState('');

  // Pay Debt Now — mirrors the exact same initiate/poll pattern already
  // proven on the customer app's MoMo top-up flow.
  const [showSettle, setShowSettle] = useState(false);
  const [settleStage, setSettleStage] = useState<'form' | 'waiting' | 'success' | 'failed'>('form');
  const [settlePhone, setSettlePhone] = useState('');
  const [settleError, setSettleError] = useState('');

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
        cashCollectedToday: earnings.cashCollectedToday ?? 0,
        zanaDue: earnings.zanaDue ?? 0,
        netBalance: earnings.netBalance ?? (wallet.balance ?? 0) - (earnings.zanaDue ?? 0),
        recentDebts: earnings.recentDebts ?? [],
      });
    }).catch(() => {});
  }, []);

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount < 10000) { setError('Minimum withdrawal is 10,000 RWF'); return; }
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

  const handleStartSettle = async () => {
    setSettleError('');
    if (!settlePhone || settlePhone.replace(/\D/g,'').length < 9) {
      setSettleError('Enter a valid phone number'); return;
    }
    try {
      const { ref } = await api.post<{ ref: string }>('/wallet/settle-debt', {
        phone: `+250${settlePhone.replace(/\D/g,'')}`,
      });
      setSettleStage('waiting');

      const interval = setInterval(async () => {
        const status = await api.get<{ status: string }>(`/wallet/settle-debt/${ref}/status`);
        if (status.status === 'completed') {
          clearInterval(interval);
          setSettleStage('success');
          // Refresh the real numbers rather than guess what changed —
          // the backend is the only source of truth for what's still due.
          const earnings = await api.get<any>('/driver/earnings');
          setData(prev => prev ? {
            ...prev,
            zanaDue: earnings.zanaDue ?? 0,
            recentDebts: earnings.recentDebts ?? [],
          } : prev);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          setSettleStage('failed');
        }
      }, 3000);
    } catch (e: any) {
      setSettleError(e.message ?? 'Could not reach the payment provider.');
    }
  };

  const closeSettleModal = () => {
    setShowSettle(false);
    setSettleStage('form');
    setSettlePhone('');
    setSettleError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-zana-primary-dark px-4 pt-12 pb-6">
        <button onClick={() => router.back()} className="text-white/70 text-sm mb-4">← Back</button>
        <h1 className="text-white text-xl font-bold">Earnings & Wallet</h1>
        <p className="text-white/60 text-xs mt-1">15% platform commission applies to all earnings</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Net balance — previously shown as two separate, seemingly
            contradictory numbers: a positive "available to withdraw"
            balance right next to a much larger amount owed. One real
            number now, matching how Uber represents this: what a
            driver would actually have if debt were settled right now. */}
        <div className={`rounded-2xl p-5 text-white ${data && data.netBalance < 0 ? 'bg-amber-600' : 'bg-zana-primary'}`}>
          <div className="flex items-center gap-2 mb-1">
            {data && data.netBalance < 0 ? <AlertCircle size={16} className="text-white/70" /> : <Wallet size={16} className="text-white/70" />}
            <p className="text-white/70 text-xs">{data && data.netBalance < 0 ? 'Balance owed to Zana' : 'Available to withdraw'}</p>
          </div>
          <p className="text-3xl font-bold">{data ? fmt(Math.abs(data.netBalance)) : '…'}{data && data.netBalance < 0 ? ' owed' : ''}</p>
          {data && data.zanaDue > 0 && (
            <p className="text-white/70 text-xs mt-1">
              {fmt(data.walletBalance)} in wallet · {fmt(data.zanaDue)} owed from cash rides
            </p>
          )}
          {!data?.zanaDue && <p className="text-white/60 text-xs mt-1">After 15% Zana commission deducted</p>}
          {data && data.netBalance < 0 && (
            <button
              onClick={() => setShowSettle(true)}
              className="w-full mt-3 bg-white text-amber-700 font-semibold py-2.5 rounded-xl text-sm"
            >
              Pay now with MoMo
            </button>
          )}
        </div>

        {/* Earnings grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Today's earnings", value: data?.todayEarnings, icon: TrendingUp, color: 'text-green-600' },
            { label: 'Cash collected today', value: data?.cashCollectedToday, icon: Banknote, color: 'text-amber-600' },
            { label: 'This week', value: data?.weekEarnings, icon: TrendingUp, color: 'text-blue-600' },
            { label: 'Total earned', value: data?.totalEarnings, icon: TrendingUp, color: 'text-zana-primary' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl p-4 shadow-sm">
              <Icon size={16} className={`${color} mb-2`} />
              <p className="text-lg font-bold text-gray-900">{value !== undefined ? fmt(value) : '…'}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Recent Zana-due activity — a real, direct view into the same
            ledger the backend has always kept, not a new number invented
            just for this screen. */}
        {data && data.recentDebts.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="font-semibold text-gray-900 mb-3">Recent Zana due</p>
            <div className="space-y-2.5">
              {data.recentDebts.map(d => (
                <div key={d.id} className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-sm font-semibold text-amber-700">+{fmt(d.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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

      {/* Pay Debt Now — same real, confirmed-through-Paypack flow as
          withdrawal and top-up, never a driver just claiming they paid. */}
      {showSettle && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={closeSettleModal}>
          <div className="w-full bg-white rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {settleStage === 'form' && (
              <>
                <p className="font-black text-lg text-gray-900 mb-1">Pay Zana</p>
                <p className="text-sm text-gray-500 mb-4">
                  {data ? fmt(data.zanaDue) : '…'} — the full amount currently due
                </p>
                <label className="text-xs font-medium text-gray-500 block mb-1">MTN / Airtel number</label>
                <div className="flex gap-2">
                  <div className="border border-gray-200 rounded-lg px-3 flex items-center text-sm text-gray-500">+250</div>
                  <input
                    value={settlePhone}
                    onChange={e => setSettlePhone(e.target.value.replace(/\D/g,'').slice(0,9))}
                    placeholder="788 123 456"
                    inputMode="numeric"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                {settleError && <p className="text-xs text-red-600 mt-2">{settleError}</p>}
                <button
                  onClick={handleStartSettle}
                  disabled={!settlePhone}
                  className="w-full mt-4 bg-amber-600 text-white font-semibold py-3 rounded-xl disabled:opacity-40"
                >
                  Pay now
                </button>
              </>
            )}

            {settleStage === 'waiting' && (
              <div className="flex flex-col items-center py-6">
                <Loader2 size={28} className="animate-spin text-amber-600 mb-3" />
                <p className="font-semibold text-gray-900">Check your phone</p>
                <p className="text-sm text-gray-500 mt-1 text-center">Approve the MoMo prompt to complete payment</p>
              </div>
            )}

            {settleStage === 'success' && (
              <div className="flex flex-col items-center py-6">
                <CheckCircle size={32} className="text-green-600 mb-3" />
                <p className="font-semibold text-gray-900">Payment received</p>
                <p className="text-sm text-gray-500 mt-1">Your Zana due balance is now settled</p>
                <button onClick={closeSettleModal} className="mt-5 text-sm font-semibold text-zana-primary">Done</button>
              </div>
            )}

            {settleStage === 'failed' && (
              <div className="flex flex-col items-center py-6">
                <AlertCircle size={28} className="text-red-600 mb-3" />
                <p className="font-semibold text-gray-900">Payment didn't go through</p>
                <button
                  onClick={() => setSettleStage('form')}
                  className="mt-4 text-sm font-semibold text-amber-600"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
