'use client';

import { useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { createAssistedDriver, createAssistedMerchant } from '../../../lib/api/admin';

type AccountType = 'DRIVER' | 'MERCHANT';
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-[#00A082]';

export default function AssistedOnboardingPage() {
  const [type,setType]=useState<AccountType>('DRIVER');
  const [form,setForm]=useState({email:'',phone:'',firstName:'',lastName:'',vehicle:'',plate:'',serviceType:'BIKE',driverMode:'BOTH',businessName:'',category:'GOODS',branch:'',whatsappPhone:''});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<any>(null);
  const set=(key:string,value:string)=>setForm(v=>({...v,[key]:value}));
  const submit=async()=>{
    setSaving(true);setError('');setResult(null);
    try {
      const response=type==='DRIVER'
        ? await createAssistedDriver({email:form.email,phone:form.phone,firstName:form.firstName,lastName:form.lastName,vehicle:form.vehicle,plate:form.plate,serviceType:form.serviceType,driverMode:form.driverMode})
        : await createAssistedMerchant({email:form.email,phone:form.phone,firstName:form.firstName,lastName:form.lastName,businessName:form.businessName,category:form.category,branch:form.branch,whatsappPhone:form.whatsappPhone});
      setResult(response);
      setForm({email:'',phone:'',firstName:'',lastName:'',vehicle:'',plate:'',serviceType:'BIKE',driverMode:'BOTH',businessName:'',category:'GOODS',branch:'',whatsappPhone:''});
    } catch(e:any) { setError(e?.message||'Account could not be created.'); }
    finally { setSaving(false); }
  };
  return <AdminShell><div className="mx-auto max-w-3xl space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#00806A]">People & partners</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Assisted onboarding</h1><p className="mt-2 text-sm text-slate-500">Register a driver or merchant while helping them in person. Zana generates a temporary password and emails it to their address.</p></div>
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
      {(['DRIVER','MERCHANT'] as const).map(v=><button key={v} onClick={()=>{setType(v);setError('');setResult(null);}} className={`rounded-xl px-4 py-3 text-sm font-bold ${type===v?'bg-white text-[#00806A] shadow-sm':'text-slate-500'}`}>{v==='DRIVER'?'Driver account':'Merchant account'}</button>)}
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-slate-900">Personal and login details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="First name" value={form.firstName} onChange={e=>set('firstName',e.target.value)}/>
        <input className={field} placeholder="Last name (optional)" value={form.lastName} onChange={e=>set('lastName',e.target.value)}/>
        <input className={field} placeholder="Email address" type="email" value={form.email} onChange={e=>set('email',e.target.value)}/>
        <input className={field} placeholder="Phone with country code" value={form.phone} onChange={e=>set('phone',e.target.value)}/>
      </div>
      {type==='DRIVER'?<div className="mt-5 space-y-3"><h2 className="text-sm font-bold text-slate-900">Driver and vehicle details</h2><div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Vehicle make / model" value={form.vehicle} onChange={e=>set('vehicle',e.target.value)}/>
        <input className={field} placeholder="Registration plate" value={form.plate} onChange={e=>set('plate',e.target.value.toUpperCase())}/>
        <select className={field} value={form.serviceType} onChange={e=>set('serviceType',e.target.value)}><option value="BIKE">Motorcycle</option><option value="ECONOMY">Economy car</option><option value="COMFORT">Comfort car</option></select>
        <select className={field} value={form.driverMode} onChange={e=>set('driverMode',e.target.value)}><option value="BOTH">Rides and deliveries</option><option value="RIDES">Rides only</option><option value="DELIVERIES">Deliveries only</option></select>
      </div></div>:<div className="mt-5 space-y-3"><h2 className="text-sm font-bold text-slate-900">Business details</h2><div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Business name" value={form.businessName} onChange={e=>set('businessName',e.target.value)}/>
        <select className={field} value={form.category} onChange={e=>set('category',e.target.value)}><option value="GOODS">General goods</option><option value="FOOD">Food & drinks</option><option value="GIFTS">Gifts</option></select>
        <input className={field} placeholder="Branch (optional)" value={form.branch} onChange={e=>set('branch',e.target.value)}/>
        <input className={field} placeholder="WhatsApp phone (optional)" value={form.whatsappPhone} onChange={e=>set('whatsappPhone',e.target.value)}/>
      </div></div>}
      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">The account will be created as pending approval. The temporary password is emailed directly to the account holder and must be changed at first login. Staff cannot view or retrieve the password.</div>
      {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {result&&<div role="status" className={`mt-4 rounded-xl p-4 text-sm ${result.emailSent?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-900'}`}><p className="font-bold">{result.emailSent?'Account created and email sent':'Account created, but email was not delivered'}</p><p className="mt-1">{result.message}</p><p className="mt-1 text-xs">Account reference: {result.accountId}</p></div>}
      <button onClick={submit} disabled={saving||!form.email||!form.phone||!form.firstName||(type==='DRIVER'?(!form.vehicle||!form.plate):!form.businessName)} className="mt-5 w-full rounded-xl bg-[#00A082] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40">{saving?'Creating account…':`Create ${type==='DRIVER'?'driver':'merchant'} account and email credentials`}</button>
    </section>
  </div></AdminShell>;
}
