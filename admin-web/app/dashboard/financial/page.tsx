'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Users, Plus, Trash2, RefreshCw, Check, X } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getFinancial, getCommissionSummary, getExpenses, createExpense, deleteExpense, getMarketPriceConfig, getMarketPriceReviews, reviewMarketPrice, getFinanceAudit, updateMarketAgentRate, getAccountingLedger } from '../../../lib/api/admin';

function Card({ label, value, sub, color = 'green' }: any) {
  const colors: Record<string, string> = { green: 'bg-green-50 text-green-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700' };
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color === 'green' ? 'text-gray-900' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 font-semibold px-2 py-0.5 rounded-full inline-block ${colors[color]}`}>{sub}</p>}
    </div>
  );
}

export default function FinancialPage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [commissions, setCommissions] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', category: 'Office', description: '' });
  const [marketConfig, setMarketConfig] = useState<any>(null);
  const [priceReviews, setPriceReviews] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [agentRate, setAgentRate] = useState('');
  const [ledger, setLedger] = useState<any>(null);
  const CATEGORIES = ['Office', 'Fuel', 'Marketing', 'Software', 'Salaries', 'Equipment', 'Other'];

  const load = () => {
    getFinancial().then(setSnapshot).catch(() => {});
    getAccountingLedger(500).then(setLedger).catch(() => {});
    getCommissionSummary().then(setCommissions).catch(() => {});
    getExpenses().then(setExpenses).catch(() => {});
    Promise.all([getMarketPriceConfig(), getMarketPriceReviews(), getFinanceAudit(100)]).then(([cfg, reviews, logs]) => { setMarketConfig(cfg); setPriceReviews(reviews); setAudit(logs); setAgentRate(String(cfg.agentMarkupShare ?? 40)); }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleAddExpense = async () => {
    await createExpense({ ...form, amount: Number(form.amount) });
    setShowExpenseForm(false);
    setForm({ title: '', amount: '', category: 'Office', description: '' });
    load();
  };

  const handleDeleteExpense = async (id: string) => {
    await deleteExpense(id);
    load();
  };

  const fmt = (n: number) => `${n?.toLocaleString() ?? 0} RWF`;

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Financial Dashboard</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card label="Total Revenue (rides)" value={fmt(snapshot?.totalRevenue)} />
          <Card label="Total Commission Earned" value={fmt(snapshot?.totalCommission)} sub="Live ride commission policy" color="green" />
          <Card label="Total Expenses" value={fmt(snapshot?.totalExpenses)} color="red" />
          <Card label="Net Profit" value={fmt(snapshot?.netProfit)} color={snapshot?.netProfit >= 0 ? 'green' : 'red'} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card label="Marketplace Markup" value={`${marketConfig?.markupPercent ?? 20}%`} sub="Configured customer markup" />
          <Card label="Agent Markup Share" value={`${marketConfig?.agentMarkupShare ?? 40}%`} sub={`Zana ${marketConfig?.zanaMarkupShare ?? 60}%`} color="blue" />
          <Card label="Pending Price Reviews" value={String(priceReviews.length)} sub="Requires admin action" color={priceReviews.length ? "amber" : "green"} />
          <Card label="Finance Audit Events" value={String(audit.length)} sub="Latest 100 events" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900">Market pricing controls</h2>
            <p className="text-xs text-gray-500 mt-1">Pricing and markup split used by the marketplace.</p>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">Markup</span><p className="font-bold">{marketConfig?.markupPercent ?? 20}%</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">Auto-approve</span><p className="font-bold">{marketConfig?.autoApprovePercent ?? 15}%</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">Hard reject</span><p className="font-bold">{marketConfig?.hardRejectPercent ?? 100}%</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">Zana share</span><p className="font-bold">{marketConfig?.zanaMarkupShare ?? 60}%</p></div>
            </div>
            <div className="flex gap-2 mt-4">
              <input value={agentRate} onChange={e=>setAgentRate(e.target.value)} type="number" min="0" max="100" className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <button onClick={async()=>{const n=Number(agentRate);if(n>=0&&n<=100){await updateMarketAgentRate(n);load();}}} className="bg-zana-primary text-white font-semibold px-3 py-2 rounded-lg text-xs">Save agent share</button>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Pending market price reviews</h2><p className="text-xs text-gray-500 mt-1">Approve or reject agent price changes.</p></div>
            <div className="max-h-72 overflow-auto">
              {priceReviews.length===0 ? <p className="p-5 text-sm text-gray-400">No pending reviews.</p> : priceReviews.map(r=><div key={r.id} className="p-4 border-b border-gray-50 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{r.product?.name ?? 'Product'}</p><p className="text-xs text-gray-500">{r.oldPrice?.toLocaleString()} → {r.newPrice?.toLocaleString()} RWF</p></div><div className="flex gap-1"><button onClick={async()=>{await reviewMarketPrice(r.id,true);load();}} className="p-2 rounded-lg bg-green-50 text-green-700"><Check size={14}/></button><button onClick={async()=>{await reviewMarketPrice(r.id,false);load();}} className="p-2 rounded-lg bg-red-50 text-red-700"><X size={14}/></button></div></div>)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div><h2 className="font-black text-gray-900">Unified Accounting Ledger</h2><p className="text-xs text-gray-500 mt-1">One operational view across rides, deliveries, marketplace orders, commissions, wallets, debt and expenses — ready for the future AI accounting layer.</p></div>
            <button onClick={() => getAccountingLedger(500).then(setLedger)} className="text-xs font-bold px-3 py-2 border border-gray-200 rounded-lg flex items-center gap-1"><RefreshCw size={13}/> Refresh</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
            {[
              ['Total GMV', ledger?.totals?.gmv], ['Ride GMV', ledger?.totals?.rideGmv], ['Delivery GMV', ledger?.totals?.deliveryGmv],
              ['Marketplace', ledger?.totals?.marketplaceGmv], ['Commission', ledger?.totals?.commission], ['Driver debt', ledger?.totals?.outstandingDriverDebt],
            ].map(([label, value]) => <div key={label} className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] uppercase font-bold text-gray-400">{label}</p><p className="text-sm font-black text-gray-900 mt-1">{fmt(Number(value ?? 0))}</p></div>)}
          </div>
          <div className="max-h-80 overflow-auto border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50"><tr>{['Time','Type','Direction','Amount','Reference','Status','Account'].map(h=><th key={h} className="text-left px-3 py-2 font-bold text-gray-500">{h}</th>)}</tr></thead>
              <tbody>{(ledger?.rows ?? []).map((row:any)=><tr key={row.type+row.entityId+row.at} className="border-t border-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-gray-500">{new Date(row.at).toLocaleString()}</td><td className="px-3 py-2 font-bold">{row.type}</td><td className="px-3 py-2">{row.direction}</td><td className="px-3 py-2 font-black">{fmt(row.amount)}</td><td className="px-3 py-2 font-mono text-[10px]">{row.reference ?? '—'}</td><td className="px-3 py-2">{row.status}</td><td className="px-3 py-2">{row.account ?? '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <Card label="Monthly Salary Burden" value={fmt(snapshot?.monthlySalaryBurden)} sub="All active staff" color="amber" />
          <Card label="Ride Commissions" value={fmt(commissions?.rideCommission)} sub={`${commissions?.rideCount ?? 0} rides · policy-driven`} />
          <Card label="Delivery Commissions" value={fmt(commissions?.deliveryCommission)} sub={`${commissions?.deliveryCount ?? 0} deliveries`} />
        </div>

        {snapshot?.unpaidPayrolls?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-red-800">⚠ Unpaid payroll</p>
            {snapshot.unpaidPayrolls.map((p: any) => (
              <p key={p.id} className="text-xs text-red-700 mt-1">{p.staff?.name} — {p.month} — {fmt(p.amount)}</p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Expenses</h2>
          <button onClick={() => setShowExpenseForm(true)} className="flex items-center gap-1.5 bg-zana-primary text-white font-semibold px-3 py-1.5 rounded-lg text-xs"><Plus size={13} /> Add Expense</button>
        </div>

        {showExpenseForm && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Title" className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" />
              <input value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="Amount (RWF)" type="number" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Note (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddExpense} disabled={!form.title || !form.amount} className="bg-zana-primary text-white font-semibold px-4 py-1.5 rounded-lg text-sm disabled:opacity-40">Save</button>
              <button onClick={() => setShowExpenseForm(false)} className="border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Title','Category','Amount','Date',''].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">{e.title}{e.description && <span className="text-gray-400 text-xs"> — {e.description}</span>}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{e.category}</span></td>
                  <td className="px-4 py-3 font-medium">{e.amount?.toLocaleString()} RWF</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><button onClick={() => handleDeleteExpense(e.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button></td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No expenses recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
