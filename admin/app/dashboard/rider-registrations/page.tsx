'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, ClipboardList, Phone, Mail, MapPin, Bike, CalendarDays, TrendingUp, Printer, CarFront, Footprints, FileText } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getRiderRegistrations, getRiderRegistrationDailyStats, updateRiderRegistrationStatus } from '../../../lib/api/admin';

const statuses = ['NEW', 'CONTACTED', 'APPROVED', 'REJECTED'] as const;
type Status = typeof statuses[number];
type Registration = { id: string; fullName: string; phone: string; email: string | null; vehicleType: string; powerType: string; location: string; status: Status; createdAt: string };
type DailyStat = { day: string; count: number };
const badge: Record<string, string> = { NEW: 'bg-blue-100 text-blue-700', CONTACTED: 'bg-amber-100 text-amber-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700' };
const todayKigali = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const vehicleGroup = (value: string) => {
  const v = (value || '').toLowerCase();
  if (v.includes('car') || v.includes('auto') || v.includes('taxi')) return 'Cars';
  if (v.includes('bike') || v.includes('moto') || v.includes('motorcycle')) return 'Bikes';
  if (v.includes('bicycle') || v.includes('cycle')) return 'Bicycles';
  if (v.includes('truck') || v.includes('van') || v.includes('pickup')) return 'Utility vehicles';
  return 'Other';
};
const percentChange = (current: number, previous: number) => previous === 0 ? (current > 0 ? '+100%' : '—') : `${current - previous > 0 ? '+' : ''}${Math.round((current - previous) / previous * 100)}%`;

export default function RiderRegistrationsPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [allRows, setAllRows] = useState<Registration[]>([]);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [filtered, all, stats] = await Promise.all([
        getRiderRegistrations({ status: filter || undefined, search: search.trim() || undefined }),
        getRiderRegistrations({}),
        getRiderRegistrationDailyStats()
      ]);
      setRows(filtered); setAllRows(all); setDaily(stats);
    } catch (e: any) { setError(e?.message || 'Could not load rider registrations.'); }
    finally { setLoading(false); }
  }, [filter, search]);
  useEffect(() => { load(); }, [load]);
  const changeStatus = async (id: string, status: Status) => {
    setSaving(id); setError('');
    try { await updateRiderRegistrationStatus(id, status); await load(); }
    catch (e: any) { setError(e?.message || 'Could not update application status.'); }
    finally { setSaving(null); }
  };
  const counts = useMemo(() => statuses.reduce((a, s) => ({ ...a, [s]: allRows.filter(r => r.status === s).length }), {} as Record<Status, number>), [allRows]);
  const vehicles = useMemo(() => {
    const base = { Cars: 0, Bikes: 0, Bicycles: 0, 'Utility vehicles': 0, Other: 0 };
    allRows.forEach(r => { base[vehicleGroup(r.vehicleType) as keyof typeof base]++; });
    return base;
  }, [allRows]);
  const total = allRows.length;
  const recentDays = useMemo(() => {
    const byDay = new Map(daily.map(d => [d.day, d.count]));
    const end = new Date(`${todayKigali()}T12:00:00`);
    const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    let current = 0, previous = 0;
    for (let i = 0; i < 14; i++) { const d = new Date(end); d.setDate(d.getDate() - i); const n = byDay.get(dayKey(d)) || 0; if (i < 7) current += n; else previous += n; }
    return { current, previous, change: percentChange(current, previous) };
  }, [daily]);
  const todayCount = daily.find(d => d.day === todayKigali())?.count ?? 0;
  const last30 = daily.reduce((sum, d) => sum + d.count, 0);
  const dateLabel = (date: string) => { const parsed = new Date(date); return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString('en-GB', { timeZone: 'Africa/Kigali', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const exportPdf = () => window.print();
  return <AdminShell><div className="space-y-5 rider-report">
    <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><div className="flex items-center gap-2 text-zana-primary"><ClipboardList size={19}/><span className="text-xs font-bold uppercase tracking-wider">Recruitment intelligence</span></div><h1 className="text-2xl font-bold text-gray-900 mt-1">Rider & Vehicle Registrations</h1><p className="text-sm text-gray-500 mt-1">A live view of applicants, vehicle demand, conversion and recruitment growth.</p></div><div className="flex gap-2"><button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><RefreshCw size={15}/> Refresh</button><button onClick={exportPdf} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00a082] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00896f]"><Printer size={15}/> Export PDF / Print</button></div></div>
    <div className="print-only mb-5"><div className="text-xs font-bold uppercase tracking-[.2em] text-gray-500">ZANA RIDE · OPERATIONS REPORT</div><h1 className="text-3xl font-bold mt-2">Rider Registration Analytics</h1><p className="text-sm text-gray-600 mt-1">Generated {dateLabel(new Date().toISOString())} · Rwanda time (CAT)</p></div>
    {error && <div role="alert" className="no-print rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
      {key:'NEW',label:'New applications',value:counts.NEW,sub:'Awaiting first review',color:'border-blue-200'},
      {key:'CONTACTED',label:'Contacted',value:counts.CONTACTED,sub:'Follow-up in progress',color:'border-amber-200'},
      {key:'APPROVED',label:'Approved',value:counts.APPROVED,sub:'Accepted applicants',color:'border-green-200'},
      {key:'REJECTED',label:'Rejected',value:counts.REJECTED,sub:'Not proceeding',color:'border-red-200'}
    ].map(item => <button key={item.key} onClick={() => setFilter(filter === item.key ? '' : item.key)} className={`rounded-xl border p-4 text-left transition ${item.color} ${filter === item.key ? 'ring-2 ring-[#00a082] bg-green-50' : 'bg-white'}`}><div className="text-xs font-bold text-gray-500">{item.label}</div><div className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{item.value ?? 0}</div><div className="text-xs text-gray-400 mt-1">{item.sub}</div></button>)}</div>
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3 mb-4"><div><div className="flex items-center gap-2 text-zana-primary"><CarFront size={18}/><h2 className="font-bold text-gray-900">Vehicle demand breakdown</h2></div><p className="mt-1 text-xs text-gray-500">Applicant counts by requested vehicle type · based on all loaded registrations</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{total} total</span></div><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Object.entries(vehicles).map(([label, value]) => <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-4"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-2xl font-bold text-gray-900">{value}</div><div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-[#00a082]" style={{width:`${total ? value / total * 100 : 0}%`}}/></div><div className="mt-1 text-xs text-gray-400">{total ? Math.round(value / total * 100) : 0}% of applications</div></div>)}</div><p className="mt-3 text-xs text-gray-400">Vehicle labels are grouped from the submitted vehicle type. Unrecognised types appear under Other.</p></section>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3"><section className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex items-center gap-2 text-zana-primary"><CalendarDays size={17}/><h2 className="font-bold text-gray-900">Submissions today</h2></div><div className="text-3xl font-extrabold mt-3 text-gray-900">{todayCount}</div><p className="text-xs text-gray-500 mt-1">Applications submitted today in Rwanda time</p></section><section className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex items-center gap-2 text-zana-primary"><ClipboardList size={17}/><h2 className="font-bold text-gray-900">Last 30 days</h2></div><div className="text-3xl font-extrabold mt-3 text-gray-900">{last30}</div><p className="text-xs text-gray-500 mt-1">Total submissions in the returned 30-day daily series</p></section><section className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex items-center gap-2 text-zana-primary"><TrendingUp size={17}/><h2 className="font-bold text-gray-900">7-day growth</h2></div><div className="text-3xl font-extrabold mt-3 text-gray-900">{recentDays.change}</div><p className="text-xs text-gray-500 mt-1">{recentDays.current} this week vs {recentDays.previous} the previous 7 days</p><p className="text-[11px] text-gray-400 mt-2">Calculated from daily submissions; a zero previous week is shown as +100% when new submissions exist.</p></section></div>
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-zana-primary"><TrendingUp size={17}/><h2 className="font-bold text-gray-900">Daily submission trend</h2></div><p className="mt-1 text-xs text-gray-500">All submitted registrations by Rwanda local date · last 30 days</p></div></div><div className="mt-5 space-y-3">{daily.length === 0 ? <p className="py-5 text-center text-sm text-gray-500">No registrations have been recorded yet.</p> : [...daily].slice(-14).reverse().map(d => { const max = Math.max(1, ...daily.slice(-14).map(x => x.count)); const label = new Date(`${d.day}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Africa/Kigali' }); return <div key={d.day} className="grid grid-cols-[58px_1fr_34px] items-center gap-3"><span className="text-xs text-gray-500">{label}</span><div className="h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#00a082] transition-all" style={{ width: `${Math.max(d.count ? 3 : 0, d.count / max * 100)}%` }}/></div><span className="text-right text-sm font-bold tabular-nums text-gray-800">{d.count}</span></div>})}</div><div className="mt-4 flex items-center gap-2 text-xs text-gray-400"><TrendingUp size={13}/> Daily counts are aggregated from the database, not just the rows currently displayed below.</div></section>
    <div className="no-print bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email or location" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-zana-primary"/></div><select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></div>
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"><div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><span className="font-semibold text-gray-800 text-sm">Applicant directory</span><span className="text-xs text-gray-500">{rows.length} shown · up to 500 returned by API</span></div>{loading ? <div className="p-10 text-center text-sm text-gray-500">Loading applications…</div> : rows.length === 0 ? <div className="p-10 text-center"><ClipboardList className="mx-auto text-gray-300" size={30}/><p className="font-semibold text-gray-700 mt-3">No applications found</p><p className="text-sm text-gray-500 mt-1">New submissions will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50 text-left">{['Applicant','Contact','Vehicle','Location','Submitted','Status'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b border-gray-50 align-top hover:bg-gray-50/70"><td className="px-4 py-4 min-w-44"><div className="font-semibold text-gray-900">{r.fullName}</div><div className="text-[11px] text-gray-400 mt-1">{r.id.slice(0, 8)}</div></td><td className="px-4 py-4 min-w-48"><a href={`tel:${r.phone}`} className="flex items-center gap-1.5 text-gray-700 hover:text-zana-primary"><Phone size={13}/>{r.phone}</a>{r.email && <a href={`mailto:${r.email}`} className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 hover:text-zana-primary"><Mail size={12}/>{r.email}</a>}</td><td className="px-4 py-4 min-w-36"><div className="flex items-center gap-1.5"><Bike size={14} className="text-gray-400"/>{r.vehicleType}</div><span className="inline-block mt-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{r.powerType}</span></td><td className="px-4 py-4 min-w-40"><span className="flex items-center gap-1.5 text-gray-700"><MapPin size={13} className="text-gray-400"/>{r.location}</span></td><td className="px-4 py-4 whitespace-nowrap text-gray-500">{dateLabel(r.createdAt)}</td><td className="px-4 py-4 min-w-40"><div><span className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${badge[r.status] || badge.NEW}`}>{r.status}</span></div><select aria-label={`Update status for ${r.fullName}`} disabled={saving === r.id} value={r.status} onChange={e => changeStatus(r.id, e.target.value as Status)} className="no-print mt-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs disabled:opacity-50">{statuses.map(s => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table></div>}</div>
    <div className="print-only mt-5 text-xs text-gray-500">Confidential operational report · Applicant contact details are personal data. Handle and share securely.</div>
    <style jsx global>{`
      .print-only { display:none; }
      @media print {
        @page { size: A4 landscape; margin: 12mm; }
        body { background:#fff !important; color:#111827 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        body * { visibility:hidden; }
        .rider-report, .rider-report * { visibility:visible; }
        .rider-report { position:absolute; left:0; top:0; width:100%; padding:0 !important; margin:0 !important; }
        .no-print { display:none !important; }
        .print-only { display:block !important; }
        .rider-report section, .rider-report .bg-white { break-inside:avoid; box-shadow:none !important; }
        .rider-report table { font-size:9px !important; }
        .rider-report th, .rider-report td { padding:5px !important; }
        .rider-report a { color:#111827 !important; text-decoration:none !important; }
      }
    `}</style>
  </div></AdminShell>;
}
