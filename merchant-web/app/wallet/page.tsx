'use client';

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, Check, X } from 'lucide-react';
import Topbar from '../../components/Topbar';
import { fetchWallet, ApiWallet } from '../../lib/api/merchant';
import { api } from '../../lib/api/client';

export default function WalletPage() {
  const [wallet, setWallet] = useState<ApiWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = () => fetchWallet().then(setWallet).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleWithdraw = async () => {
    const amt = Number(amount);
    if (!amt || amt < 1000) { setError('Minimum withdrawal is 1,000 RWF'); return; }
    if (amt > (wallet?.balance ?? 0)) { setError('Insufficient balance'); return; }
    if (!phone.trim()) { setError('Enter your MoMo phone number'); return; }
    setWithdrawing(true); setError('');
    try {
      await api.post('/merchant/wallet/withdraw', { amount: amt, phone: `+250${phone.replace(/\D/g,'')}` });
      setSuccess(`${amt.toLocaleString()} RWF sent to ${phone}`);
      setAmount(''); setPhone(''); setShowWithdraw(false);
      load();
    } catch (e: any) {
      setError(e.message ?? 'Withdrawal failed');
    } finally { setWithdrawing(false); }
  };

  return (
    <>
      <Topbar title="Wallet" />
      <div className="p-6 space-y-5 max-w-2xl">
        {/* Balance card */}
        <div className="bg-zana-primary-dark text-white rounded-2xl p-6">
          <p className="text-white/60 text-sm">Available balance</p>
          <p className="text-4xl font-black mt-1">{loading ? '…' : (wallet?.balance ?? 0).toLocaleString()} RWF</p>
          <button
            onClick={() => setShowWithdraw(true)}
            className="mt-4 flex items-center gap-2 bg-zana-secondary text-gray-900 font-bold text-sm px-5 py-2.5 rounded-xl"
          >
            <ArrowUpRight size={16} /> Withdraw to MoMo
          </button>
        </div>

        {/* Success toast */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-800 text-sm">
            <Check size={15} /> {success}
          </div>
        )}

        {/* Transactions */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="font-bold text-gray-900">Transaction History</p>
          </div>
          {!wallet?.transactions?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {wallet.transactions.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${t.amount > 0 ? 'bg-green-100' : 'bg-red-50'}`}>
                    {t.amount > 0
                      ? <ArrowDownLeft size={16} className="text-green-600" />
                      : <ArrowUpRight size={16} className="text-red-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{t.description ?? (t.amount > 0 ? 'Credit' : 'Withdrawal')}</p>
                    <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className={`font-bold text-sm ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {t.amount > 0 ? '+' : ''}{t.amount?.toLocaleString()} RWF
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Withdraw sheet */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="w-full bg-white rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-lg text-gray-900">Withdraw Funds</h2>
              <button onClick={() => { setShowWithdraw(false); setError(''); }}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Available: <strong>{(wallet?.balance ?? 0).toLocaleString()} RWF</strong> · Minimum: 1,000 RWF
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Amount (RWF)</label>
                <input value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g,''))}
                  placeholder="e.g. 5000" inputMode="numeric"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zana-primary/30" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">MoMo phone number</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-500">+250</span>
                  <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))}
                    placeholder="78XXXXXXX" inputMode="tel"
                    className="flex-1 text-sm outline-none" />
                </div>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button onClick={handleWithdraw} disabled={withdrawing}
                className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2">
                {withdrawing ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
