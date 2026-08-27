'use client';

import { useEffect, useState } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight, X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { fetchWallet, initiateMomoTopUp, checkMomoTopUpStatus } from '../../lib/api/trips';
import { ApiError } from '../../lib/api/client';

type WalletData = {
  balance: number;
  transactions: { id: string; amount: number; reference: string | null; createdAt: string; status: string }[];
};

type TopUpStage = 'form' | 'waiting' | 'success' | 'failed';

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [stage, setStage] = useState<TopUpStage>('form');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadWallet = () => fetchWallet().then(setWallet).catch(() => {});

  useEffect(() => {
    loadWallet();
  }, []);

  const handleStartTopUp = async () => {
    setError(null);
    try {
      const { ref } = await initiateMomoTopUp(phone, Number(amount));
      setStage('waiting');

      const interval = setInterval(async () => {
        const status = await checkMomoTopUpStatus(ref);
        if (status.status === 'completed') {
          clearInterval(interval);
          setStage('success');
          loadWallet();
        } else if (status.status === 'failed') {
          clearInterval(interval);
          setStage('failed');
        }
      }, 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the payment provider.');
    }
  };

  const closeModal = () => {
    setShowTopUp(false);
    setStage('form');
    setPhone('');
    setAmount('');
    setError(null);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Wallet</h1>

      <div className="bg-zana-primary-dark rounded-2xl p-5 text-white">
        <p className="text-white/70 text-sm">Available balance</p>
        <p className="text-3xl font-bold mt-1">{wallet ? wallet.balance.toLocaleString() : '…'} RWF</p>
        <button
          onClick={() => setShowTopUp(true)}
          className="mt-4 flex items-center gap-1.5 bg-zana-secondary text-gray-900 text-xs font-bold px-4 py-2 rounded-full transition-transform active:scale-95"
        >
          <Plus size={14} /> Top Up
        </button>
      </div>

      <h2 className="text-sm font-semibold text-gray-900 mt-6 mb-2">Recent transactions</h2>
      <div className="space-y-2">
        {wallet?.transactions.length === 0 && <p className="text-sm text-zana-muted">No transactions yet.</p>}
        {wallet?.transactions.map((t) => (
          <div key={t.id} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${t.amount > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
              {t.amount > 0 ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{t.reference ?? 'Transaction'}</p>
              <p className="text-xs text-zana-muted">
                {new Date(t.createdAt).toLocaleDateString()}
                {t.status === 'PENDING' && ' · Pending'}
              </p>
            </div>
            <span className={`text-sm font-semibold ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {t.amount > 0 ? '+' : ''}
              {t.amount.toLocaleString()} RWF
            </span>
          </div>
        ))}
      </div>

      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={stage === 'waiting' ? undefined : closeModal} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 animate-fade-slide-up">
            {stage === 'form' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg text-gray-900">Top up with Mobile Money</h2>
                  <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zana-muted block mb-1.5">Mobile money number</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="0788 123 456"
                      inputMode="numeric"
                      className="w-full border border-zana-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zana-muted block mb-1.5">Amount (RWF)</label>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="5000"
                      inputMode="numeric"
                      className="w-full border border-zana-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-zana-error mt-3">{error}</p>}
                <button
                  onClick={handleStartTopUp}
                  disabled={phone.length < 10 || !amount || Number(amount) < 100}
                  className="w-full mt-5 bg-zana-primary text-white font-semibold py-3 rounded-xl disabled:opacity-40 transition-transform active:scale-[0.98]"
                >
                  Request payment
                </button>
              </>
            )}

            {stage === 'waiting' && (
              <div className="text-center py-6">
                <Loader2 size={32} className="animate-spin text-zana-primary mx-auto mb-4" />
                <p className="font-semibold text-gray-900">Check your phone</p>
                <p className="text-sm text-zana-muted mt-1">
                  Approve the {Number(amount).toLocaleString()} RWF mobile money request sent to {phone}.
                </p>
              </div>
            )}

            {stage === 'success' && (
              <div className="text-center py-6">
                <CheckCircle2 size={40} className="text-zana-success mx-auto mb-4" />
                <p className="font-semibold text-gray-900">Top-up successful</p>
                <p className="text-sm text-zana-muted mt-1">Your wallet has been credited.</p>
                <button onClick={closeModal} className="mt-5 text-sm font-semibold text-zana-primary">
                  Done
                </button>
              </div>
            )}

            {stage === 'failed' && (
              <div className="text-center py-6">
                <XCircle size={40} className="text-zana-error mx-auto mb-4" />
                <p className="font-semibold text-gray-900">Payment failed or was declined</p>
                <button onClick={() => setStage('form')} className="mt-5 text-sm font-semibold text-zana-primary">
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
