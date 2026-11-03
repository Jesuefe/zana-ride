'use client';

import { useState } from 'react';
import PasswordField from '../../components/PasswordField';
import CountryCodePicker from '../../components/CountryCodePicker';
import { DEFAULT_COUNTRY, Country } from '../../lib/countries';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, ShieldCheck, UserRound, CheckCircle2 } from 'lucide-react';
import { register } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { useLang } from '../../lib/LangContext';

export default function SignupPage() {
  const { t } = useLang();
  const router = useRouter();
  const [firstName,setFirstName]=useState(''); const [lastName,setLastName]=useState('');
  const [email,setEmail]=useState(''); const [phone,setPhone]=useState('');
  const [country,setCountry]=useState<Country>(DEFAULT_COUNTRY); const [password,setPassword]=useState('');
  const [accepted,setAccepted]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState<string|null>(null);
  const valid=!!(firstName.trim()&&lastName.trim()&&/\S+@\S+\.\S+/.test(email)&&phone.replace(/\D/g,'').length>=country.minDigits&&phone.replace(/\D/g,'').length<=country.maxDigits&&password.length>=6&&accepted);
  const handleSignup=async()=>{
    if(!valid||loading)return; setLoading(true);setError(null);
    try{
      const fullPhone=`+${country.dial}${phone.replace(/\D/g,'')}`;
      await register({firstName:firstName.trim(),lastName:lastName.trim(),email:email.trim(),phone:fullPhone,password});
      router.push(`/verify?phone=${encodeURIComponent(fullPhone)}&email=${encodeURIComponent(email.trim())}`);
    }catch(err){setError(err instanceof ApiError?err.message:'Could not reach the server. Please try again.');}
    finally{setLoading(false);}
  };
  return <main className="min-h-screen bg-white flex flex-col lg:flex-row animate-fade-in">
    <section className="hidden lg:flex lg:w-[40%] min-h-screen bg-[#062F2A] text-white p-12 flex-col justify-between relative overflow-hidden">
      <div className="absolute -right-32 bottom-0 w-[520px] h-[520px] rounded-full border border-white/10"/><div className="relative flex items-center gap-3"><Image src="/zana-mark.png" alt="Zana" width={48} height={48} className="rounded-xl"/><span className="text-2xl font-black">zana</span></div>
      <div className="relative"><p className="text-xs tracking-[.25em] text-[#FFC244] font-bold mb-5">MOVE KIGALI</p><h1 className="text-5xl font-black leading-tight">A better way<br/>to move starts<br/><span className="text-[#FFC244]">right here.</span></h1><p className="text-white/65 mt-6 leading-relaxed max-w-sm">Create your account and bring rides, deliveries and shopping together in one place.</p><div className="mt-10 space-y-4 text-sm text-white/80"><p className="flex items-center gap-3"><CheckCircle2 className="text-[#FFC244]" size={18}/> Quick account setup</p><p className="flex items-center gap-3"><CheckCircle2 className="text-[#FFC244]" size={18}/> Secure phone verification</p><p className="flex items-center gap-3"><CheckCircle2 className="text-[#FFC244]" size={18}/> One account across Zana services</p></div></div>
      <p className="relative text-xs text-white/40">Rides. Deliveries. Shopping.</p>
    </section>
    <section className="flex-1 flex justify-center px-6 py-8 sm:px-10"><div className="w-full max-w-lg">
      <div className="flex items-center justify-between mb-8"><button onClick={()=>router.back()} className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50" aria-label="Go back"><ArrowLeft size={18}/></button><span className="text-xs text-gray-500">Already a member? <Link href="/login" className="font-bold text-zana-primary">Log in</Link></span></div>
      <div className="mb-7"><div className="w-12 h-12 rounded-2xl bg-[#E3F5F1] text-zana-primary flex items-center justify-center mb-4"><UserRound size={22}/></div><p className="text-xs uppercase tracking-[.2em] text-zana-primary font-bold mb-2">GET STARTED</p><h2 className="text-3xl font-black text-gray-950">{t('Create your account')}</h2><p className="text-sm text-gray-500 mt-2">{t('Just the basics to get you moving.')}</p><div className="flex gap-1.5 mt-5"><span className="h-1.5 rounded-full bg-zana-primary flex-1"/><span className="h-1.5 rounded-full bg-gray-100 flex-1"/><span className="h-1.5 rounded-full bg-gray-100 flex-1"/></div><p className="text-[11px] text-gray-400 mt-2">Your details · Verification · Ready to go</p></div>
      <form onSubmit={e=>{e.preventDefault();handleSignup();}} className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-gray-700 mb-2">First name</label><input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name" className="w-full h-13 rounded-xl border border-gray-200 bg-gray-50/70 px-3 text-sm outline-none focus:border-zana-primary focus:ring-4 focus:ring-zana-primary/10"/></div><div><label className="block text-xs font-bold text-gray-700 mb-2">Last name</label><input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Last name" autoComplete="family-name" className="w-full h-13 rounded-xl border border-gray-200 bg-gray-50/70 px-3 text-sm outline-none focus:border-zana-primary focus:ring-4 focus:ring-zana-primary/10"/></div></div>
        <div><label className="block text-xs font-bold text-gray-700 mb-2">Email address</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="w-full h-13 rounded-xl border border-gray-200 bg-gray-50/70 px-4 text-sm outline-none focus:border-zana-primary focus:ring-4 focus:ring-zana-primary/10"/></div>
        <div><label className="block text-xs font-bold text-gray-700 mb-2">Phone number</label><div className="flex gap-2 h-[52px]"><CountryCodePicker value={country} onChange={setCountry}/><input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,country.maxDigits))} placeholder="788 123 456" inputMode="numeric" autoComplete="tel-national" className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50/70 px-4 text-sm outline-none focus:border-zana-primary focus:ring-4 focus:ring-zana-primary/10"/></div><p className="text-[11px] text-gray-400 mt-1.5">We’ll use this number to verify your account.</p></div>
        <div><label className="block text-xs font-bold text-gray-700 mb-2">Create password</label><PasswordField value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" className="w-full h-13 rounded-xl border border-gray-200 bg-gray-50/70 px-4 text-sm outline-none focus:border-zana-primary focus:ring-4 focus:ring-zana-primary/10" onKeyDown={e=>e.key==='Enter'&&valid&&handleSignup()}/><p className="text-[11px] text-gray-400 mt-1.5">Use at least 6 characters. A longer, unique password is safer.</p></div>
        <label className="flex items-start gap-3 pt-1 cursor-pointer"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#00A082]"/><span className="text-xs leading-relaxed text-gray-500">I agree to the <Link href="/terms" className="text-zana-primary font-semibold underline" onClick={e=>e.stopPropagation()}>Terms of Service</Link> and acknowledge the <Link href="/privacy" className="text-zana-primary font-semibold underline" onClick={e=>e.stopPropagation()}>Privacy Policy</Link>.</span></label>
        {error&&<p role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={!valid||loading} className="w-full h-14 rounded-2xl bg-zana-primary text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 transition hover:bg-zana-primary-dark hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed">{loading?'Creating your account…':<>Create account <ArrowRight size={18}/></>}</button>
      </form>
      <div className="flex items-center justify-center gap-2 mt-6 text-[11px] text-gray-400"><ShieldCheck size={14} className="text-zana-primary"/> Your details are protected and used to set up your Zana account.</div>
    </div></section>
  </main>;
}
