'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, Store, Phone, Mail, MapPin, CalendarDays,
  TrendingUp, Printer, CheckCircle2, Clock3, PauseCircle, Package,
  ShoppingBag, MessageCircle, ClipboardList
} from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getMerchants, approveMerchant, suspendMerchant } from '../../../lib/api/admin';

type MerchantRow = {
  id: string;
  businessName: string;
  branch?: string | null;
  category: 'FOOD' | 'GIFTS' | 'GOODS' | string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | string;
  whatsappPhone?: string | null;
  businessAddress?: string | null;
  businessLat?: number | null;
  businessLng?: number | null;
  createdAt: string;
  user?: { firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null };
  products?: { id: string }[];
  _count?: { products?: number; orders?: number };
};
const statuses = ['PENDING', 'APPROVED', 'SUSPENDED'] as const;
type Status = typeof statuses[number];
const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  SUSPENDED: 'bg-rose-100 text-rose-800',
};
const categoryLabel: Record<string, string> = { FOOD: 'Food & drink', GOODS: 'Shop & goods', GIFTS: 'Gifts' };
const todayKigali = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const dayKey = (value: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(value);
const percentChange = (current: number, previous: number) =>
  previous === 0 ? (current > 0 ? '+100%' : '—') : `${current > previous ? '+' : ''}${Math.round((current - previous) / previous * 100)}%`;
const dateLabel = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-GB', {
    timeZone: 'Africa/Kigali', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

export default function MerchantRegistrationsPage() {
  const [allRows, setAllRows] = useState<MerchantRow[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await getMerchants();
      setAllRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load merchant registrations from the database.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(m => {
      if (filter && m.status !== filter) return false;
      if (!q) return true;
      const haystack = [
        m.businessName, m.branch, m.category, m.status, m.businessAddress,
        m.whatsappPhone, m.user?.firstName, m.user?.lastName, m.user?.phone, m.user?.email,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [allRows, filter, search]);

  const counts = useMemo(() => ({
    PENDING: allRows.filter(m => m.status === 'PENDING').length,
    APPROVED: allRows.filter(m => m.status === 'APPROVED').length,
    SUSPENDED: allRows.filter(m => m.status === 'SUSPENDED').length,
  }), [allRows]);
  const categories = useMemo(() => ({
    FOOD: allRows.filter(m => m.category === 'FOOD').length,
    GOODS: allRows.filter(m => m.category === 'GOODS').length,
    GIFTS: allRows.filter(m => m.category === 'GIFTS').length,
  }), [allRows]);
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    allRows.forEach(m => { const key = dayKey(new Date(m.createdAt)); map.set(key, (map.get(key) || 0) + 1); });
    const today = new Date(`${todayKigali()}T12:00:00`);
    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (29 - index));
      const day = dayKey(date);
      return { day, count: map.get(day) || 0 };
    });
  }, [allRows]);
  const todayCount = daily.find(d => d.day === todayKigali())?.count ?? 0;
  const last30 = daily.reduce((sum, d) => sum + d.count, 0);
  const week = useMemo(() => {
    const current = daily.slice(-7).reduce((s, d) => s + d.count, 0);
    const previous = daily.slice(-14, -7).reduce((s, d) => s + d.count, 0);
    return { current, previous, change: percentChange(current, previous) };
  }, [daily]);
  const maxDaily = Math.max(1, ...daily.map(d => d.count));

  const act = async (merchant: MerchantRow, action: 'approve' | 'suspend') => {
    setActing(merchant.id); setError(''); setNotice('');
    try {
      if (action === 'approve') await approveMerchant(merchant.id);
      else await suspendMerchant(merchant.id);
      setNotice(action === 'approve' ? `${merchant.businessName} approved.` : `${merchant.businessName} suspended.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not update merchant status.');
    } finally { setActing(null); }
  };

  return <AdminShell><div className="space-y-5 merchant-report">
    <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-zana-primary"><ClipboardList size={19}/><span className="text-xs font-bold uppercase tracking-wider">Merchant acquisition intelligence</span></div>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Merchant Registrations</h1>
        <p className="mt-1 text-sm text-gray-500">Track sign-ups, business categories, approval status and the details needed to bring each shop live.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><RefreshCw size={15}/> Refresh</button>
        <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00a082] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00896f]"><Printer size={15}/> Export PDF / Print</button>
      </div>
    </div>
    <div className="print-only mb-5"><div className="text-xs font-bold uppercase tracking-[.2em] text-gray-500">ZANA RIDE · OPERATIONS REPORT</div><h1 className="mt-2 text-3xl font-bold">Merchant Registration Analytics</h1><p className="mt-1 text-sm text-gray-600">Generated {dateLabel(new Date().toISOString())} · Rwanda time (CAT)</p></div>
    {error && <div role="alert" className="no-print rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {notice && <div role="status" className="no-print rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { key: '', label: 'Total businesses', value: allRows.length, sub: 'All merchant accounts', icon: Store, color: 'border-gray-200' },
        { key: 'PENDING', label: 'Pending review', value: counts.PENDING, sub: 'Need a decision', icon: Clock3, color: 'border-amber-200' },
        { key: 'APPROVED', label: 'Approved / live', value: counts.APPROVED, sub: 'Can operate on Zana', icon: CheckCircle2, color: 'border-emerald-200' },
        { key: 'SUSPENDED', label: 'Suspended', value: counts.SUSPENDED, sub: 'Not currently active', icon: PauseCircle, color: 'border-rose-200' },
      ].map(item => <button key={item.key} onClick={() => setFilter(filter === item.key ? '' : item.key)} className={`rounded-xl border p-4 text-left transition ${item.color} ${filter === item.key ? 'bg-emerald-50 ring-2 ring-[#00a082]' : 'bg-white'}`}>
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-gray-500">{item.label}</span><item.icon size={17} className="text-zana-primary"/></div>
        <div className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{item.value}</div><div className="mt-1 text-xs text-gray-400">{item.sub}</div>
      </button>)}
    </div>

    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-zana-primary"><Store size={18}/><h2 className="font-bold text-gray-900">Business category mix</h2></div><p className="mt-1 text-xs text-gray-500">What merchants selected when creating their account.</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{allRows.length} total</span></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{Object.entries(categories).map(([key, value]) => <div key={key} className="rounded-lg border border-gray-100 bg-gray-50 p-4"><div className="text-xs text-gray-500">{categoryLabel[key]}</div><div className="mt-1 text-2xl font-bold text-gray-900">{value}</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-[#00a082]" style={{ width: `${allRows.length ? value / allRows.length * 100 : 0}%` }}/></div><div className="mt-1 text-xs text-gray-400">{allRows.length ? Math.round(value / allRows.length * 100) : 0}% of registrations</div></div>)}</div>
    </section>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <section className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex items-center gap-2 text-zana-primary"><CalendarDays size={17}/><h2 className="font-bold text-gray-900">Registrations today</h2></div><div className="mt-3 text-3xl font-extrabold text-gray-900">{todayCount}</div><p className="mt-1 text-xs text-gray-500">Based on Rwanda local date.</p></section>
      <section className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex items-center gap-2 text-zana-primary"><ClipboardList size={17}/><h2 className="font-bold text-gray-900">Last 30 days</h2></div><div className="mt-3 text-3xl font-extrabold text-gray-900">{last30}</div><p className="mt-1 text-xs text-gray-500">Merchant accounts created during the displayed period.</p></section>
      <section className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex items-center gap-2 text-zana-primary"><TrendingUp size={17}/><h2 className="font-bold text-gray-900">7-day growth</h2></div><div className="mt-3 text-3xl font-extrabold text-gray-900">{week.change}</div><p className="mt-1 text-xs text-gray-500">{week.current} this week vs {week.previous} the previous 7 days.</p></section>
    </div>

    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-zana-primary"><TrendingUp size={17}/><h2 className="font-bold text-gray-900">Daily registrations · 30 days</h2></div>
      <div className="mt-5 space-y-3">{daily.map(d => <div key={d.day} className="grid grid-cols-[58px_1fr_34px] items-center gap-3"><span className="text-xs text-gray-500">{new Date(`${d.day}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Africa/Kigali' })}</span><div className="h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#00a082]" style={{ width: `${d.count ? Math.max(3, d.count / maxDaily * 100) : 0}%` }}/></div><span className="text-right text-sm font-bold tabular-nums text-gray-800">{d.count}</span></div>)}</div>
      <p className="mt-4 text-xs text-gray-400">Counts are calculated from merchant accounts returned by the database.</p>
    </section>

    <section className="no-print flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row">
      <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search business, owner, phone, email or location" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-zana-primary"/></div>
      <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">All statuses</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select>
    </section>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3"><span className="text-sm font-semibold text-gray-800">Merchant directory</span><span className="text-xs text-gray-500">{rows.length} shown · {allRows.length} total</span></div>
      {loading ? <div className="p-10 text-center text-sm text-gray-500">Loading merchant registrations…</div> : rows.length === 0 ? <div className="p-10 text-center"><Store className="mx-auto text-gray-300" size={30}/><p className="mt-3 font-semibold text-gray-700">No merchants found</p><p className="mt-1 text-sm text-gray-500">New registrations will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50 text-left">{['Business / owner','Contact','Category & branch','Location','Products / orders','Registered','Status & action'].map(h => <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead><tbody>{rows.map(m => <tr key={m.id} className="align-top border-b border-gray-50 hover:bg-gray-50/70">
        <td className="min-w-48 px-4 py-4"><div className="font-semibold text-gray-900">{m.businessName}</div><div className="mt-1 text-[11px] text-gray-400">ID {m.id.slice(0, 8)}</div><div className="mt-1 text-xs text-gray-500">{[m.user?.firstName, m.user?.lastName].filter(Boolean).join(' ') || 'Owner name not supplied'}</div></td>
        <td className="min-w-52 px-4 py-4">{m.user?.phone && <a href={`tel:${m.user.phone}`} className="flex items-center gap-1.5 text-gray-700 hover:text-zana-primary"><Phone size={13}/>{m.user.phone}</a>}{m.user?.email && <a href={`mailto:${m.user.email}`} className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 hover:text-zana-primary"><Mail size={12}/>{m.user.email}</a>}{m.whatsappPhone && <a href={`https://wa.me/${m.whatsappPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 hover:underline"><MessageCircle size={12}/>WhatsApp {m.whatsappPhone}</a>}</td>
        <td className="min-w-40 px-4 py-4"><div className="font-medium text-gray-800">{categoryLabel[m.category] || m.category}</div><div className="mt-1 text-xs text-gray-500">{m.branch || 'Branch not supplied'}</div></td>
        <td className="min-w-44 px-4 py-4"><div className="flex items-start gap-1.5 text-gray-700"><MapPin size={13} className="mt-0.5 shrink-0 text-gray-400"/><span>{m.businessAddress || (m.businessLat != null && m.businessLng != null ? `${m.businessLat}, ${m.businessLng}` : 'Location not supplied')}</span></div></td>
        <td className="whitespace-nowrap px-4 py-4"><div className="flex items-center gap-1.5 text-gray-700"><Package size={13} className="text-gray-400"/>{m._count?.products ?? m.products?.length ?? 0} products</div><div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><ShoppingBag size={12}/>{m._count?.orders ?? '—'} orders</div></td>
        <td className="whitespace-nowrap px-4 py-4 text-gray-500">{dateLabel(m.createdAt)}</td>
        <td className="min-w-36 px-4 py-4"><span className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${statusStyle[m.status] || 'bg-gray-100 text-gray-600'}`}>{m.status}</span><div className="no-print mt-2 flex flex-col gap-1.5">{m.status !== 'APPROVED' && <button onClick={() => act(m, 'approve')} disabled={acting === m.id} className="rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{acting === m.id ? 'Saving…' : m.status === 'SUSPENDED' ? 'Reinstate' : 'Approve'}</button>}{m.status === 'APPROVED' && <button onClick={() => act(m, 'suspend')} disabled={acting === m.id} className="rounded-md bg-amber-500 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{acting === m.id ? 'Saving…' : 'Suspend'}</button>}</div></td>
      </tr>)}</tbody></table></div>}
    </section>
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-zana-primary"><ClipboardList size={17}/><h2 className="font-bold text-gray-900">Merchant information captured today</h2></div>
      <p className="mt-1 text-xs text-gray-500">Based on the current database schema and public registration form.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
        ['Business identity', 'Business name, category, branch / outlet'],
        ['Primary contact', 'Owner / manager name, phone number and email'],
        ['Customer contact', 'WhatsApp number for order follow-up'],
        ['Store location', 'Business address and optional latitude / longitude'],
        ['Account review', 'Registration date and pending / approved / suspended status'],
        ['Store readiness', 'Products, order activity, logo / cover and preparation / delivery times'],
      ].map(([title, detail]) => <div key={title} className="rounded-lg border border-gray-100 bg-gray-50 p-3"><div className="text-sm font-semibold text-gray-800">{title}</div><p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p></div>)}</div>
      <p className="mt-3 text-xs text-gray-400">The current database does not contain a separate business registration number, tax ID, opening hours, or uploaded proof-of-business documents in the Merchant model. Add these fields only if they are needed for your approval and compliance workflow.</p>
    </section>
    <div className="print-only mt-5 text-xs text-gray-500">Confidential operational report · Merchant contact details are personal data. Handle and share securely.</div>
    <style jsx global>{`
      .print-only { display:none; }
      @media print {
        @page { size:A4 landscape; margin:12mm; }
        body { background:#fff !important; color:#111827 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        body * { visibility:hidden; }
        .merchant-report, .merchant-report * { visibility:visible; }
        .merchant-report { position:absolute; left:0; top:0; width:100%; padding:0 !important; margin:0 !important; }
        .no-print { display:none !important; }
        .print-only { display:block !important; }
        .merchant-report section, .merchant-report .bg-white { break-inside:avoid; box-shadow:none !important; }
        .merchant-report table { font-size:9px !important; }
        .merchant-report th, .merchant-report td { padding:5px !important; }
        .merchant-report a { color:#111827 !important; text-decoration:none !important; }
      }
    `}</style>
  </div></AdminShell>;
}
