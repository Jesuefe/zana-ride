'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, Bike, CarFront, Check, CheckCircle2, ChevronRight,
  Clock3, FileCheck2, FileImage, FileText, RefreshCw, Search, ShieldCheck,
  UserRound, X
} from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import {
  getDrivers, getDriverDetail, getDriverAuditHistory, getDriverOperationsOverview, updateDriverProfile,
  reviewDriver, updateDriverVehicle, setDriverVehicleStatus, verifyDriverDocument, updateDriverDocument
} from '../../../lib/api/admin';

type Driver = any;
type Overview = { total: number; pending: number; approved: number; rejected: number; suspended: number; online: number; pendingDocuments: number; expiredDocuments: number; totalVehicles: number; pendingVehicles: number };

const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
  SUSPENDED: 'bg-slate-100 text-slate-600 ring-slate-200',
  VERIFIED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  SUPERSEDED: 'bg-slate-100 text-slate-500 ring-slate-200',
  EXPIRED: 'bg-rose-100 text-rose-800 ring-rose-200',
};

function Status({ value }: { value: string }) {
  return <span className={'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ' + (statusStyle[value] || statusStyle.PENDING)}>{value || 'PENDING'}</span>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#00A082] focus:ring-2 focus:ring-[#00A082]/10"/></label>;
}

export default function DriverOperationsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [filter, setFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Driver | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  const [profile, setProfile] = useState<any>({});
  const [vehicleForm, setVehicleForm] = useState<any>({});
  const [editingVehicleId, setEditingVehicleId] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rows, stats] = await Promise.all([getDrivers(filter || undefined), getDriverOperationsOverview()]);
      setDrivers(rows || []); setOverview(stats);
      if (selectedId) {
        const [fresh, history] = await Promise.all([getDriverDetail(selectedId), getDriverAuditHistory(selectedId)]);
        setDetail(fresh); setProfile(profileFrom(fresh)); setAudit(history || []);
      }
    } catch (e: any) { setError(e?.message || 'Could not load driver operations.'); }
    finally { setLoading(false); }
  }, [filter, selectedId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(d => [d.user?.firstName, d.user?.lastName, d.user?.phone, d.plate, d.vehicle].join(' ').toLowerCase().includes(q));
  }, [drivers, search]);

  function profileFrom(d: Driver) {
    return {
      firstName: d?.user?.firstName || '', lastName: d?.user?.lastName || '',
      phone: d?.user?.phone || '', email: d?.user?.email || '',
      vehicle: d?.vehicle || '', plate: d?.plate || '',
      serviceType: d?.serviceType || 'BIKE', driverMode: d?.driverMode || 'BOTH',
    };
  }

  async function openDriver(id: string) {
    setSelectedId(id); setError(''); setNotice('');
    try {
      const [d, history] = await Promise.all([getDriverDetail(id), getDriverAuditHistory(id)]);
      setDetail(d); setProfile(profileFrom(d)); setAudit(history || []); setReason('');
      setEditingVehicleId(''); setVehicleForm({});
    } catch (e: any) { setError(e?.message || 'Could not open driver record.'); }
  }

  async function runAction(action: () => Promise<any>, success: string) {
    setSaving(true); setError(''); setNotice('');
    try { await action(); setNotice(success); await load(); if (selectedId) { const [fresh, history] = await Promise.all([getDriverDetail(selectedId), getDriverAuditHistory(selectedId)]); setDetail(fresh); setProfile(profileFrom(fresh)); setAudit(history || []); } }
    catch (e: any) { setError(e?.message || 'The change could not be saved.'); }
    finally { setSaving(false); }
  }

  async function saveProfile() {
    if (!reason.trim() || reason.trim().length < 5) { setError('Enter a correction reason of at least 5 characters.'); return; }
    await runAction(() => updateDriverProfile(selectedId, { ...profile, reason }), 'Driver details corrected. Previous and new values are recorded in the audit history.');
  }

  async function decideDriver(status: string) {
    if (!reason.trim() || reason.trim().length < 5) { setError('Enter a decision reason of at least 5 characters.'); return; }
    await runAction(() => reviewDriver(selectedId, status, reason), 'Driver review status updated and recorded.');
  }

  async function saveVehicle() {
    if (!reason.trim() || reason.trim().length < 5) { setError('Enter a correction reason of at least 5 characters.'); return; }
    await runAction(() => updateDriverVehicle(selectedId, editingVehicleId, { ...vehicleForm, year: vehicleForm.year ? Number(vehicleForm.year) : null, reason }), 'Vehicle details corrected. The change is recorded.');
  }

  async function vehicleDecision(vehicleId: string, status: string) {
    if (!reason.trim() || reason.trim().length < 5) { setError('Enter a decision reason of at least 5 characters in the correction box.'); return; }
    await runAction(() => setDriverVehicleStatus(selectedId, vehicleId, status, reason), 'Vehicle status updated.');
  }

  async function documentDecision(documentId: string, verified: boolean) {
    const why = window.prompt(verified ? 'Add a verification note (minimum 5 characters):' : 'Why is this document being rejected? (minimum 5 characters)');
    if (!why || why.trim().length < 5) return;
    await runAction(() => verifyDriverDocument(documentId, verified, why.trim()), verified ? 'Document verified.' : 'Document rejected and returned for correction.');
  }

  async function correctDocumentMetadata(doc: any) {
    const label = window.prompt('Correct document name:', doc.label || '');
    if (label === null) return;
    const currentExpiry = doc.expiresAt ? new Date(doc.expiresAt).toISOString().slice(0,10) : '';
    const expiry = window.prompt('Correct expiry date (YYYY-MM-DD), or leave blank if it does not expire:', currentExpiry);
    if (expiry === null) return;
    const why = window.prompt('Why is this document record being corrected? (minimum 5 characters)');
    if (!why || why.trim().length < 5) return;
    await runAction(() => updateDriverDocument(doc.id, { label: label.trim(), expiresAt: expiry.trim() || null, reason: why.trim() }), 'Document details corrected. The document has returned to pending review.');
  }

  const docs = (detail?.documents || []).filter((doc: any) => !doc.vehicleId);
  const vehicles = detail?.vehicles || [];

  return <AdminShell>
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div><div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#00866F]"><ShieldCheck size={15}/> Zana operations control</div><h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Driver & vehicle verification</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Review driver identity, inspect every uploaded vehicle image, correct mistakes and keep a traceable decision history.</p></div>
        <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={15}/> Refresh operations</button>
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/>{notice}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        {[
          ['Total drivers', overview?.total ?? '—', UserRound],
          ['Awaiting review', overview?.pending ?? '—', Clock3],
          ['Approved', overview?.approved ?? '—', CheckCircle2],
          ['Online now', overview?.online ?? '—', Activity],
          ['Documents pending', overview?.pendingDocuments ?? '—', FileCheck2],
          ['Expired documents', overview?.expiredDocuments ?? '—', AlertCircle],
          ['Vehicles registered', overview?.totalVehicles ?? '—', CarFront],
          ['Vehicles pending', overview?.pendingVehicles ?? '—', Clock3],
          ['Rejected', overview?.rejected ?? '—', X],
          ['Suspended', overview?.suspended ?? '—', ShieldCheck],
        ].map(([label, value, Icon]: any) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-500">{label}</span><Icon size={16} className="text-[#00A082]"/></div><div className="mt-2 text-2xl font-black tabular-nums text-slate-950">{value}</div></div>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(480px,1.05fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-extrabold text-slate-900">Driver applications</h3><p className="mt-1 text-xs text-slate-500">Select an applicant to inspect the complete record.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{filtered.length} records</span></div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search driver, phone or plate" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#00A082]"/></div>
              <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#00A082]"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="SUSPENDED">Suspended</option></select>
            </div>
          </div>
          <div className="max-h-[780px] overflow-y-auto">
            {loading ? <div className="p-10 text-center text-sm text-slate-500">Loading drivers…</div> : filtered.length === 0 ? <div className="p-10 text-center"><UserRound size={28} className="mx-auto text-slate-300"/><p className="mt-3 text-sm font-bold text-slate-700">No drivers in this view</p></div> : filtered.map(d => <button key={d.id} onClick={() => openDriver(d.id)} className={'flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ' + (selectedId === d.id ? 'bg-emerald-50/70' : '')}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{d.serviceType === 'BIKE' ? <Bike size={19}/> : <CarFront size={19}/>}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-slate-900">{d.user?.firstName || 'Driver'} {d.user?.lastName || ''}</div><div className="mt-1 truncate text-xs text-slate-500">{d.user?.phone || 'No phone'} · {d.plate || 'Plate missing'}</div><div className="mt-2 flex flex-wrap gap-1.5"><Status value={d.approvalStatus}/><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{d.onlineStatus || 'OFFLINE'}</span></div></div><ChevronRight size={17} className="shrink-0 text-slate-400"/>
            </button>)}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!detail ? <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-[#00866F]"><FileCheck2 size={28}/></div><h3 className="mt-4 text-lg font-extrabold text-slate-900">Application inspection</h3><p className="mt-2 max-w-sm text-sm text-slate-500">Choose a driver from the list to inspect identity documents, vehicle images, correct details and record your decision.</p></div> :
            <div className="space-y-5 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#00866F]">Driver application</div><h3 className="mt-1 text-xl font-black text-slate-950">{detail.user?.firstName} {detail.user?.lastName}</h3><p className="mt-1 text-xs text-slate-500">{detail.user?.phone} · Joined {new Date(detail.createdAt).toLocaleDateString()}</p></div><Status value={detail.approvalStatus}/></div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-extrabold text-slate-900">Correct driver information</h4><span className="text-[10px] font-bold text-slate-400">AUDITED EDIT</span></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="First name" value={profile.firstName || ''} onChange={v => setProfile((p: any) => ({...p, firstName:v}))}/>
                  <Field label="Last name" value={profile.lastName || ''} onChange={v => setProfile((p: any) => ({...p, lastName:v}))}/>
                  <Field label="Phone" value={profile.phone || ''} onChange={v => setProfile((p: any) => ({...p, phone:v}))}/>
                  <Field label="Email" value={profile.email || ''} onChange={v => setProfile((p: any) => ({...p, email:v}))}/>
                  <Field label="Vehicle description" value={profile.vehicle || ''} onChange={v => setProfile((p: any) => ({...p, vehicle:v}))}/>
                  <Field label="Registration plate" value={profile.plate || ''} onChange={v => setProfile((p: any) => ({...p, plate:v}))}/>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Service type</span><select value={profile.serviceType || 'BIKE'} onChange={e => setProfile((p: any) => ({...p,serviceType:e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option>BIKE</option><option>ECONOMY</option><option>COMFORT</option></select></label>
                  <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Driver mode</span><select value={profile.driverMode || 'BOTH'} onChange={e => setProfile((p: any) => ({...p,driverMode:e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option>RIDES</option><option>DELIVERIES</option><option>BOTH</option></select></label>
                </div>
                <label className="mt-3 block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Correction / decision reason (required)</span><textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Explain why this record is being corrected or a decision is being made…" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#00A082]"/></label>
                <button disabled={saving} onClick={saveProfile} className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-slate-700 disabled:opacity-50">Save corrected details</button>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-extrabold text-slate-900">Driver documents</h4><span className="text-xs text-slate-500">{docs.length} files</span></div>
                {docs.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">No driver documents uploaded yet.</p> : <div className="grid gap-3 sm:grid-cols-2">{docs.map((doc: any) => <div key={doc.id} className="overflow-hidden rounded-xl border border-slate-200">
                  {doc.fileUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(doc.fileUrl) ? <a href={doc.fileUrl} target="_blank" rel="noreferrer"><img src={doc.fileUrl} alt={doc.label} className="h-36 w-full bg-slate-100 object-cover"/></a> : <a href={doc.fileUrl || '#'} target="_blank" rel="noreferrer" className="flex h-36 items-center justify-center bg-slate-50 text-slate-400"><FileText size={32}/></a>}
                  <div className="space-y-2 p-3"><div className="flex items-start justify-between gap-2"><span className="text-xs font-bold text-slate-800">{doc.label}</span><Status value={doc.reviewStatus || (doc.verified ? 'VERIFIED' : 'PENDING')}/></div><div className="text-[10px] text-slate-500">Uploaded {new Date(doc.createdAt).toLocaleDateString()} {doc.expiresAt ? '· Expires ' + new Date(doc.expiresAt).toLocaleDateString() : ''}</div>{!doc.supersededAt && <div className="flex flex-wrap gap-2"><button disabled={saving} onClick={() => correctDocumentMetadata(doc)} className="rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-extrabold text-slate-600">Correct details</button><button disabled={saving || doc.verified} onClick={() => documentDecision(doc.id,true)} className="flex-1 rounded-lg bg-emerald-50 px-2 py-2 text-[10px] font-extrabold text-emerald-700 disabled:opacity-40">Verify</button><button disabled={saving} onClick={() => documentDecision(doc.id,false)} className="flex-1 rounded-lg bg-rose-50 px-2 py-2 text-[10px] font-extrabold text-rose-700">Reject</button></div>}</div>
                </div>)}</div>}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-extrabold text-slate-900">Registered vehicles & photographs</h4><span className="text-xs text-slate-500">{vehicles.length} vehicles</span></div>
                {vehicles.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">No separate vehicle record has been submitted yet. Existing legacy vehicle: {detail.vehicle || 'Not specified'} · {detail.plate || 'No plate'}.</p> : <div className="space-y-4">{vehicles.map((v: any) => <div key={v.id} className="rounded-2xl border border-slate-200 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-extrabold text-slate-900">{v.vehicleType} · {v.make || ''} {v.model || ''}</div><div className="mt-1 text-xs text-slate-500">{v.plate} · {v.color || 'Colour not provided'} · {v.ownershipType}</div></div><Status value={v.status}/></div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{(v.documents || []).map((doc: any) => <a key={doc.id} href={doc.fileUrl || '#'} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50">{doc.fileUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(doc.fileUrl) ? <img src={doc.fileUrl} alt={doc.label} className="h-28 w-full object-cover"/> : <div className="flex h-28 items-center justify-center text-slate-400"><FileImage size={25}/></div>}<div className="space-y-2 p-2"><div className="truncate text-[10px] font-bold text-slate-700">{doc.label}</div><div><Status value={doc.reviewStatus || (doc.verified ? 'VERIFIED' : 'PENDING')}/></div>{!doc.supersededAt ? <div className="space-y-1"><button disabled={saving} onClick={e => {e.preventDefault();e.stopPropagation();correctDocumentMetadata(doc);}} className="w-full rounded-md border border-slate-200 px-1.5 py-1.5 text-[9px] font-extrabold text-slate-600">Correct details</button><div className="flex gap-1"><button disabled={saving || doc.verified} onClick={e => {e.preventDefault();e.stopPropagation();documentDecision(doc.id,true);}} className="flex-1 rounded-md bg-emerald-50 px-1.5 py-1.5 text-[9px] font-extrabold text-emerald-700 disabled:opacity-40">Verify</button><button disabled={saving} onClick={e => {e.preventDefault();e.stopPropagation();documentDecision(doc.id,false);}} className="flex-1 rounded-md bg-rose-50 px-1.5 py-1.5 text-[9px] font-extrabold text-rose-700">Reject</button></div></div> : <div className="text-[9px] font-bold text-slate-400">Previous version · read only</div>}</div></a>)}</div>
                  <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => {setEditingVehicleId(v.id);setVehicleForm({...v});}} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-extrabold text-slate-700">Edit vehicle</button><button disabled={saving} onClick={() => vehicleDecision(v.id,'APPROVED')} className="rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-extrabold text-emerald-700">Approve vehicle</button><button disabled={saving} onClick={() => vehicleDecision(v.id,'REJECTED')} className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-extrabold text-rose-700">Reject vehicle</button><button disabled={saving} onClick={() => vehicleDecision(v.id,'SUSPENDED')} className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-extrabold text-amber-700">Suspend vehicle</button></div>
                  {editingVehicleId === v.id && <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3"><div className="text-xs font-extrabold text-slate-800">Correct vehicle record</div><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Vehicle type</span><select value={vehicleForm.vehicleType || 'MOTORCYCLE'} onChange={e => setVehicleForm((old: any) => ({...old,vehicleType:e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="MOTORCYCLE">Motorcycle</option><option value="CAR">Car</option></select></label>{['make','model','plate','color','registrationNumber','chassisNumber','year','ownershipType'].map(key => <Field key={key} label={key.replace(/([A-Z])/g,' $1')} value={String(vehicleForm[key] ?? '')} onChange={value => setVehicleForm((old: any) => ({...old,[key]:value}))}/>)}</div><div className="flex gap-2"><button disabled={saving} onClick={saveVehicle} className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-extrabold text-white">Save vehicle correction</button><button onClick={() => setEditingVehicleId('')} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600">Cancel</button></div></div>}
                </div>)}</div>}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-extrabold text-slate-900">Correction & decision history</h4><span className="text-[10px] font-bold text-slate-400">{audit.length} events</span></div>
                {audit.length === 0 ? <p className="text-xs text-slate-500">No recorded corrections or decisions yet.</p> : <div className="space-y-3">{audit.map(log => {
                  let metadata: any = {}; let before: any = {}; let after: any = {};
                  try { metadata = JSON.parse(log.metadataJson || '{}'); } catch {}
                  try { before = JSON.parse(log.beforeJson || '{}'); } catch {}
                  try { after = JSON.parse(log.afterJson || '{}'); } catch {}
                  return <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-xs font-extrabold text-slate-800">{String(log.action || '').replace(/_/g,' ')}</div><div className="mt-1 text-[10px] text-slate-500">{log.actor ? [log.actor.firstName,log.actor.lastName].filter(Boolean).join(' ') || log.actor.email || log.actor.phone : 'System / legacy action'} · {new Date(log.createdAt).toLocaleString()}</div></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-slate-500">{log.entityType}</span></div>
                    {metadata.reason && <p className="mt-2 text-xs text-slate-600">Reason: {metadata.reason}</p>}
                    {(log.beforeJson || log.afterJson) && <details className="mt-2"><summary className="cursor-pointer text-[10px] font-bold text-[#00866F]">View previous and corrected values</summary><div className="mt-2 grid gap-2 sm:grid-cols-2"><pre className="overflow-auto rounded-lg bg-white p-2 text-[9px] text-slate-600">Before: {JSON.stringify(before,null,2)}</pre><pre className="overflow-auto rounded-lg bg-white p-2 text-[9px] text-slate-600">After: {JSON.stringify(after,null,2)}</pre></div></details>}
                  </div>;
                })}</div>}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="text-sm font-extrabold text-slate-900">Driver decision</h4><p className="mt-1 text-xs text-slate-500">Use the correction / decision reason above. Every action is added to the audit history.</p>
                <div className="mt-3 flex flex-wrap gap-2"><button disabled={saving} onClick={() => decideDriver('APPROVED')} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"><Check size={14}/> Approve driver</button><button disabled={saving} onClick={() => decideDriver('REJECTED')} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"><X size={14}/> Reject</button><button disabled={saving} onClick={() => decideDriver('SUSPENDED')} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"><ShieldCheck size={14}/> Suspend</button><button disabled={saving} onClick={() => decideDriver('PENDING')} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-extrabold text-slate-700 disabled:opacity-50">Return to pending</button></div>
              </div>
            </div>}
        </section>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">Operational safety: editing a profile does not approve a driver. Driver and vehicle decisions are separate. Uploaded files remain attached to their records; corrections and decisions require a reason and are recorded in the audit log.</p>
    </div>
  </AdminShell>;
}
