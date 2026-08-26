'use client';

import { Plus, ArrowDownLeft, ArrowUpRight, Download } from 'lucide-react';
import Topbar from '../../components/Topbar';
import { merchant, merchantDeliveries } from '../../lib/mockData';

const transactions = [
  { id: 't1', label: 'Wallet top up', date: 'Today, 8:00 AM', amount: 50000 },
  ...merchantDeliveries
    .filter((d) => d.status === 'DELIVERED')
    .map((d) => ({ id: d.id, label: `Delivery fee — ${d.receiverName}`, date: d.date, amount: -d.fee })),
];

export default function WalletPage() {
  return (
    <>
      <Topbar title="Wallet & Invoices" subtitle={merchant.branch} />
      <div className="p-8 space-y-6">
        <div className="bg-zana-primary-dark text-white rounded-xl p-6 max-w-md">
          <p className="text-white/70 text-sm">Available balance</p>
          <p className="text-3xl font-semibold mt-1">{merchant.walletBalance.toLocaleString()} RWF</p>
          <div className="flex gap-2 mt-4">
            <button className="flex items-center gap-1.5 bg-zana-secondary text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg">
              <Plus size={14} /> Add funds
            </button>
            <button className="flex items-center gap-1.5 bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/15 transition-colors">
              <Download size={14} /> Download report
            </button>
          </div>
        </div>

        <div className="bg-zana-surface border border-zana-border rounded-xl p-6 max-w-2xl">
          <h2 className="font-semibold text-gray-900 mb-4">Recent transactions</h2>
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.amount > 0 ? 'bg-[#EAF3DE] text-zana-success' : 'bg-[#FCEBEB] text-zana-error'}`}>
                    {t.amount > 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                  </div>
                  <div>
                    <div className="text-gray-900">{t.label}</div>
                    <div className="text-xs text-zana-muted">{t.date}</div>
                  </div>
                </div>
                <span className={`font-medium ${t.amount > 0 ? 'text-zana-success' : 'text-zana-error'}`}>
                  {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()} RWF
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
