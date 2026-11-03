'use client';

import { useState } from 'react';
import PasswordField from '../../components/PasswordField';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { login } from '../../lib/api/auth';
import { recoverActiveRide } from '../../lib/api/trips';
import { haptic } from '../../lib/haptics';
import { ApiError } from '../../lib/api/client';
import { useLang } from '../../lib/LangContext';
import { ArrowRight, ShieldCheck, MapPin, Eye, LockKeyhole } from 'lucide-react';

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = identifier.trim().length > 3 && password.length >= 6;

  const handleLogin = async () => {
    if (!valid || loading) return;
    setLoading(true); setError(null);
    try {
      await login(identifier.trim(), password);
      haptic('success');
      try {
        const activeRide = await recoverActiveRide();
        if (activeRide) {
          router.replace(activeRide.groupId ? `/tracking?groupId=${encodeURIComponent(activeRide.groupId)}` : `/tracking?tripId=${encodeURIComponent(activeRide.id)}`);
          return;
        }
      } catch { /* Home retries active-trip recovery when the network returns. */ }
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col lg:flex-row animate-fade-in">
      <section className="relative hidden lg:flex lg:w-[43%] min-h-screen overflow-hidden bg-[#062F2A] text-white p-12 flex-col justify-between">
        <div className="absolute -right-28 -top-24 w-[520px] h-[520px] rounded-full border border-white/10" />
        <div className="absolute -right-12 -top-10 w-[380px] h-[380px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <Image src="/zana-mark.png" alt="Zana" width={48} height={48} className="rounded-xl" />
          <span className="text-2xl font-black tracking-tight">zana</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-xs uppercase tracking-[.28em] text-[#FFC244] font-bold mb-5">MOVE KIGALI</p>
          <h1 className="text-5xl font-black leading-[1.08]">Your city.<br/>Your time.<br/><span className="text-[#FFC244]">Your Zana.</span></h1>
          <p className="text-white/65 mt-6 text-lg leading-relaxed">One account for rides, deliveries, food and everyday shopping.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-white/75"><span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><MapPin size={17}/></span>Moving Kigali forward, one trip at a time.</div>
        </div>
        <p className="relative text-xs text-white/40">Rides. Deliveries. Shopping.</p>
      </section>
      <section className="flex-1 flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-12 lg:mb-10">
            <Link href="/" className="flex items-center gap-2 lg:hidden"><Image src="/zana-mark.png" alt="Zana" width={38} height={38} className="rounded-xl"/><span className="font-black text-xl text-gray-900">zana</span></Link>
            <span className="ml-auto text-xs text-gray-500">New to Zana? <Link href="/signup" className="font-bold text-zana-primary hover:underline">Create account</Link></span>
          </div>
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#E3F5F1] text-zana-primary flex items-center justify-center mb-5"><LockKeyhole size={22}/></div>
            <p className="text-xs font-bold tracking-[.2em] uppercase text-zana-primary mb-2">WELCOME BACK</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-950">{t('Welcome back')}</h2>
            <p className="text-sm text-gray-500 mt-2">{t('Log in with your email or phone number.')}</p>
          </div>
          <form onSubmit={e => { e.preventDefault(); handleLogin(); }} className="space-y-5">
            <div>
              <label htmlFor="identifier" className="block text-xs font-bold text-gray-700 mb-2">Email or phone number</label>
              <input id="identifier" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="you@example.com or 07x xxx xxx" autoComplete="username" className="w-full h-14 rounded-2xl border border-gray-200 bg-gray-50/70 px-4 text-sm outline-none transition focus:border-zana-primary focus:bg-white focus:ring-4 focus:ring-zana-primary/10"/>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-gray-700">Password</label><Link href="/forgot-password" className="text-xs font-semibold text-zana-primary hover:underline">Forgot password?</Link></div>
              <PasswordField value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" className="w-full h-14 rounded-2xl border border-gray-200 bg-gray-50/70 px-4 text-sm outline-none transition focus:border-zana-primary focus:bg-white focus:ring-4 focus:ring-zana-primary/10" onKeyDown={e=>e.key==='Enter'&&valid&&handleLogin()}/>
            </div>
            {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <button type="submit" disabled={!valid||loading} className="w-full h-14 rounded-2xl bg-zana-primary text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 transition hover:bg-zana-primary-dark hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed">{loading?'Signing you in…':<>Log in <ArrowRight size={18}/></>}</button>
          </form>
          <div className="relative my-7 flex items-center"><div className="h-px bg-gray-100 flex-1"/><span className="px-4 text-[11px] text-gray-400 font-semibold uppercase tracking-wider">or continue with</span><div className="h-px bg-gray-100 flex-1"/></div>
          <button onClick={()=>router.push('/login-code')} className="w-full h-13 rounded-2xl border border-gray-200 py-4 text-sm font-bold text-gray-800 hover:border-zana-primary hover:bg-[#F5FBF9] transition">Sign in with a one-time code</button>
          <div className="mt-10 flex items-start gap-3 rounded-2xl bg-gray-50 p-4"><ShieldCheck size={18} className="text-zana-primary shrink-0 mt-0.5"/><p className="text-xs leading-relaxed text-gray-500">Your account is protected. Never share your password or verification code with anyone, including someone claiming to be Zana support.</p></div>
          <p className="text-center text-[11px] text-gray-400 mt-8">By continuing, you agree to our <Link href="/terms" className="underline hover:text-zana-primary">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-zana-primary">Privacy Policy</Link>.</p>
        </div>
      </section>
    </main>
  );
}
