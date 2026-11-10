'use client';

import { useEffect, useState } from 'react';
import { Download, HeartHandshake, RefreshCw, ShieldCheck, RotateCcw, Wallet, TrendingUp, CalendarDays } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getImpactFunds, updateImpactFundsRate, reverseImpactFundsEntry } from '../../../lib/api/admin';

type Entry = {
  id: string; sourceType: string; sourceId: string; eventType: string;
  grossAmount: number; platformCommission: number; contributionAmount: number;
  ratePercent: number; status: string; idempotencyKey: string; description?: string | null; createdAt: string;
};

const money = (n = 0) => `RWF ${Number(n).toLocaleString('en-US')}`;
const dateTime = (v: string) => new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function Metric({ label, value, hint, icon: Icon }: any) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{label}</p><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E3F5F1] text-[#00806A]"><Icon size={17}/></span></div>
    <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
    {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </div>;
}

export default function ImpactFundsPage() {
  const [data, setData] = useState<any>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [rate, setRate] = useState('3');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await getImpactFunds({ from: from || undefined, to: to || undefined, sourceType: sourceType || undefined });
      setData(result); setEntries(result.entries ?? []); setRate(String(result.ratePercent ?? 3));
    } catch (e: any) { setError(e?.message || 'Unable to load the Impact Funds ledger.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const saveRate = async () => {
    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0 || value > 100) { setError('Enter a rate between 0 and 100.'); return; }
    if (!window.confirm(`Confirm changing the Zana Impact Funds contribution rate to ${value}%? This applies to future eligible commissions only.`)) return;
    setSaving(true); setError('');
    try { await updateImpactFundsRate(value, true); await load(); }
    catch (e: any) { setError(e?.message || 'Could not update the contribution rate.'); }
    finally { setSaving(false); }
  };

  const reverse = async (entry: Entry) => {
    const reason = window.prompt('Enter the reason for reversing this Impact Funds accrual:');
    if (!reason || reason.trim().length < 5) return;
    if (!window.confirm(`Reverse ${money(entry.contributionAmount)} from source transaction ${entry.sourceId}?`)) return;
    try { await reverseImpactFundsEntry(entry.id, reason.trim()); await load(); }
    catch (e: any) { setError(e?.message || 'Could not reverse this entry.'); }
  };

  const exportCsv = () => {
    const headers = ['Source transaction ID','Service type','Event','Gross transaction RWF','Zana commission RWF','Impact contribution RWF','Rate %','Status','Timestamp','Description'];
    const rows = entries.map(e => [e.sourceId,e.sourceType,e.eventType,e.grossAmount,e.platformCommission,e.contributionAmount,e.ratePercent,e.status,e.createdAt,e.description ?? '']);
    const csv = [headers,...rows].map(row => row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'zana-impact-funds-ledger.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const reversed = new Set(entries.filter(e => e.eventType === 'REVERSAL').map(e => e.idempotencyKey.replace('REVERSAL:', '')));
  const monthly = data?.monthly ?? [];

  return <AdminShell>
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#00806A]"><HeartHandshake size={14}/> Social impact accounting</div><h2 className="text-3xl font-bold tracking-tight text-slate-950">Zana Impact Funds</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">A transparent, separate ledger allocating a share of Zana's earned platform commission to social impact.</p></div>
        <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh</button>
      </div>

      <div className="rounded-2xl border border-[#B8E7DD] bg-[#F1FBF8] p-4 text-sm text-[#175D50]"><strong>Contribution rule:</strong> Impact Funds = eligible, recognized Zana platform commission × configured rate. It is not calculated from customer gross payments, driver earnings, merchant proceeds or pass-through amounts.</div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Available accrued balance" value={money(data?.currentBalance)} hint="Net of recorded reversals" icon={Wallet}/>
        <Metric label="Lifetime contributions" value={money(data?.lifetimeContributions)} hint="Gross accrued contributions" icon={TrendingUp}/>
        <Metric label="This month's contributions" value={money(data?.thisMonthContributions)} hint={`${data?.thisMonthTransactions ?? 0} eligible transactions this month`} icon={CalendarDays}/>
        <Metric label="Current contribution rate" value={`${data?.ratePercent ?? 3}%`} hint={`${data?.lifetimeTransactions ?? 0} recorded accruals`} icon={HeartHandshake}/>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-bold text-slate-900">Commission reconciliation</h3><p className="mt-1 text-xs text-slate-500">Compares the Impact Funds ledger with Zana's ride, delivery, merchant-order and market-shopping commission sources since ledger activation.</p></div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-bold ${data?.reconciliation?.status === 'RECONCILED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{data?.reconciliation?.status === 'RECONCILED' ? 'Reconciled' : 'Review required'}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold text-slate-500">Source commission</p><p className="mt-1 text-lg font-bold text-slate-900">{money(data?.reconciliation?.sourceCommissionTotal)}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold text-slate-500">Ledger commission</p><p className="mt-1 text-lg font-bold text-slate-900">{money(data?.reconciliation?.ledgerCommissionTotal)}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold text-slate-500">Difference</p><p className={`mt-1 text-lg font-bold ${data?.reconciliation?.difference === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{money(data?.reconciliation?.difference)}</p></div>
        </div>
        <p className="mt-3 text-[10px] text-slate-400">Reconciliation period starts {data?.reconciliation?.since ? dateTime(data.reconciliation.since) : 'when the ledger is activated'}.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#00806A]"/><h3 className="font-bold text-slate-900">Contribution rate control</h3></div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">Only administrators can change this rate. Every change is recorded in the audit log. Existing ledger entries retain the rate applied when they were created.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block w-full max-w-xs"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Contribution rate (%)</span><input type="number" min="0" max="100" step="0.1" value={rate} onChange={e=>setRate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#00A082]"/></label>
          <button onClick={saveRate} disabled={saving} className="rounded-xl bg-[#008F77] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save rate'}</button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-bold text-slate-900">Monthly contribution report</h3><p className="mt-1 text-xs text-slate-500">Monthly totals use the Africa/Kigali calendar.</p></div></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-xs"><thead><tr className="border-b border-slate-100 text-slate-400"><th className="py-3 pr-4 font-semibold">Month</th><th className="py-3 pr-4 font-semibold">Eligible transactions</th><th className="py-3 text-right font-semibold">Contributions</th></tr></thead><tbody>{monthly.length ? monthly.map((m:any)=><tr key={m.month} className="border-b border-slate-50"><td className="py-3 pr-4 font-semibold text-slate-800">{m.month}</td><td className="py-3 pr-4 text-slate-600">{m.transactions}</td><td className="py-3 text-right font-bold tabular-nums text-slate-900">{money(m.contributions)}</td></tr>) : <tr><td colSpan={3} className="py-8 text-center text-slate-400">No contributions recorded yet.</td></tr>}</tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-end">
          <div><h3 className="font-bold text-slate-900">Transaction-by-transaction ledger</h3><p className="mt-1 text-xs text-slate-500">Accruals and reversals are recorded as separate, traceable entries.</p></div>
          <button onClick={exportCsv} disabled={!entries.length} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><Download size={14}/> Export CSV</button>
        </div>
        <div className="grid gap-2 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-[10px] font-semibold text-slate-500">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"/></label>
          <label className="text-[10px] font-semibold text-slate-500">To<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"/></label>
          <label className="text-[10px] font-semibold text-slate-500">Service type<select value={sourceType} onChange={e=>setSourceType(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"><option value="">All services</option><option value="RIDE">Rides</option><option value="DELIVERY">Deliveries</option><option value="FOOD_ORDER">Food orders</option><option value="SHOPPING_ORDER">Shopping / errands</option></select></label>
          <button onClick={load} className="self-end rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-bold text-white">Apply filters</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="bg-white text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Source transaction</th><th className="px-4 py-3">Service</th><th className="px-4 py-3 text-right">Gross value</th><th className="px-4 py-3 text-right">Zana commission</th><th className="px-4 py-3 text-right">Impact allocation</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Recorded</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody>{entries.map(e=><tr key={e.id} className="border-t border-slate-100 align-top"><td className="px-4 py-3 font-mono text-[10px] text-slate-600">{e.sourceId}</td><td className="px-4 py-3 font-semibold text-slate-700">{e.sourceType.replace('_',' ')}</td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{money(e.grossAmount)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{money(e.platformCommission)}</td><td className={`px-4 py-3 text-right font-bold tabular-nums ${e.contributionAmount < 0 ? 'text-rose-700' : 'text-[#00806A]'}`}>{money(e.contributionAmount)}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{e.status}</span></td><td className="px-4 py-3 whitespace-nowrap text-slate-500">{dateTime(e.createdAt)}</td><td className="px-4 py-3">{e.eventType === 'ACCRUAL' && !reversed.has(e.id) ? <button onClick={()=>reverse(e)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50"><RotateCcw size={12}/> Reverse</button> : <span className="text-[10px] text-slate-400">—</span>}</td></tr>)}
            {!entries.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">{loading ? 'Loading ledger…' : 'No matching ledger entries.'}</td></tr>}</tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">Showing up to 2,000 matching entries. Financial accruals are not donation payouts.</div>
      </section>

      <p className="text-[11px] leading-relaxed text-slate-500">Funds are accrued from Zana's earned platform commission and remain subject to the Impact Fund's formal governance, safeguarding, and disbursement process. This dashboard does not initiate bank or mobile-money payouts.</p>
    </div>
  </AdminShell>;
}
