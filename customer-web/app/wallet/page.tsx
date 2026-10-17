'use client';

import { useEffect, useState } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight, X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { fetchWallet, initiateMomoTopUp, checkMomoTopUpStatus } from '../../lib/api/trips';
import { fetchMe } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { useLang } from '../../lib/LangContext';

type WalletData = {
  balance: number;
  transactions: { id: string; amount: number; reference: string | null; description?: string; balanceBefore?: number; balanceAfter?: number; createdAt: string; status: string }[];
};

type TopUpStage = 'form' | 'waiting' | 'success' | 'failed';

export default function WalletPage() {
  const { t } = useLang();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [stage, setStage] = useState<TopUpStage>('form');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [registeredPhone, setRegisteredPhone] = useState('');

  const loadWallet = () => fetchWallet().then(setWallet).catch(() => {});

  useEffect(() => {
    loadWallet();
    fetchMe().then((u: any) => setRegisteredPhone(u.phone ?? '')).catch(() => {});
  }, []);

  const handleStartTopUp = async () => {
    setError(null);
    if (!phone.trim() || !/^\+?[0-9]{9,15}$/.test(phone.trim())) {
      setError(t('Enter a valid mobile money number.'));
      return;
    }
    try {
      const { ref } = await initiateMomoTopUp(phone.trim(), Number(amount));
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
      setError(err instanceof ApiError ? err.message : t('Could not reach the payment provider.'));
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
    <div className="zana-wallet-page zana-wallet-screen min-h-screen bg-gray-50 p-4 pb-28 sm:p-6">
      <div className="zana-wallet-heading mb-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-zana-primary">ZANA PAYMENTS</p><div className="mt-1 flex items-end justify-between gap-3"><div><h1 className="text-2xl font-black tracking-tight text-gray-950">{t('Wallet')}</h1><p className="mt-1 text-sm text-gray-500">{t('Your money, ready to move.')}</p></div><span className="zana-wallet-status"><span className="zana-wallet-status-dot" /> {t('Secure wallet')}</span></div></div>

      <div className="zana-wallet-balance zana-wallet-balance-card rounded-[28px] p-6 text-white sm:p-8">
        <div className="zana-wallet-card-topline"><span className="zana-wallet-eyebrow">{t('Available balance')}</span><span className="zana-wallet-card-mark">Z</span></div>
        <p className="zana-wallet-amount mt-3 text-4xl font-black tracking-tight sm:text-5xl">{wallet ? wallet.balance.toLocaleString() : '…'} <span>RWF</span></p>
        <p className="zana-wallet-card-note">{t('Use your ZANA balance for a smoother checkout.')}</p>
        <div className="zana-wallet-actions">
          <button
            onClick={() => setShowTopUp(true)}
            className="zana-wallet-primary-action flex items-center justify-center gap-2 text-sm font-extrabold transition-transform active:scale-[0.98]"
          >
            <Plus size={16} /> {t('Top Up wallet')}
          </button>
        </div>
      </div>

      <div className="zana-transactions-heading mb-3 mt-8"><div><h2 className="text-lg font-black tracking-tight text-gray-900">{t('Recent transactions')}</h2><p className="mt-1 text-xs text-gray-500">{t('Your latest wallet activity')}</p></div><span className="zana-transaction-count">{wallet?.transactions.length ?? 0}</span></div>
      <div className="zana-transactions-list space-y-2">
        {wallet?.transactions.length === 0 && <p className="text-sm text-zana-muted">{t('No transactions yet.')}</p>}
        {wallet?.transactions.map((tx: any) => {
          const isCredit = tx.amount > 0;
          const isDebit = tx.amount < 0;
          const isInfo = tx.amount === 0; // cash/momo rides — recorded for history but no balance change
          return (
            <div key={tx.id} className="zana-transaction-row flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                isCredit ? 'bg-green-50 text-green-600' :
                isDebit ? 'bg-red-50 text-red-500' :
                'bg-gray-100 text-gray-500'
              }`}>
                {isCredit ? <ArrowDownLeft size={15} /> : isDebit ? <ArrowUpRight size={15} /> : <span className="text-xs font-bold">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">
                  {tx.description ?? (isCredit ? t('Top up') : isDebit ? t('Payment') : t('Ride recorded'))}
                </p>
                <p className="text-xs text-zana-muted">
                  {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {tx.status === 'PENDING' && ` · ${t('Pending')}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-bold ${isCredit ? 'text-green-600' : isDebit ? 'text-red-500' : 'text-gray-500'}`}>
                  {isCredit ? '+' : ''}{tx.amount.toLocaleString()} RWF
                </span>
                {isInfo && <p className="text-[10px] text-gray-400">{t('No charge')}</p>}
                {(isCredit || isDebit) && tx.balanceAfter !== undefined && (
                  <p className="text-[10px] text-gray-400">{t('Bal:')} {tx.balanceAfter?.toLocaleString()} RWF</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={stage === 'waiting' ? undefined : closeModal} />
          <div className="zana-topup-modal zana-wallet-modal relative w-full rounded-t-[28px] bg-white p-6 sm:max-w-sm sm:rounded-[28px] animate-fade-slide-up">
            {stage === 'form' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg text-gray-900">{t('Top up with Mobile Money')}</h2>
                  <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zana-muted block mb-1.5">{t('Mobile money number')}</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                      inputMode="tel"
                      placeholder={t('Mobile money number')}
                      className="w-full border border-zana-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                    />
                    <p className="text-[10px] text-zana-muted mt-1.5">{t('You can top up from any supported mobile money number.')}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zana-muted block mb-1.5">{t('Amount (RWF)')}</label>
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
                  disabled={!phone.trim() || !amount || Number(amount) < 980}
                  className="w-full mt-5 bg-zana-primary text-white font-semibold py-3 rounded-xl disabled:opacity-40 transition-transform active:scale-[0.98]"
                >
                  {t('Request payment')}
                </button>
              </>
            )}

            {stage === 'waiting' && (
              <div className="text-center py-6">
                <Loader2 size={32} className="animate-spin text-zana-primary mx-auto mb-4" />
                <p className="font-semibold text-gray-900">{t('Check your phone')}</p>
                <p className="text-sm text-zana-muted mt-1">
                  {t('Approve the')} {Number(amount).toLocaleString()} RWF {t('mobile money request sent to')} {phone}.
                </p>
              </div>
            )}

            {stage === 'success' && (
              <div className="text-center py-6">
                <CheckCircle2 size={40} className="text-zana-success mx-auto mb-4" />
                <p className="font-semibold text-gray-900">{t('Top-up successful')}</p>
                <p className="text-sm text-zana-muted mt-1">{t('Your wallet has been credited.')}</p>
                <button onClick={closeModal} className="mt-5 text-sm font-semibold text-zana-primary">
                  {t('Done')}
                </button>
              </div>
            )}

            {stage === 'failed' && (
              <div className="text-center py-6">
                <XCircle size={40} className="text-zana-error mx-auto mb-4" />
                <p className="font-semibold text-gray-900">{t('Payment failed or was declined')}</p>
                <button onClick={() => setStage('form')} className="mt-5 text-sm font-semibold text-zana-primary">
                  {t('Try again')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
