'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Loader2, MapPin, Store } from 'lucide-react';
import { api, setToken } from '../../lib/api/client';

type FormState = { businessName: string; contactName: string; email: string; password: string; phone: string; whatsappPhone: string; category: 'FOOD' | 'GIFTS' | 'GOODS'; branch: string; businessAddress: string };

function RegisterContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [form, setForm] = useState<FormState>({ businessName: '', contactName: '', email: '', password: '', phone: '', whatsappPhone: '', category: 'FOOD', branch: '', businessAddress: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const update = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = { ...form, whatsappPhone: form.whatsappPhone.trim() || form.phone };
      const result = token
        ? await api.post<{ token: string }>('/auth/register-merchant', { ...payload, token })
        : await api.post<{ token: string }>('/auth/register-merchant-public', payload);
      setToken(result.token);
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'We could not create your account. Please try again.');
    } finally { setLoading(false); }
  };

  if (submitted) return <main className="min-h-screen bg-[#f6f8f4] px-5 py-12 flex items-center justify-center"><div className="w-full max-w-lg rounded-[28px] bg-white p-8 sm:p-10 shadow-xl text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e2f5ee] text-[#008f73]"><CheckCircle2 size={34} /></div><p className="text-xs font-bold tracking-[.22em] text-[#008f73]">APPLICATION RECEIVED</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#10221d]">Your business is on its way.</h1><p className="mt-3 leading-7 text-gray-600">Your Zana merchant account has been created. Our team will review your business before your shop goes live. Keep an eye on your email or phone for updates.</p><button onClick={() => router.push('/')} className="mt-7 inline-flex items-center justify-center gap-3 rounded-full bg-[#00a082] px-6 py-3 font-semibold text-white hover:bg-[#087d68]">Continue to merchant space <ArrowRight size={17} /></button></div></main>;

  const field = 'mt-2 w-full rounded-xl border border-[#dce5df] bg-white px-4 py-3 text-sm text-[#10221d] outline-none transition placeholder:text-[#9aa7a0] focus:border-[#00a082] focus:ring-4 focus:ring-[#00a082]/10';
  const label = 'block text-sm font-semibold text-[#30433a]';
  const categories = [{ value: 'FOOD', title: 'Food & drink', note: 'Restaurants' }, { value: 'GOODS', title: 'Shop & goods', note: 'Products' }, { value: 'GIFTS', title: 'Gifts', note: 'Flowers & more' }];

  return <main className="min-h-screen bg-[#f6f8f4] text-[#10221d]"><div className="mx-auto grid min-h-screen max-w-6xl items-stretch lg:grid-cols-[.85fr_1.15fr]">
    <aside className="relative hidden overflow-hidden bg-[#102b23] p-10 text-white lg:flex lg:flex-col lg:justify-between"><div className="absolute -right-24 top-28 h-80 w-80 rounded-full border border-white/10" /><div className="absolute -right-10 top-44 h-52 w-52 rounded-full border border-[#ffc244]/50" /><a href="https://zanaride.rw" className="relative flex items-center gap-3 text-2xl font-extrabold tracking-tight"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#00a082]"><Store size={22} /></span>zana<span className="text-[#ffc244]">.</span></a><div className="relative max-w-md pb-12"><p className="mb-5 text-xs font-bold tracking-[.24em] text-[#ffc244]">YOUR BUSINESS, IN MOTION</p><h1 className="text-5xl font-bold leading-[1.04] tracking-[-.055em]">More people.<br />More orders.<br /><span className="text-[#57d8b6]">Your next chapter.</span></h1><p className="mt-6 max-w-sm text-base leading-7 text-white/70">Bring your restaurant, shop or local brand closer to customers across Kigali. Start with your details — we’ll help with the rest.</p><div className="mt-10 space-y-4 text-sm text-white/85"><p><span className="mr-3 text-[#ffc244]">01</span>Create your business profile in minutes</p><p><span className="mr-3 text-[#ffc244]">02</span>Add products after your account is approved</p><p><span className="mr-3 text-[#ffc244]">03</span>Receive orders and arrange Zana delivery</p></div></div><p className="relative text-xs text-white/45">Made for Kigali, Rwanda · Zana Business</p></aside>
    <section className="px-5 py-8 sm:px-10 lg:px-14 lg:py-12"><div className="mx-auto max-w-xl"><a href="https://zanaride.rw" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-[#087d68] lg:hidden"><Store size={19} /> zana<span className="text-[#ffc244]">.</span></a><div className="mb-8"><p className="text-xs font-bold tracking-[.2em] text-[#008f73]">SELL WITH ZANA</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Let’s get your business listed.</h2><p className="mt-3 leading-6 text-gray-600">No invite needed. Tell us about your business and submit it for review.</p></div>
    <form onSubmit={handleRegister} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><label className={label}>Business name *<input className={field} value={form.businessName} onChange={e => update('businessName', e.target.value)} placeholder="e.g. Kigali Fresh Kitchen" required maxLength={120} autoComplete="organization" /></label><label className={label}>Your name<input className={field} value={form.contactName} onChange={e => update('contactName', e.target.value)} placeholder="Owner or manager" autoComplete="name" /></label></div>
    <div><span className={label}>What do you sell? *</span><div className="mt-2 grid grid-cols-3 gap-2">{categories.map(option => <button key={option.value} type="button" onClick={() => update('category', option.value)} className={`rounded-xl border p-3 text-left transition ${form.category === option.value ? 'border-[#00a082] bg-[#e7f6f1] ring-2 ring-[#00a082]/10' : 'border-[#dce5df] bg-white hover:border-[#a9c8bb]'}`}><span className="block text-sm font-bold">{option.title}</span><span className="mt-1 block text-[11px] font-normal text-gray-500">{option.note}</span></button>)}</div></div>
    <div className="grid gap-5 sm:grid-cols-2"><label className={label}>Business phone *<input className={field} value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+250 7XX XXX XXX" required type="tel" autoComplete="tel" /></label><label className={label}>WhatsApp number<input className={field} value={form.whatsappPhone} onChange={e => update('whatsappPhone', e.target.value)} placeholder="Same as business phone" type="tel" /></label></div>
    <label className={label}>Email address *<input className={field} value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@yourbusiness.com" required type="email" autoComplete="email" /></label>
    <div className="grid gap-5 sm:grid-cols-2"><label className={label}>Password *<input className={field} value={form.password} onChange={e => update('password', e.target.value)} placeholder="At least 8 characters" required type="password" minLength={8} autoComplete="new-password" /></label><label className={label}>Branch / outlet<input className={field} value={form.branch} onChange={e => update('branch', e.target.value)} placeholder="e.g. Kimihurura" /></label></div>
    <label className={label}><span className="inline-flex items-center gap-2">Business location <MapPin size={15} className="text-[#00a082]" /></span><input className={field} value={form.businessAddress} onChange={e => update('businessAddress', e.target.value)} placeholder="Street, neighbourhood, Kigali" autoComplete="street-address" /></label>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-full bg-[#00a082] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-[#00a082]/15 transition hover:-translate-y-0.5 hover:bg-[#087d68] disabled:cursor-not-allowed disabled:opacity-60">{loading ? <Loader2 size={17} className="animate-spin" /> : null}{loading ? 'Submitting your business…' : 'Create my business account'}{!loading ? <ArrowRight size={17} /> : null}</button><p className="text-center text-xs leading-5 text-gray-500">By registering, you agree that Zana may contact you about your application. Your shop stays pending until our team approves it.</p></form><p className="mt-7 text-center text-sm text-gray-500">Already registered? <a href="/login" className="font-bold text-[#087d68] hover:underline">Sign in</a></p></div></section></div></main>;
}

export default function RegisterPage() { return <Suspense fallback={<div className="min-h-screen bg-[#f6f8f4]" />}><RegisterContent /></Suspense>; }
