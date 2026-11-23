'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, Check, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, Wallet, X } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api/client';

type Partner = { id: string; name: string; contactEmail?: string | null; status: string; balance: number; apiKeyPrefix: string; createdAt: string; updatedAt: string };

const fmt = (n: number) => new Intl.NumberFormat('en-RW').format(n || 0);

export default function FoodDeliveryPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [expanded, setExpanded] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [revealedKey, setRevealedKey] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setPartners(await api.get<Partner[]>('/admin/food-delivery-partners')); }
    catch (e: any) { setError(e?.message || 'Unable to load partners.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('create'); setError(''); setNotice('');
    try {
      const result = await api.post<any>('/admin/food-delivery-partners', { name, contactEmail: email || undefined });
      setRevealedKey(result.apiKey || '');
      setNotice('Partner integration created. Copy the API key now; it will not be shown again.');
      setName(''); setEmail(''); setShowCreate(false); await load();
    } catch (e: any) { setError(e?.message || 'Could not create partner.'); }
    finally { setBusy(''); }
  }

  async function changeStatus(partner: Partner, status: 'ACTIVE' | 'SUSPENDED') {
    if (!window.confirm(`${status === 'ACTIVE' ? 'Activate' : 'Suspend'} ${partner.name}?`)) return;
    setBusy(partner.id); setError(''); setNotice('');
    try { await api.patch(`/admin/food-delivery-partners/${partner.id}/status`, { status }); setNotice(`${partner.name} is now ${status}.`); await load(); }
    catch (e: any) { setError(e?.message || 'Could not update partner status.'); }
    finally { setBusy(''); }
  }

  async function topUp(partner: Partner) {
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0 || !reference.trim()) { setError('Enter a positive whole RWF amount and a unique payment receipt/reference.'); return; }
    setBusy(partner.id); setError(''); setNotice('');
    try {
      const result = await api.post<any>(`/admin/food-delivery-partners/${partner.id}/top-ups`, { amount: value, reference: reference.trim() });
      setNotice(result.duplicate ? 'That payment reference was already processed; no second credit was made.' : `Credited ${fmt(value)} RWF to ${partner.name}.`);
      setAmount(''); setReference(''); setExpanded(''); await load();
    } catch (e: any) { setError(e?.message || 'Could not top up partner wallet.'); }
    finally { setBusy(''); }
  }

  async function rotate(partner: Partner) {
    if (!window.confirm(`Rotate the API key for ${partner.name}? The existing key stops working immediately.`)) return;
    setBusy(partner.id); setError(''); setNotice('');
    try { const result = await api.post<any>(`/admin/food-delivery-partners/${partner.id}/rotate-key`); setRevealedKey(result.apiKey || ''); setNotice('New API key generated. Copy it now and send it to the authorized business contact securely.'); }
    catch (e: any) { setError(e?.message || 'Could not rotate key.'); }
    finally { setBusy(''); }
  }

  async function copyKey() {
    try { await navigator.clipboard.writeText(revealedKey); setNotice('API key copied. Store it in the partner server secret manager.'); }
    catch { setError('Clipboard access was blocked. Select and copy the key manually.'); }
  }

  return <AdminShell>
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#00806A]">Partner operations</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Food delivery partners</h1><p className="mt-1 text-sm text-slate-500">Review business applications, activate integrations and manage prepaid RWF wallets.</p></div>
        <div className="flex gap-2"><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><RefreshCw size={14}/> Refresh</button><button onClick={()=>setShowCreate(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-[#00A082] px-4 py-2 text-xs font-bold text-white"><Plus size={15}/> Create API-only partner</button></div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15}/><span>{error}</span><button className="ml-auto" onClick={()=>setError('')}><X size={14}/></button></div>}
      {notice && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><Check size={15}/><span>{notice}</span><button className="ml-auto" onClick={()=>setNotice('')}><X size={14}/></button></div>}

      {revealedKey && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 text-sm font-bold text-amber-950"><KeyRound size={16}/> One-time API key reveal</div><p className="mt-1 text-xs text-amber-800">This is the only time the complete key is visible. Store it securely. Never share it in public chat, email or client-side code.</p><div className="mt-3 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white p-3 text-xs text-slate-800">{revealedKey}</code><button onClick={()=>void copyKey()} className="inline-flex items-center gap-2 rounded-lg bg-amber-900 px-3 py-3 text-xs font-bold text-white"><Copy size={13}/> Copy key</button><button onClick={()=>setRevealedKey('')} className="rounded-lg border border-amber-300 px-3 py-3 text-xs font-bold text-amber-900">Close</button></div></section>}

      {showCreate && <form onSubmit={createPartner} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="grid gap-1 text-xs font-semibold text-slate-600">Business / platform name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Example Food Platform" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#00A082]"/></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Contact email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ops@business.com" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#00A082]"/></label><button disabled={busy==='create'} className="h-10 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">{busy==='create'?'Creating…':'Create partner'}</button></form>}

      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total partners</p><p className="mt-2 text-2xl font-bold text-slate-900">{partners.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Awaiting review</p><p className="mt-2 text-2xl font-bold text-amber-600">{partners.filter(p=>p.status==='PENDING').length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active integrations</p><p className="mt-2 text-2xl font-bold text-[#00806A]">{partners.filter(p=>p.status==='ACTIVE').length}</p></div></div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold text-slate-900">Partner directory</h2><p className="mt-1 text-[10px] text-slate-400">Applications submitted at zanaride.rw/business and API-only integrations.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500">{partners.length} records</span></div>
        {loading?<div className="p-10 text-center text-xs text-slate-400">Loading partners…</div>:partners.length===0?<div className="p-10 text-center text-xs text-slate-400">No food delivery partners yet.</div>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-[9px] font-bold tracking-wider text-slate-400"><tr><th className="px-5 py-3">BUSINESS</th><th className="px-4 py-3">STATUS</th><th className="px-4 py-3">PREPAID BALANCE</th><th className="px-4 py-3">API KEY PREFIX</th><th className="px-4 py-3">CREATED</th><th className="px-5 py-3 text-right">ACTIONS</th></tr></thead><tbody>{partners.map(partner=><tr key={partner.id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="text-xs font-bold text-slate-800">{partner.name}</p><p className="mt-1 text-[10px] text-slate-400">{partner.contactEmail || 'No contact email'}</p></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${partner.status==='ACTIVE'?'bg-emerald-50 text-emerald-700':partner.status==='PENDING'?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-700'}`}>{partner.status}</span></td><td className="px-4 py-4 text-xs font-bold tabular-nums text-slate-800">{fmt(partner.balance)} RWF</td><td className="px-4 py-4 font-mono text-[10px] text-slate-500">{partner.apiKeyPrefix}••••</td><td className="px-4 py-4 text-[10px] text-slate-500">{new Date(partner.createdAt).toLocaleDateString()}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button disabled={!!busy} onClick={()=>{setExpanded(expanded===partner.id?'':partner.id);setAmount('');setReference('');}} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[9px] font-bold text-slate-600 disabled:opacity-40">Top up</button><button disabled={!!busy} onClick={()=>void rotate(partner)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[9px] font-bold text-slate-600 disabled:opacity-40">Rotate key</button>{partner.status==='ACTIVE'?<button disabled={!!busy} onClick={()=>void changeStatus(partner,'SUSPENDED')} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[9px] font-bold text-rose-700 disabled:opacity-40">Suspend</button>:<button disabled={!!busy} onClick={()=>void changeStatus(partner,'ACTIVE')} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[9px] font-bold text-emerald-700 disabled:opacity-40">Activate</button>}</div></td></tr>)}</tbody></table></div>}
      </section>
      {expanded && <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold"><Wallet size={16} className="text-[#00806A]"/> Prepaid wallet top-up</div><button onClick={()=>setExpanded('')}><X size={15}/></button></div><p className="mt-1 text-xs text-slate-500">Select the partner's verified payment receipt/reference. Reusing the same reference will not credit the wallet twice.</p><div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end"><label className="grid gap-1 text-xs font-semibold text-slate-600">Amount (RWF)<input inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="50000" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#00A082]"/></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Unique payment reference<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="PAYPACK-RECEIPT-123" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#00A082]"/></label><button disabled={!!busy} onClick={()=>{const p=partners.find(x=>x.id===expanded);if(p)void topUp(p);}} className="h-10 rounded-lg bg-[#00A082] px-4 text-xs font-bold text-white disabled:opacity-50">Credit wallet</button></div></section>}
      <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-[10px] leading-relaxed text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#00806A]"/><p>Admin actions are protected by the Zana admin JWT and role guard. API keys are stored as hashes and displayed only once at creation or rotation. Verify every wallet top-up against a settled payment before crediting it.</p></div>
    </div>
  </AdminShell>;
}
