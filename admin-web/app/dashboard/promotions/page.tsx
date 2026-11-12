'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { createPromoCode, getPromoCodes, updatePromoCodeStatus } from '../../../lib/api/admin';
import { getToken } from '../../../lib/api/client';

const blank = () => {
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 86400000);
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  return { code:'', name:'', description:'', serviceScope:'ALL', discountType:'PERCENT', discountValue:'15', maxDiscount:'', minSpend:'0', maxUses:'', perUserLimit:'1', fundingSource:'ZANA', creatorName:'', creatorHandle:'', startsAt:local(now), endsAt:local(later) };
};

export default function PromotionsAdminPage() {
  const [codes,setCodes]=useState<any[]>([]);
  const [form,setForm]=useState(blank());
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [isAdmin,setIsAdmin]=useState(false);
  const load=async()=>{try{setCodes(await getPromoCodes());}catch(e:any){setError(e?.message||'Could not load promo codes.');}};
  useEffect(()=>{try{const t=getToken();if(t){const p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));setIsAdmin(p.role==='ADMIN');}}catch{}load();},[]);
  const set=(key:string,value:string)=>setForm(v=>({...v,[key]:value}));
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');setSuccess('');try{await createPromoCode({...form,discountValue:Number(form.discountValue),maxDiscount:form.maxDiscount===''?null:Number(form.maxDiscount),minSpend:Number(form.minSpend),maxUses:form.maxUses===''?null:Number(form.maxUses),perUserLimit:Number(form.perUserLimit),startsAt:new Date(form.startsAt).toISOString(),endsAt:new Date(form.endsAt).toISOString()});setSuccess('Promo code created.');setForm(blank());setShow(false);await load();}catch(e:any){setError(e?.message||'Could not create promo code.');}finally{setBusy(false);}};
  const toggle=async(p:any)=>{setBusy(true);setError('');try{await updatePromoCodeStatus(p.id,p.status==='ACTIVE'?'PAUSED':'ACTIVE');await load();}catch(e:any){setError(e?.message||'Could not update code.');}finally{setBusy(false);}};
  const field=(label:string,key:keyof typeof form,type='text',hint='')=><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span><input required={['code','name','discountValue','startsAt','endsAt'].includes(key)} type={type} value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={hint} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#00A082]"/></label>;
  return <AdminShell><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#00806A]">Marketing & growth</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Promo codes</h1><p className="mt-2 text-sm text-slate-500">Create and manage discount campaigns across rides, food, deliveries and shopping.</p></div>{isAdmin&&<button onClick={()=>{setShow(v=>!v);setError('');setSuccess('');}} className="rounded-xl bg-[#00A082] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#008b70]">{show?'Close':'＋ Create promo code'}</button>}</div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success&&<p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    {show&&<form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="font-bold text-slate-900">New campaign</h2><p className="mt-1 text-xs text-slate-500">Set the discount, where it applies, campaign dates and who funds it.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{field('Promo code','code','text','e.g. ZANA20')}{field('Campaign name','name','text','Creator launch campaign')}
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Applies to</span><select value={form.serviceScope} onChange={e=>set('serviceScope',e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="ALL">All services</option><option value="RIDES">Rides</option><option value="FOOD">Food</option><option value="DELIVERIES">Deliveries</option><option value="SHOPPING">Shopping</option></select></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Discount type</span><select value={form.discountType} onChange={e=>set('discountType',e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="PERCENT">Percentage (%)</option><option value="FIXED">Fixed amount (RWF)</option></select></label>
        {field('Discount value','discountValue','number')}{field('Maximum discount (RWF)','maxDiscount','number','No cap')}{field('Minimum spend (RWF)','minSpend','number')}{field('Total redemptions limit','maxUses','number','Unlimited')}{field('Limit per customer','perUserLimit','number')}
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Who funds the discount?</span><select value={form.fundingSource} onChange={e=>set('fundingSource',e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="ZANA">Zana</option><option value="MERCHANT">Merchant</option><option value="PARTNER">Partner / creator</option><option value="SHARED">Shared funding</option></select></label>
        {field('Starts at','startsAt','datetime-local')}{field('Ends at','endsAt','datetime-local')}{field('Creator / partner name','creatorName','text','Optional')}{field('Creator social handle','creatorHandle','text','@username')}
      </div>
      {field('Description','description','text','Campaign purpose or internal note')}
      <div className="flex justify-end gap-2"><button type="button" onClick={()=>setShow(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={busy} className="rounded-xl bg-[#00A082] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?'Creating…':'Create campaign'}</button></div>
    </form>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:'Campaigns',value:codes.length},{label:'Active',value:codes.filter(p=>p.status==='ACTIVE'&&new Date(p.endsAt)>new Date()).length},{label:'Paused',value:codes.filter(p=>p.status==='PAUSED').length},{label:'Recorded redemptions',value:codes.reduce((s,p)=>s+(p.usageCount||0),0)}].map(x=><div key={x.label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{x.label}</p><p className="mt-1 text-2xl font-black text-slate-900">{x.value}</p></div>)}</div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4"><h2 className="font-bold text-slate-900">All promo codes</h2><p className="mt-1 text-xs text-slate-500">Pause a campaign at any time. Expired campaigns are automatically treated as unavailable by date.</p></div>
      {codes.length===0?<p className="p-8 text-center text-sm text-slate-500">No promo codes created yet.</p>:<div className="divide-y divide-slate-100">{codes.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-black tracking-wider text-slate-900">{p.code}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${p.status==='ACTIVE'?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{p.status}</span></div><p className="mt-1 text-sm font-semibold text-slate-800">{p.name}</p><p className="mt-1 text-xs text-slate-500">{p.serviceScope} · {p.discountType==='PERCENT'?p.discountValue+'%':Number(p.discountValue).toLocaleString()+' RWF'} · {p.fundingSource} funded · {p.usageCount}/{p.maxUses??'∞'} uses</p><p className="mt-1 text-[11px] text-slate-400">{new Date(p.startsAt).toLocaleString()} – {new Date(p.endsAt).toLocaleString()}{p.creatorHandle?' · '+p.creatorHandle:''}</p></div>{isAdmin&&<button disabled={busy} onClick={()=>toggle(p)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">{p.status==='ACTIVE'?'Pause':'Activate'}</button>}</div>)}</div>}
    </section>
  </div></AdminShell>;
}
