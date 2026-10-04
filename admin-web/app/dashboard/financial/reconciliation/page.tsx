'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getFinancialReconciliation } from '../../../lib/api/admin';

const fmt = (n: any) => `${Number(n ?? 0).toLocaleString()} RWF`;

export default function FinancialReconciliationPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { setData(await getFinancialReconciliation()); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  if (loading && !data) return <AdminShell><div className="p-6 text-sm text-gray-500">Reconciling wallets, payments, commissions and settlements…</div></AdminShell>;
  const walletIssues = (data?.wallet?.negative?.length ?? 0) + (data?.wallet?.balanceMismatches?.length ?? 0) + (data?.wallet?.pendingOver24h?.length ?? 0);
  const orderIssues = data?.orders?.paidWithoutSettlement?.length ?? 0;
  const totalMismatches = data?.orders?.totalMismatches?.length ?? 0;
  const attention = walletIssues + orderIssues + totalMismatches;
  return <AdminShell><div className="space-y-6">
    <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Financial Reconciliation</h1><p className="text-sm text-gray-500 mt-1">Read-only control view linking wallets, paid orders, commissions, driver debt and marketplace settlements.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> Refresh</button></div>
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{[['Commission',data?.totals?.commissionAmount],['Commission debt',data?.totals?.commissionDebtAmount],['Debt settled',data?.totals?.debtSettledAmount],['Merchant net',data?.totals?.merchantNet],['Agent earnings',data?.totals?.agentEarnings],['Zana marketplace',data?.totals?.zanaMarketplaceEarnings]].map(([label,value])=><div key={label as string} className="bg-white rounded-xl border p-4"><div className="text-[10px] uppercase font-bold text-gray-400">{label}</div><div className="text-lg font-black mt-1">{fmt(value)}</div></div>)}</div>
    <div className="rounded-xl border bg-white p-5"><div className="flex items-center gap-2 mb-4">{attention ? <AlertTriangle className="text-red-600" size={20}/> : <CheckCircle2 className="text-green-600" size={20}/>}<h2 className="font-semibold">{attention ? 'Reconciliation attention required' : 'No reconciliation exceptions detected'}</h2></div><div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">Negative wallets</div><div className="font-bold mt-1">{data?.wallet?.negative?.length ?? 0}</div></div>
      <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">Wallet balance mismatches</div><div className="font-bold mt-1">{data?.wallet?.balanceMismatches?.length ?? 0}</div></div>
      <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">Pending wallet tx &gt;24h</div><div className="font-bold mt-1">{data?.wallet?.pendingOver24h?.length ?? 0}</div></div>
      <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">Paid orders missing settlement</div><div className="font-bold mt-1">{orderIssues}</div></div>
      <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">Actual total mismatches</div><div className="font-bold mt-1">{totalMismatches}</div></div>
    </div></div>
    <section className="rounded-xl border bg-white overflow-hidden"><div className="p-5 border-b"><h2 className="font-semibold">Paid orders without settlement</h2><p className="text-xs text-gray-500 mt-1">These are intentionally read-only. Resolve through the underlying payment/order workflow, not by deleting accounting records.</p></div><div className="overflow-auto"><table className="w-full text-xs"><thead className="bg-gray-50"><tr>{['Order','Status','Amount','Payment','Provider ref','Created'].map(h=><th key={h} className="text-left px-4 py-3 font-bold text-gray-500">{h}</th>)}</tr></thead><tbody>{(data?.orders?.paidWithoutSettlement ?? []).map((o:any)=><tr key={o.id} className="border-t"><td className="px-4 py-3 font-mono">{o.id.slice(0,8)}…</td><td className="px-4 py-3">{o.status}</td><td className="px-4 py-3 font-bold">{fmt(o.total)}</td><td className="px-4 py-3">{o.paymentMethod ?? '—'}</td><td className="px-4 py-3 font-mono">{o.momoRef ?? '—'}</td><td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleString()}</td></tr>)}{!orderIssues && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">None detected.</td></tr>}</tbody></table></div></section>
    <section className="grid lg:grid-cols-2 gap-4"><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold mb-3">Wallet exceptions</h2><div className="space-y-2 text-xs">{(data?.wallet?.negative ?? []).map((x:any)=><div key={x.id} className="p-3 rounded-lg bg-red-50 text-red-800">Negative wallet: {x.id.slice(0,8)}… — {fmt(x.balance)}</div>)}{(data?.wallet?.balanceMismatches ?? []).map((x:any)=><div key={x.walletId} className="p-3 rounded-lg bg-amber-50 text-amber-800">Balance mismatch: wallet {x.walletId.slice(0,8)}… — wallet {fmt(x.walletBalance)}, latest transaction {x.latestTransactionBalance == null ? 'none' : fmt(x.latestTransactionBalance)}</div>)}{(data?.wallet?.pendingOver24h ?? []).map((x:any)=><div key={x.id} className="p-3 rounded-lg bg-amber-50 text-amber-800">Pending &gt;24h: {fmt(x.amount)} — {x.providerRef ?? x.reference ?? x.id.slice(0,8)}</div>)}{!walletIssues && <div className="text-gray-400">No wallet exceptions detected.</div>}</div></div>
      <div className="rounded-xl border bg-white p-5"><h2 className="font-semibold mb-3">Settlement totals</h2><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Merchant settlements</span><b>{data?.merchantSettlements?.length ?? 0}</b></div><div className="flex justify-between"><span>Agent settlements</span><b>{data?.agentSettlements?.length ?? 0}</b></div><div className="flex justify-between"><span>Debt settlements</span><b>{data?.debtSettlements?.length ?? 0}</b></div><div className="flex justify-between border-t pt-2"><span>Commission records</span><b>{data?.commissions?._count?._all ?? 0}</b></div><div className="flex justify-between"><span>Commission debt records</span><b>{data?.commissionDebts?._count?._all ?? 0}</b></div></div></div></section>
    <div className="text-xs text-gray-400">Generated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}</div>
  </div></AdminShell>;
}
