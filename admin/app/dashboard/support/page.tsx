'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Headset, Plus, RefreshCw, Search, Send, X } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { createSupportTicket, getSupportTickets, updateSupportTicket } from '../../../lib/api/admin';

type Ticket = {
  id: string; ticketNumber: string; customerName: string; customerPhone?: string | null;
  customerId?: string | null; subject: string; description: string; category: string;
  priority: string; status: string; relatedType?: string | null; relatedReference?: string | null;
  internalNotes?: string | null; resolution?: string | null; createdAt: string; updatedAt: string;
};

const STATUSES = [
  { value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'WAITING_CUSTOMER', label: 'Waiting for customer' }, { value: 'ESCALATED', label: 'Escalated' },
  { value: 'RESOLVED', label: 'Resolved' }, { value: 'CLOSED', label: 'Closed' },
];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const CATEGORIES = ['GENERAL', 'RIDE', 'DELIVERY', 'ORDER', 'PAYMENT', 'DRIVER', 'MERCHANT', 'SAFETY', 'ACCOUNT'];

function dateLabel(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function label(value?: string | null) {
  return (value || '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
function statusClass(status: string) {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'ESCALATED') return 'bg-red-50 text-red-700';
  if (status === 'IN_PROGRESS') return 'bg-blue-50 text-blue-700';
  if (status === 'WAITING_CUSTOMER') return 'bg-amber-50 text-amber-700';
  return 'bg-gray-100 text-gray-700';
}
function priorityClass(priority: string) {
  if (priority === 'URGENT') return 'text-red-700 bg-red-50';
  if (priority === 'HIGH') return 'text-orange-700 bg-orange-50';
  if (priority === 'LOW') return 'text-gray-600 bg-gray-100';
  return 'text-blue-700 bg-blue-50';
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [resolution, setResolution] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerId: '', subject: '', description: '',
    category: 'GENERAL', priority: 'NORMAL', relatedType: '', relatedReference: '',
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await getSupportTickets({ status, search });
      setTickets(rows);
      if (selected) {
        const latest = rows.find((t: Ticket) => t.id === selected.id);
        if (latest) setSelected(latest);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load support tickets.');
    } finally { setLoading(false); }
  }, [status, search, selected?.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setNotes(selected?.internalNotes || '');
    setResolution(selected?.resolution || '');
    setAssignedToId(selected?.assignedToId || '');
  }, [selected?.id, selected?.internalNotes, selected?.resolution]);

  const openCount = useMemo(() => tickets.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status)).length, [tickets]);
  const urgentCount = useMemo(() => tickets.filter(t => t.priority === 'URGENT' && !['RESOLVED', 'CLOSED'].includes(t.status)).length, [tickets]);
  const resolvedCount = useMemo(() => tickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length, [tickets]);

  async function submitTicket(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const created = await createSupportTicket({
        ...form,
        customerPhone: form.customerPhone || undefined,
        customerId: form.customerId || undefined,
        relatedType: form.relatedType || undefined,
        relatedReference: form.relatedReference || undefined,
      });
      setShowCreate(false);
      setForm({ customerName: '', customerPhone: '', customerId: '', subject: '', description: '', category: 'GENERAL', priority: 'NORMAL', relatedType: '', relatedReference: '' });
      await load();
      setSelected(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the case.');
    } finally { setSaving(false); }
  }

  async function changeTicket(id: string, patch: { status?: string; priority?: string; assignedToId?: string | null; internalNotes?: string; resolution?: string }) {
    setSaving(true); setError('');
    try {
      const updated = await updateSupportTicket(id, patch);
      setTickets(rows => rows.map(t => t.id === id ? updated : t));
      setSelected(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the case.');
    } finally { setSaving(false); }
  }

  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-zana-primary text-sm font-semibold"><Headset size={17} /> ZANA CARE</div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Customer support</h1>
            <p className="text-sm text-gray-500 mt-1">One place to track complaints, payment questions and operational cases.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} className="inline-flex items-center gap-2 border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-gray-50" disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
            <button onClick={() => setShowCreate(v => !v)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-zana-primary hover:opacity-90"><Plus size={16} /> New case</button>
          </div>
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm flex items-center gap-3"><div className="rounded-xl bg-blue-50 text-blue-700 p-3"><Clock3 size={20}/></div><div><p className="text-xs text-gray-500">Active cases in view</p><p className="text-2xl font-bold text-gray-900">{openCount}</p></div></div>
          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm flex items-center gap-3"><div className="rounded-xl bg-red-50 text-red-700 p-3"><AlertCircle size={20}/></div><div><p className="text-xs text-gray-500">Urgent cases in view</p><p className="text-2xl font-bold text-gray-900">{urgentCount}</p></div></div>
          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm flex items-center gap-3"><div className="rounded-xl bg-emerald-50 text-emerald-700 p-3"><CheckCircle2 size={20}/></div><div><p className="text-xs text-gray-500">Resolved in view</p><p className="text-2xl font-bold text-gray-900">{resolvedCount}</p></div></div>
        </div>

        {showCreate && <form onSubmit={submitTicket} className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-bold text-gray-900">Create support case</h2><button type="button" onClick={() => setShowCreate(false)} className="p-1 text-gray-500" aria-label="Close form"><X size={18}/></button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input required value={form.customerName} onChange={e => setForm(f => ({...f, customerName:e.target.value}))} placeholder="Customer full name" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
            <input value={form.customerPhone} onChange={e => setForm(f => ({...f, customerPhone:e.target.value}))} placeholder="Customer phone" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
            <input value={form.customerId} onChange={e => setForm(f => ({...f, customerId:e.target.value}))} placeholder="Customer account ID (optional)" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
            <input required value={form.subject} onChange={e => setForm(f => ({...f, subject:e.target.value}))} placeholder="Short issue summary" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
            <select value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">{CATEGORIES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select>
            <select value={form.priority} onChange={e => setForm(f => ({...f, priority:e.target.value}))} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">{PRIORITIES.map(v => <option key={v} value={v}>{label(v)} priority</option>)}</select>
            <select value={form.relatedType} onChange={e => setForm(f => ({...f, relatedType:e.target.value}))} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"><option value="">Related record (optional)</option>{['RIDE','DELIVERY','ORDER','PAYMENT','ACCOUNT','OTHER'].map(v => <option key={v} value={v}>{label(v)}</option>)}</select>
            <input value={form.relatedReference} onChange={e => setForm(f => ({...f, relatedReference:e.target.value}))} placeholder="Ride, order or payment reference" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
          </div>
          <textarea required value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} placeholder="What happened? Include the customer's report and steps already taken." rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
          <div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-zana-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Send size={15}/>{saving ? 'Creating…' : 'Create case'}</button></div>
        </form>}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div><h2 className="font-bold text-gray-900">Case queue</h2><p className="text-xs text-gray-500 mt-1">Up to 250 newest cases; use search to find a customer, ticket or transaction reference.</p></div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative"><Search size={16} className="absolute left-3 top-3 text-gray-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases…" className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm w-full sm:w-64"/></div>
              <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"><option value="ALL">All statuses</option>{STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
            </div>
          </div>
          {loading ? <div className="p-10 text-center text-sm text-gray-500">Loading support cases…</div> : tickets.length === 0 ? <div className="p-10 text-center"><Headset size={26} className="mx-auto text-gray-300"/><p className="font-semibold text-gray-700 mt-3">No support cases found</p><p className="text-sm text-gray-500 mt-1">Create a case or adjust your filters.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="text-left font-semibold px-4 py-3">Case</th><th className="text-left font-semibold px-4 py-3">Customer</th><th className="text-left font-semibold px-4 py-3">Category / priority</th><th className="text-left font-semibold px-4 py-3">Status</th><th className="text-left font-semibold px-4 py-3">Created</th><th className="text-right font-semibold px-4 py-3">Details</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{tickets.map(t => <tr key={t.id} className={selected?.id === t.id ? 'bg-emerald-50/50' : 'hover:bg-gray-50'}>
              <td className="px-4 py-3 min-w-56"><p className="font-semibold text-gray-900">{t.subject}</p><p className="text-xs text-gray-500 mt-1">{t.ticketNumber}</p>{t.relatedReference && <p className="text-xs text-gray-500 mt-1">{label(t.relatedType)} · {t.relatedReference}</p>}</td>
              <td className="px-4 py-3 min-w-40"><p className="font-medium text-gray-800">{t.customerName}</p><p className="text-xs text-gray-500 mt-1">{t.customerPhone || 'No phone supplied'}</p></td>
              <td className="px-4 py-3"><p>{label(t.category)}</p><span className={'inline-flex mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold '+priorityClass(t.priority)}>{label(t.priority)}</span></td>
              <td className="px-4 py-3 min-w-44"><select aria-label={'Status for '+t.ticketNumber} value={t.status} disabled={saving} onChange={e => void changeTicket(t.id, {status:e.target.value})} className={'max-w-44 rounded-full px-2.5 py-1.5 text-xs font-semibold border-0 '+statusClass(t.status)}>{STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{dateLabel(t.createdAt)}</td>
              <td className="px-4 py-3 text-right"><button onClick={() => setSelected(t)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-white">Open</button></td>
            </tr>)}</tbody>
          </table></div>}
        </div>

        {selected && <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-zana-primary font-bold">{selected.ticketNumber}</p><h2 className="text-xl font-bold text-gray-900 mt-1">{selected.subject}</h2><p className="text-sm text-gray-500 mt-1">{selected.customerName} {selected.customerPhone ? '· '+selected.customerPhone : ''}</p></div><button onClick={() => setSelected(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" aria-label="Close case details"><X size={18}/></button></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Category</p><p className="font-semibold mt-1">{label(selected.category)}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Related reference</p><p className="font-semibold mt-1 break-all">{selected.relatedReference || 'Not linked'}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Created</p><p className="font-semibold mt-1">{dateLabel(selected.createdAt)}</p></div></div>
          <div><h3 className="text-sm font-bold text-gray-800 mb-1">Customer report</h3><p className="text-sm text-gray-700 whitespace-pre-wrap rounded-xl border border-gray-100 p-3">{selected.description}</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="text-sm font-semibold text-gray-700">Priority<select value={selected.priority} onChange={e => void changeTicket(selected.id,{priority:e.target.value})} className="block w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 bg-white">{PRIORITIES.map(p=><option key={p} value={p}>{label(p)}</option>)}</select></label><label className="text-sm font-semibold text-gray-700">Resolution summary<textarea rows={3} value={resolution} onChange={e => setResolution(e.target.value)} className="block w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 font-normal"/></label></div>
          <label className="block text-sm font-semibold text-gray-700">Assigned staff user ID <span className="font-normal text-gray-500">(optional)</span><div className="flex gap-2 mt-1"><input value={assignedToId} onChange={e => setAssignedToId(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 font-normal" placeholder="Paste staff user ID"/><button type="button" disabled={saving} onClick={() => void changeTicket(selected.id,{assignedToId:assignedToId.trim() || null})} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold">Assign</button></div></label>
          <label className="block text-sm font-semibold text-gray-700">Internal notes <span className="font-normal text-gray-500">(visible to staff only)</span><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="block w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 font-normal" placeholder="Investigation notes, checks performed, handoff details…"/></label>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><p className="text-xs text-gray-500">Last updated {dateLabel(selected.updatedAt)}. Payment cases are tracked here; this screen does not modify balances or issue refunds.</p><button disabled={saving} onClick={() => void changeTicket(selected.id,{internalNotes:notes,resolution})} className="rounded-xl bg-zana-primary text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Save notes</button></div>
        </div>}
      </div>
    </AdminShell>
  );
}
