'use client';

import { FormEvent, useState } from 'react';

const API = 'https://zana.ajumalink.com/api/v1/rider-registration';
const initial = { fullName: '', phone: '', email: '', vehicleType: '', powerType: '', location: '' };

export default function RiderFormPage() {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues(v => ({ ...v, [e.target.name]: e.target.value }));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setSuccess(false); setError('');
    try {
      const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'We could not submit your registration. Please try again.');
      setValues(initial); setSuccess(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Connection error. Please try again.'); }
    finally { setBusy(false); }
  }
  const field = 'w-full rounded-xl border border-[#cbd7cf] bg-white px-4 py-3 text-base text-[#17231f] outline-none transition focus:border-[#00a082] focus:ring-2 focus:ring-[#00a082]/15';
  return <main style={{ minHeight: '100vh', background: '#f3f6f4', color: '#17231f', fontFamily: 'Archivo,system-ui,sans-serif', padding: '28px 16px 48px' }}>
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <a href="/" aria-label="Zana home" style={{ color: '#087e66', fontSize: 14, fontWeight: 900, letterSpacing: '.17em', textDecoration: 'none' }}>ZANA <span style={{ color: '#77857d', letterSpacing: '.05em', fontWeight: 600 }}>RIDER NETWORK</span></a>
      <section style={{ margin: '18px 0 20px', padding: 'clamp(24px,5vw,38px)', borderRadius: 24, background: '#092d25', color: '#f4faf6', overflow: 'hidden', position: 'relative' }}>
        <span style={{ display: 'inline-block', background: '#d9f7e7', color: '#14583e', borderRadius: 99, padding: '5px 11px', fontSize: 12, fontWeight: 800, letterSpacing: '.06em' }}>RIDER SIGN-UP · RWANDA</span>
        <h1 style={{ fontSize: 'clamp(34px,7vw,48px)', lineHeight: 1.04, letterSpacing: '-.04em', fontWeight: 850, margin: '18px 0 12px' }}>Let’s move Rwanda forward.</h1>
        <p style={{ color: '#c4d8cf', fontSize: 16, lineHeight: 1.65, maxWidth: 480 }}>Have a motorcycle, car or bicycle? Register your interest in joining the Zana rider network. Our team will contact you about the next steps.</p>
      </section>
      <form onSubmit={submit} className="space-y-5" style={{ background: '#fff', border: '1px solid #e0e9e3', borderRadius: 22, padding: 'clamp(18px,4vw,28px)', boxShadow: '0 14px 42px #173b2810' }}>
        <div><h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.025em' }}>Your details</h2><p style={{ color: '#68776f', fontSize: 13, marginTop: 3 }}>Fields marked * are required.</p></div>
        <div><label htmlFor="fullName" className="mb-2 block text-sm font-bold">Full name *</label><input className={field} id="fullName" name="fullName" autoComplete="name" maxLength={100} required value={values.fullName} onChange={change} placeholder="Enter your full name" /></div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2"><div><label htmlFor="phone" className="mb-2 block text-sm font-bold">Phone number *</label><input className={field} id="phone" name="phone" type="tel" autoComplete="tel" maxLength={25} required value={values.phone} onChange={change} placeholder="e.g. +250 7xx xxx xxx" /></div><div><label htmlFor="email" className="mb-2 block text-sm font-bold">Email address</label><input className={field} id="email" name="email" type="email" autoComplete="email" maxLength={150} value={values.email} onChange={change} placeholder="you@example.com" /></div></div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2"><div><label htmlFor="vehicleType" className="mb-2 block text-sm font-bold">Vehicle type *</label><select className={field} id="vehicleType" name="vehicleType" required value={values.vehicleType} onChange={change}><option value="">Choose vehicle</option><option>Motorcycle</option><option>Bicycle</option><option>Car</option><option>Other</option></select></div><div><label htmlFor="powerType" className="mb-2 block text-sm font-bold">Motor / energy type *</label><select className={field} id="powerType" name="powerType" required value={values.powerType} onChange={change}><option value="">Choose type</option><option>Electric</option><option>Petrol</option><option>Not applicable</option><option>Other</option></select></div></div>
        <div><label htmlFor="location" className="mb-2 block text-sm font-bold">Current location in Rwanda *</label><input className={field} id="location" name="location" maxLength={150} required value={values.location} onChange={change} placeholder="e.g. Kigali, Gasabo" /></div>
        <p style={{ color: '#68776f', fontSize: 13, lineHeight: 1.55 }}>Your information will be used by the Zana recruitment team to follow up on your registration. Registration does not automatically approve or activate a rider account.</p>
        {success && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Registration received. Thank you — the Zana team will contact you.</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        <button type="submit" disabled={busy} className="w-full rounded-xl px-5 py-4 text-base font-extrabold text-white transition disabled:cursor-wait disabled:opacity-60" style={{ background: '#00a082' }}>{busy ? 'Submitting registration…' : 'Submit registration'}</button>
      </form>
      <p style={{ textAlign: 'center', color: '#738077', fontSize: 12, marginTop: 18 }}>Zana Rider Recruitment · Rwanda</p>
    </div>
  </main>;
}
