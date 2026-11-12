'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { getMerchantPromotions, getMerchants, reviewMerchantPromotion, setMerchantPromotionExemption } from '../../../lib/api/admin';
import { getToken } from '../../../lib/api/client';

export default function MerchantPromotionsAdminPage() {
  const [promotions,setPromotions]=useState<any[]>([]);
  const [merchants,setMerchants]=useState<any[]>([]);
  const [isAdmin,setIsAdmin]=useState(false);
  const [reason,setReason]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const load=async()=>{try{const [p,m]=await Promise.all([getMerchantPromotions(),getMerchants()]);setPromotions(p);setMerchants(m);}catch(e:any){setError(e?.message||'Could not load promotions.');}};
  useEffect(()=>{try{const t=getToken();if(t){const payload=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));setIsAdmin(payload.role==='ADMIN');}}catch{} load();},[]);
  const review=async(id:string,status:string)=>{setBusy(id);setError('');try{await reviewMerchantPromotion(id,status,reason[id]);await load();}catch(e:any){setError(e?.message||'Could not update promotion.');}finally{setBusy('');}};
  const exemption=async(m:any,exempt:boolean)=>{setBusy(m.id);setError('');try{await setMerchantPromotionExemption(m.id,exempt,reason[m.id]);await load();}catch(e:any){setError(e?.message||'Could not update exemption.');}finally{setBusy('');}};
  return <AdminShell><div className="mx-auto max-w-6xl space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#00806A]">Commerce controls</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Combo promotions</h1><p className="mt-2 text-sm text-slate-500">Review merchant bundles and manage monthly promotion exemptions.</p></div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-bold text-slate-900">Promotion submissions</h2>
      {promotions.length===0?<p className="py-6 text-sm text-slate-500">No combo promotions submitted.</p>:<div className="space-y-3">{promotions.map(p=><article key={p.id} className="rounded-xl border border-slate-100 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{p.title}</h3><p className="mt-1 text-sm text-slate-600">{p.merchant?.businessName}</p><p className="mt-1 text-xs text-slate-500">{(p.items||[]).map((i:any)=>i.product?.name).join(' + ')}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{p.status}</span></div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600"><b>{Number(p.comboPrice).toLocaleString()} RWF combo</b><span>{new Date(p.startsAt).toLocaleString()} – {new Date(p.endsAt).toLocaleString()}</span></div>
        {p.status==='PENDING'&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={!!busy} onClick={()=>review(p.id,'APPROVED')} className="rounded-lg bg-[#00A082] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button><button disabled={!!busy} onClick={()=>review(p.id,'REJECTED')} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Reject</button></div>}
      </article>)}</div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-1 font-bold text-slate-900">Merchant promotion exemptions</h2><p className="mb-4 text-xs text-slate-500">Exempt merchants are not subject to the standard seven-day monthly promotion allowance. Every grant or revocation is audited.</p>
      <div className="space-y-3">{merchants.map(m=><div key={m.id} className="rounded-xl border border-slate-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-slate-900">{m.businessName}</p><p className="text-xs text-slate-500">{m.user?.email||m.user?.phone||'No contact details'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${m.promoExempt?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{m.promoExempt?'Exempt':'Standard limit'}</span></div>
        {m.promoExemptionReason&&<p className="mt-2 text-xs text-slate-500">Reason: {m.promoExemptionReason}</p>}
        {isAdmin&&<div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={reason[m.id]||''} onChange={e=>setReason(v=>({...v,[m.id]:e.target.value}))} placeholder={m.promoExempt?'Reason for revoking (optional)':'Reason for exemption (required)'} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"/><button disabled={!!busy||(!m.promoExempt&&(reason[m.id]||'').trim().length<5)} onClick={()=>exemption(m,!m.promoExempt)} className={`rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-40 ${m.promoExempt?'bg-slate-700':'bg-[#00A082]'}`}>{m.promoExempt?'Revoke exemption':'Grant exemption'}</button></div>}
      </div>)}</div>
    </section>
  </div></AdminShell>;
}
