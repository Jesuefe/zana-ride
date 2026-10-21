'use client';
import { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, ClipboardList, Phone, Mail, MapPin, Bike } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getRiderRegistrations, updateRiderRegistrationStatus } from '../../../lib/api/admin';

const statuses = ['NEW', 'CONTACTED', 'APPROVED', 'REJECTED'] as const;
type Status = typeof statuses[number];
type Registration = { id: string; fullName: string; phone: string; email: string | null; vehicleType: string; powerType: string; location: string; status: Status; createdAt: string };
const badge: Record<string, string> = { NEW: 'bg-blue-100 text-blue-700', CONTACTED: 'bg-amber-100 text-amber-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700' };

export default function RiderRegistrationsPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await getRiderRegistrations({ status: filter || undefined, search: search.trim() || undefined })); }
    catch (e: any) { setError(e?.message || 'Could not load rider registrations.'); }
    finally { setLoading(false); }
  }, [filter, search]);
  useEffect(() => { load(); }, [load]);
  const changeStatus = async (id: string, status: Status) => {
    setSaving(id); setError('');
    try { await updateRiderRegistrationStatus(id, status); await load(); }
    catch (e: any) { setError(e?.message || 'Could not update application status.'); }
    finally { setSaving(null); }
  };
  const counts = statuses.reduce((a, s) => ({ ...a, [s]: rows.filter(r => r.status === s).length }), {} as Record<Status, number>);
  return <AdminShell><div className="space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><div className="flex items-center gap-2 text-zana-primary"><ClipboardList size={19}/><span className="text-xs font-bold uppercase tracking-wider">Recruitment</span></div><h1 className="text-2xl font-bold text-gray-900 mt-1">Rider Applications</h1><p className="text-sm text-gray-500 mt-1">Review rider sign-ups submitted through the public registration form.</p></div><button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><RefreshCw size={15}/> Refresh</button></div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{statuses.map(s => <button key={s} onClick={() => setFilter(filter === s ? '' : s)} className={`rounded-xl border p-4 text-left transition ${filter === s ? 'border-zana-primary bg-green-50' : 'border-gray-200 bg-white'}`}><div className="text-xs font-bold text-gray-500">{s === 'NEW' ? 'New' : s.charAt(0) + s.slice(1).toLowerCase()}</div><div className="text-2xl font-bold text-gray-900 mt-1">{counts[s] ?? 0}</div></button>)}</div>
    <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email or location" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-zana-primary"/></div><select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></div>
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"><div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><span className="font-semibold text-gray-800 text-sm">Applications</span><span className="text-xs text-gray-500">{rows.length} shown (maximum 500)</span></div>
      {loading ? <div className="p-10 text-center text-sm text-gray-500">Loading applications…</div> : rows.length === 0 ? <div className="p-10 text-center"><ClipboardList className="mx-auto text-gray-300" size={30}/><p className="font-semibold text-gray-700 mt-3">No applications found</p><p className="text-sm text-gray-500 mt-1">New submissions will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50 text-left">{['Applicant','Contact','Vehicle','Location','Submitted','Status'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b border-gray-50 align-top hover:bg-gray-50/70"><td className="px-4 py-4 min-w-44"><div className="font-semibold text-gray-900">{r.fullName}</div><div className="text-[11px] text-gray-400 mt-1">{r.id.slice(0, 8)}</div></td><td className="px-4 py-4 min-w-48"><a href={`tel:${r.phone}`} className="flex items-center gap-1.5 text-gray-700 hover:text-zana-primary"><Phone size={13}/>{r.phone}</a>{r.email && <a href={`mailto:${r.email}`} className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 hover:text-zana-primary"><Mail size={12}/>{r.email}</a>}</td><td className="px-4 py-4 min-w-36"><div className="flex items-center gap-1.5"><Bike size={14} className="text-gray-400"/>{r.vehicleType}</div><span className="inline-block mt-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{r.powerType}</span></td><td className="px-4 py-4 min-w-40"><span className="flex items-center gap-1.5 text-gray-700"><MapPin size={13} className="text-gray-400"/>{r.location}</span></td><td className="px-4 py-4 whitespace-nowrap text-gray-500">{new Date(r.createdAt).toLocaleString()}</td><td className="px-4 py-4 min-w-40"><div><span className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${badge[r.status] || badge.NEW}`}>{r.status}</span></div><select aria-label={`Update status for ${r.fullName}`} disabled={saving === r.id} value={r.status} onChange={e => changeStatus(r.id, e.target.value as Status)} className="mt-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs disabled:opacity-50">{statuses.map(s => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table></div>}
    </div>
  </div></AdminShell>;
}
