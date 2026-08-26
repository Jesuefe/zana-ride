'use client';

import { useEffect, useState } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { fetchWallet } from '../../lib/api/trips';

type WalletData = { balance: number; transactions: { id: string; amount: number; reference: string | null; createdAt: string }[] };

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);

  useEffect(() => {
    fetchWallet().then(setWallet).catch(() => {});
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Wallet</h1>

      <div className="bg-zana-primary-dark rounded-2xl p-5 text-white">
        <p className="text-white/70 text-sm">Available balance</p>
        <p className="text-3xl font-bold mt-1">{wallet ? wallet.balance.toLocaleString() : '…'} RWF</p>
        <button className="mt-4 flex items-center gap-1.5 bg-zana-secondary text-gray-900 text-xs font-bold px-4 py-2 rounded-full">
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
              <p className="text-xs text-zana-muted">{new Date(t.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={`text-sm font-semibold ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {t.amount > 0 ? '+' : ''}
              {t.amount.toLocaleString()} RWF
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
