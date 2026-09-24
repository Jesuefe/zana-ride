'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, Loader2 } from 'lucide-react';
import { api } from '../../lib/api/client';
import { useLang } from '../../lib/LangContext';

type PointsData = { balance: number; totalEarned: number; rwfValue: number; transactions: any[] };

export default function PointsPage() {
  const { t } = useLang();
  const router = useRouter();
  const [data, setData] = useState<PointsData | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<PointsData>('/points/me').then(setData).catch(() => {});
  }, []);

  const handleRedeem = async () => {
    const pts = Number(redeemAmount);
    if (!pts || pts < 100) { setMsg(t('Minimum 100 points')); return; }
    setRedeeming(true);
    try {
      const res = await api.post<any>('/points/redeem', { points: pts });
      setMsg(`✅ ${res.pointsRedeemed} ${t('points redeemed for')} ${res.rwfCredited.toLocaleString()} RWF!`);
      const updated = await api.get<PointsData>('/points/me');
      setData(updated);
      setRedeemAmount('');
    } catch (e: any) { setMsg(e.message ?? t('Could not redeem points')); }
    finally { setRedeeming(false); }
  };

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">{t("Zana Points")}</h1>
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-zana-primary to-zana-primary-dark rounded-2xl p-5 text-white mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Star size={18} className="text-zana-secondary fill-zana-secondary" />
          <p className="text-white/70 text-sm">{t('Your points balance')}</p>
        </div>
        <p className="text-4xl font-bold">{data?.balance.toLocaleString() ?? '…'}</p>
        <p className="text-white/60 text-xs mt-1">≈ {data?.rwfValue.toLocaleString() ?? 0} RWF {t('value')} · {data?.totalEarned.toLocaleString() ?? 0} {t('earned total')}</p>
      </div>

      {/* How to earn */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <p className="font-semibold text-gray-900 mb-3 text-sm">{t('How to earn points')}</p>
        <div className="space-y-2">
          {[
            ['', 'Per ride', '1 point per 100 RWF spent'],
            ['📦', 'Per delivery', '1 point per 200 RWF spent'],
            ['', 'Rate a driver', '+2 bonus points'],
            ['', 'First ride ever', '+5 bonus points'],
          ].map(([icon, title, sub]) => (
            <div key={title} className="flex items-center gap-3">
              <span className="text-lg">{icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-900">{t(title)}</p>
                <p className="text-xs text-gray-400">{t(sub)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Redeem */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <p className="font-semibold text-gray-900 mb-1 text-sm">{t('Redeem points')}</p>
        <p className="text-xs text-gray-400 mb-3">{t('100 points = 500 RWF wallet credit (min 100 points)')}</p>
        <div className="flex gap-2">
          <input value={redeemAmount} onChange={e => setRedeemAmount(e.target.value.replace(/\D/g,''))}
            placeholder={t('Points to redeem')} inputMode="numeric"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
          <button onClick={handleRedeem} disabled={redeeming || !redeemAmount}
            className="bg-zana-primary text-white font-semibold px-4 rounded-xl text-sm disabled:opacity-40 flex items-center gap-1">
            {redeeming ? <Loader2 size={13} className="animate-spin" /> : null}
            Redeem
          </button>
        </div>
        {msg && <p className="text-xs mt-2 text-gray-600">{msg}</p>}
      </div>

      {/* History */}
      {data?.transactions && data.transactions.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-semibold text-gray-900 mb-3 text-sm">{t('Recent activity')}</p>
          <div className="space-y-2">
            {data.transactions.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 capitalize">{t.reason.replace(/_/g, ' ')}</span>
                <span className={`text-sm font-semibold ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {t.amount > 0 ? '+' : ''}{t.amount} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
