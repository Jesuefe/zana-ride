'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api/client';

export default function ChangePasswordPage() {
  const router=useRouter();
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [done,setDone]=useState(false);
  const submit=async()=>{
    setError('');
    if(newPassword.length<8){setError('Use at least 8 characters for your new password.');return;}
    if(newPassword!==confirmPassword){setError('The new passwords do not match.');return;}
    setBusy(true);
    try{await api.post('/auth/password/change',{currentPassword,newPassword});setDone(true);setTimeout(()=>router.replace('/'),900);}
    catch(e:any){setError(e?.message||'Could not change your password.');}
    finally{setBusy(false);}
  };
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#00A082]"><LockKeyhole size={22}/></div>
    <p className="text-xs font-bold uppercase tracking-widest text-[#00806A]">Merchant account</p>
    <h1 className="mt-2 text-2xl font-bold text-slate-900">Change your password</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">For your account security, replace your temporary password with a private password only you know.</p>
    <div className="mt-6 space-y-3">
      <input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} placeholder="Temporary / current password" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"/>
      <input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password (8+ characters)" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"/>
      <input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"/>
    </div>
    {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {done&&<p role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><ShieldCheck size={16}/> Password updated successfully.</p>}
    <button onClick={submit} disabled={busy||done||!currentPassword||!newPassword||!confirmPassword} className="mt-5 w-full rounded-xl bg-[#00A082] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-40">{busy?'Updating…':'Update password'}</button>
  </section></main>;
}
