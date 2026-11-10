'use client';

import { useEffect, useState } from 'react';
import { Download, HeartHandshake, RefreshCw, RotateCcw, Wallet, TrendingUp, CalendarDays } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api/client';
import { getImpactFunds, reverseImpactFundsEntry, getMonthlyProfitability, closeMonthlyProfit, getImpactFundDisbursements, requestImpactFundDisbursement, approveImpactFundDisbursement, rejectImpactFundDisbursement, markImpactFundDisbursementPaid } from '../../../lib/api/admin';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profitMonth, setProfitMonth] = useState(new Date().toISOString().slice(0, 7));
  const [profit, setProfit] = useState<any>(null);
  const [profitLoading, setProfitLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [disbursementBalance, setDisbursementBalance] = useState<any>(null);
  const [requestForm, setRequestForm] = useState({ amount: '', recipientName: '', recipientType: 'PROGRAM', purpose: '' });
  const [requesting, setRequesting] = useState(false);
  const [canApproveDisbursements, setCanApproveDisbursements] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await getImpactFunds({ from: from || undefined, to: to || undefined, sourceType: sourceType || undefined });
      setData(result); setEntries(result.entries ?? []);
      const payoutData = await getImpactFundDisbursements();
      setDisbursements(payoutData.rows ?? []); setDisbursementBalance(payoutData.balance ?? null);
    } catch (e: any) { setError(e?.message || 'Unable to load the Impact Funds ledger.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); api.get<any>('/admin/me').then(me => setCanApproveDisbursements(me?.role === 'ADMIN')).catch(() => setCanApproveDisbursements(false)); }, []);

  const loadProfit = async () => { setProfitLoading(true); setError(''); try { setProfit(await getMonthlyProfitability(profitMonth)); } catch (e: any) { setError(e?.message || 'Unable to calculate monthly profit.'); } finally { setProfitLoading(false); } };
  useEffect(() => { loadProfit(); }, [profitMonth]);

  const closeProfit = async () => { if (!profit || profit.alreadyClosed || !window.confirm(`Close ${profitMonth}? This will permanently record 3% of positive net profit as a ZIF accrual. Check all expenses and payroll first.`)) return; setClosing(true); setError(''); try { await closeMonthlyProfit(profitMonth); await loadProfit(); await load(); } catch (e: any) { setError(e?.message || 'Could not close this month.'); } finally { setClosing(false); } };


  const reverse = async (entry: Entry) => {
    const reason = window.prompt('Enter the reason for reversing this Impact Funds accrual:');
    if (!reason || reason.trim().length < 5) return;
    if (!window.confirm(`Reverse ${money(entry.contributionAmount)} from source transaction ${entry.sourceId}?`)) return;
    try { await reverseImpactFundsEntry(entry.id, reason.trim()); await load(); }
    catch (e: any) { setError(e?.message || 'Could not reverse this entry.'); }
  };

  const submitDisbursement = async () => {
    const amount = Number(requestForm.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !requestForm.recipientName.trim() || requestForm.purpose.trim().length < 10) { setError('Enter a valid whole-RWF amount, recipient and purpose of at least 10 characters.'); return; }
    if (!window.confirm(`Request ${money(amount)} for ${requestForm.recipientName.trim()}? This will reserve the amount until approved or rejected.`)) return;
    setRequesting(true); setError('');
    try { await requestImpactFundDisbursement({ ...requestForm, amount, recipientName: requestForm.recipientName.trim(), purpose: requestForm.purpose.trim() }); setRequestForm({ amount: '', recipientName: '', recipientType: 'PROGRAM', purpose: '' }); await load(); }
    catch (e:any) { setError(e?.message || 'Could not submit disbursement request.'); } finally { setRequesting(false); }
  };
  const approveDisbursement = async (row:any) => { if (!window.confirm(`Approve ${money(row.amount)} for ${row.recipientName}? You cannot approve your own request.`)) return; try { await approveImpactFundDisbursement(row.id); await load(); } catch(e:any) { setError(e?.message || 'Could not approve request.'); } };
  const rejectDisbursement = async (row:any) => { const reason=window.prompt('Reason for rejecting this request (minimum 5 characters):'); if (!reason || reason.trim().length<5) return; try { await rejectImpactFundDisbursement(row.id,reason.trim()); await load(); } catch(e:any) { setError(e?.message || 'Could not reject request.'); } };
  const payDisbursement = async (row:any) => { const paymentReference=window.prompt('Bank/mobile-money transaction reference:'); if (!paymentReference || paymentReference.trim().length<4) return; const paymentMethod=(window.prompt('Payment method: BANK_TRANSFER, MOBILE_MONEY, CASH, CHEQUE or OTHER','MOBILE_MONEY')||'').toUpperCase(); const evidenceUrl=window.prompt('HTTPS receipt/evidence URL (optional):')||undefined; if (!window.confirm(`Confirm that ${money(row.amount)} has actually been paid to ${row.recipientName}?`)) return; try { await markImpactFundDisbursementPaid(row.id,{paymentMethod,paymentReference:paymentReference.trim(),evidenceUrl}); await load(); } catch(e:any) { setError(e?.message || 'Could not record payout.'); } };

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

      <div className="rounded-2xl border border-[#B8E7DD] bg-[#F1FBF8] p-4 text-sm text-[#175D50]"><strong>Contribution rule:</strong> From the new monthly close process, ZIF receives 3% of positive Zana net profit after recorded operating expenses and base payroll accrual. Historic transaction-level commission allocations remain visible as legacy entries; new ride and order transactions no longer accrue ZIF individually.</div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <section className="rounded-2xl border border-[#B8E7DD] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h3 className="font-bold text-slate-900">Monthly profit & ZIF close</h3><p className="mt-1 text-xs text-slate-500">Review Zana earnings, operating expenses and base payroll before recording the 3% allocation.</p></div><label className="text-xs font-semibold text-slate-600">Financial month<input type="month" value={profitMonth} onChange={e=>setProfitMonth(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label></div>
        {profit && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-500">Recognized platform earnings</p><p className="mt-1 text-lg font-bold">{money(profit.platformEarnings)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-500">Operating expenses</p><p className="mt-1 text-lg font-bold">{money(profit.operatingExpenses)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-500">Base payroll accrual</p><p className="mt-1 text-lg font-bold">{money(profit.payrollAccrual)}</p></div><div className="rounded-xl bg-[#F1FBF8] p-3"><p className="text-[10px] text-[#175D50]">Net profit estimate</p><p className={`mt-1 text-lg font-bold ${profit.netProfit>=0?'text-[#00806A]':'text-rose-700'}`}>{money(profit.netProfit)}</p></div></div>}
        {profit && <div className="mt-3 flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center"><div><p className="text-xs text-slate-500">ZIF allocation at {profit.impactFundRatePercent}%</p><p className="text-xl font-bold text-[#00806A]">{money(profit.impactFundContribution)}</p><p className="mt-1 text-[10px] text-slate-400">{profit.alreadyClosed ? `Period already closed · ${profit.closedEntryId}` : 'Preview only · not yet accrued'}</p></div>{canApproveDisbursements&&<button onClick={closeProfit} disabled={closing||profit.alreadyClosed||profitLoading||!profit.canClose} className="rounded-xl bg-[#008F77] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{profit.alreadyClosed?'Month closed':closing?'Closing…':!profit.canClose?'Payroll reconciliation required':'Confirm monthly close'}</button>}</div>}
        {profit?.warnings?.map((w:string,i:number)=><p key={i} className="mt-2 text-[10px] leading-relaxed text-amber-700">• {w}</p>)}
        {profitLoading&&<p className="mt-3 text-xs text-slate-400">Calculating monthly totals…</p>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Accrued ZIF balance" value={money(data?.currentBalance)} hint="Ledger amount; not a cash payout balance" icon={Wallet}/>
        <Metric label="Lifetime contributions" value={money(data?.lifetimeContributions)} hint="Gross accrued contributions" icon={TrendingUp}/>
        <Metric label="This month's contributions" value={money(data?.thisMonthContributions)} hint={`${data?.thisMonthTransactions ?? 0} eligible transactions this month`} icon={CalendarDays}/>
        <Metric label="Monthly profit allocation" value="3%" hint="Of positive monthly net profit" icon={HeartHandshake}/>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-bold text-slate-900">Disbursements & payout controls</h3><p className="mt-1 text-xs text-slate-500">Requests reserve available ZIF funds. Approval and payment confirmation are separate, audited steps.</p></div><div className="text-right"><p className="text-[10px] text-slate-500">Available after reserved requests and paid payouts</p><p className="text-xl font-bold text-[#00806A]">{money(disbursementBalance?.available ?? 0)}</p><p className="text-[10px] text-slate-400">Reserved: {money(disbursementBalance?.reserved ?? 0)}</p></div></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><input type="number" min="1" step="1" placeholder="Amount (RWF)" value={requestForm.amount} onChange={e=>setRequestForm(f=>({...f,amount:e.target.value}))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/><input placeholder="Recipient / organisation" value={requestForm.recipientName} onChange={e=>setRequestForm(f=>({...f,recipientName:e.target.value}))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/><select value={requestForm.recipientType} onChange={e=>setRequestForm(f=>({...f,recipientType:e.target.value}))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option value="PROGRAM">Program</option><option value="SCHOOL">School</option><option value="HEALTHCARE">Healthcare</option><option value="COMMUNITY">Community</option><option value="SUPPLIER">Supplier</option><option value="OTHER">Other</option></select><button onClick={submitDisbursement} disabled={requesting} className="rounded-lg bg-[#008F77] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{requesting?'Submitting…':'Request disbursement'}</button></div>
        <textarea placeholder="Purpose, beneficiaries and intended use (minimum 10 characters)" value={requestForm.purpose} onChange={e=>setRequestForm(f=>({...f,purpose:e.target.value}))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" rows={2}/>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[950px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['Requested','Recipient','Purpose','Amount','Status','Payment evidence','Actions'].map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{disbursements.map(row=><tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-3 whitespace-nowrap">{dateTime(row.requestedAt)}</td><td className="px-3 py-3"><strong>{row.recipientName}</strong><p className="text-[10px] text-slate-400">{row.recipientType}</p></td><td className="px-3 py-3 max-w-xs whitespace-normal">{row.purpose}</td><td className="px-3 py-3 font-bold">{money(row.amount)}</td><td className="px-3 py-3">{row.status}</td><td className="px-3 py-3">{row.paymentReference ? <span>{row.paymentMethod} · {row.paymentReference}{row.evidenceUrl&&<><br/><a className="text-[#00806A] underline" href={row.evidenceUrl} target="_blank" rel="noreferrer">Receipt</a></>}</span>:'—'}</td><td className="px-3 py-3"><div className="flex gap-1">{canApproveDisbursements&&row.status==='REQUESTED'&&<><button onClick={()=>approveDisbursement(row)} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white">Approve</button><button onClick={()=>rejectDisbursement(row)} className="rounded-lg border border-rose-200 px-2 py-1.5 text-[10px] font-bold text-rose-700">Reject</button></>}{canApproveDisbursements&&row.status==='APPROVED'&&<button onClick={()=>payDisbursement(row)} className="rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] font-bold text-white">Record payout</button>}</div></td></tr>)}{!disbursements.length&&<tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No disbursement requests recorded.</td></tr>}</tbody></table></div>
      </section>

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
        <p className="mt-3 text-[10px] text-slate-400">Legacy commission reconciliation covers {data?.reconciliation?.since ? dateTime(data.reconciliation.since) : 'ledger activation'} through {data?.reconciliation?.legacyCommissionLedgerThrough ? dateTime(data.reconciliation.legacyCommissionLedgerThrough) : 'the profit-based policy cutover'}. New ZIF allocations are posted at monthly close.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-bold text-slate-900">Monthly contribution report</h3><p className="mt-1 text-xs text-slate-500">Monthly totals use the Africa/Kigali calendar.</p></div></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-xs"><thead><tr className="border-b border-slate-100 text-slate-400"><th className="py-3 pr-4 font-semibold">Month</th><th className="py-3 pr-4 font-semibold">Accrual entries</th><th className="py-3 text-right font-semibold">Contributions</th></tr></thead><tbody>{monthly.length ? monthly.map((m:any)=><tr key={m.month} className="border-b border-slate-50"><td className="py-3 pr-4 font-semibold text-slate-800">{m.month}</td><td className="py-3 pr-4 text-slate-600">{m.transactions}</td><td className="py-3 text-right font-bold tabular-nums text-slate-900">{money(m.contributions)}</td></tr>) : <tr><td colSpan={3} className="py-8 text-center text-slate-400">No contributions recorded yet.</td></tr>}</tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-end">
          <div><h3 className="font-bold text-slate-900">Transaction-by-transaction ledger</h3><p className="mt-1 text-xs text-slate-500">Accruals and reversals are recorded as separate, traceable entries.</p></div>
          <button onClick={exportCsv} disabled={!entries.length} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><Download size={14}/> Export CSV</button>
        </div>
        <div className="grid gap-2 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-[10px] font-semibold text-slate-500">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"/></label>
          <label className="text-[10px] font-semibold text-slate-500">To<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"/></label>
          <label className="text-[10px] font-semibold text-slate-500">Service type<select value={sourceType} onChange={e=>setSourceType(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"><option value="">All services</option><option value="RIDE">Rides</option><option value="DELIVERY">Deliveries</option><option value="FOOD_ORDER">Food orders</option><option value="SHOPPING_ORDER">Shopping / errands</option><option value="NET_PROFIT">Monthly net profit</option></select></label>
          <button onClick={load} className="self-end rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-bold text-white">Apply filters</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="bg-white text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Source transaction</th><th className="px-4 py-3">Service</th><th className="px-4 py-3 text-right">Gross value</th><th className="px-4 py-3 text-right">Commission / net profit</th><th className="px-4 py-3 text-right">Impact allocation</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Recorded</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody>{entries.map(e=><tr key={e.id} className="border-t border-slate-100 align-top"><td className="px-4 py-3 font-mono text-[10px] text-slate-600">{e.sourceId}</td><td className="px-4 py-3 font-semibold text-slate-700">{e.sourceType.replace('_',' ')}</td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{money(e.grossAmount)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-600">{money(e.platformCommission)}{e.sourceType==='NET_PROFIT'&&<span className="ml-1 text-[9px] text-slate-400">net profit</span>}</td><td className={`px-4 py-3 text-right font-bold tabular-nums ${e.contributionAmount < 0 ? 'text-rose-700' : 'text-[#00806A]'}`}>{money(e.contributionAmount)}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{e.status}</span></td><td className="px-4 py-3 whitespace-nowrap text-slate-500">{dateTime(e.createdAt)}</td><td className="px-4 py-3">{canApproveDisbursements && e.eventType === 'ACCRUAL' && !reversed.has(e.id) ? <button onClick={()=>reverse(e)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50"><RotateCcw size={12}/> Reverse</button> : <span className="text-[10px] text-slate-400">—</span>}</td></tr>)}
            {!entries.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">{loading ? 'Loading ledger…' : 'No matching ledger entries.'}</td></tr>}</tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">Showing up to 2,000 matching entries. Financial accruals are not donation payouts.</div>
      </section>

      <p className="text-[11px] leading-relaxed text-slate-500">Funds are accrued from Zana's earned platform commission and remain subject to the Impact Fund's formal governance, safeguarding, and disbursement process. This dashboard does not initiate bank or mobile-money payouts.</p>
    </div>
  </AdminShell>;
}