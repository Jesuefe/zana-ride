'use client';

import { FormEvent, useState } from 'react';

const API = 'https://zana.ajumalink.com/api/v1/rider-registration';
const initial = { fullName: '', phone: '', email: '', vehicleType: '', powerType: '', location: '' };

export default function RiderFormPage() {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues(v => ({ ...v, [e.target.name]: e.target.value }));
    setSuccess(false);
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setSuccess(false); setError('');
    try {
      const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'We could not submit your registration. Please try again.');
      setValues(initial); setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error. Please try again.');
    } finally { setBusy(false); }
  }

  const field = 'rider-field';
  return (
    <main className="rider-page">
      <div className="rider-wrap">
        <header className="rider-header">
          <a href="/" className="rider-wordmark" aria-label="Zana home"><span className="brand-mark">z</span><span>ZANA<span className="brand-sub">RIDER NETWORK</span></span></a>
          <span className="header-chip"><span className="live-dot" /> RECRUITMENT · RWANDA</span>
        </header>

        <section className="rider-hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> YOUR NEXT RIDE STARTS HERE</p>
            <h1>Move your<br /><em>future forward.</em></h1>
            <p className="hero-intro">Own a motorcycle, car or bicycle? Tell us a little about yourself and our team will get in touch about joining the Zana rider network.</p>
            <div className="hero-points">
              <span><b>01</b> Quick registration</span>
              <span><b>02</b> Team follow-up</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-ring ring-one" /><div className="art-ring ring-two" />
            <div className="art-card"><span className="art-icon">↗</span><span className="art-card-label">ON THE MOVE</span><strong>Good things<br />are in motion.</strong><span className="art-line" /></div>
            <span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✳</span>
          </div>
        </section>

        <section className="form-section">
          <div className="form-heading"><div><p className="section-kicker">LET’S GET TO KNOW YOU</p><h2>Register your interest</h2><p className="section-copy">Complete the form below. It only takes a minute.</p></div><div className="step-count"><span>STEP</span><strong>01 <i>/ 01</i></strong></div></div>
          <form onSubmit={submit} className="rider-form">
            <div className="field-block"><label htmlFor="fullName">Full name <span>*</span></label><input className={field} id="fullName" name="fullName" autoComplete="name" maxLength={100} required value={values.fullName} onChange={change} placeholder="e.g. Jean Uwimana" /></div>
            <div className="field-block"><label htmlFor="phone">Phone number <span>*</span></label><input className={field} id="phone" name="phone" type="tel" autoComplete="tel" maxLength={25} required value={values.phone} onChange={change} placeholder="+250 7xx xxx xxx" /></div>
            <div className="field-block"><label htmlFor="email">Email address <small>OPTIONAL</small></label><input className={field} id="email" name="email" type="email" autoComplete="email" maxLength={150} value={values.email} onChange={change} placeholder="you@example.com" /></div>
            <div className="field-block"><label htmlFor="location">Current location <span>*</span></label><input className={field} id="location" name="location" maxLength={150} required value={values.location} onChange={change} placeholder="e.g. Kigali, Gasabo" /></div>
            <div className="field-block"><label htmlFor="vehicleType">What do you ride? <span>*</span></label><select className={field} id="vehicleType" name="vehicleType" required value={values.vehicleType} onChange={change}><option value="">Select vehicle type</option><option value="Motorcycle">Motorcycle</option><option value="Bicycle">Bicycle</option><option value="Car">Car</option><option value="Other">Other</option></select></div>
            <div className="field-block"><label htmlFor="powerType">Vehicle power type <span>*</span></label><select className={field} id="powerType" name="powerType" required value={values.powerType} onChange={change}><option value="">Select power type</option><option value="Electric">Electric</option><option value="Petrol">Petrol</option><option value="Not applicable">Not applicable</option><option value="Other">Other</option></select></div>
            <div className="privacy-note"><span className="privacy-icon">✓</span><p><strong>Your information stays with our team.</strong><br />We’ll use your details to follow up about rider registration. Submitting this form does not automatically activate a rider account.</p></div>
            {success && <div role="status" className="form-message success-message"><strong>Registration received.</strong><br />Thank you — the Zana team will contact you about next steps.</div>}
            {error && <div role="alert" className="form-message error-message">{error}</div>}
            <button type="submit" disabled={busy} className="submit-button">{busy ? <><span className="button-spinner" /> Sending your details…</> : <>Submit registration <span aria-hidden="true">↗</span></>}</button>
            <p className="required-note"><span>*</span> Required fields</p>
          </form>
        </section>
        <footer className="rider-footer"><span>© Zana Rider Recruitment</span><span>Made for the roads ahead <b>↗</b></span></footer>
      </div>
      <style jsx>{`
        :global(*) { box-sizing: border-box; }
        .rider-page { min-height: 100vh; background: #f5f6f1; color: #152c25; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 0 24px 28px; }
        .rider-wrap { width: min(1120px, 100%); margin: 0 auto; }
        .rider-header { height: 86px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
        .rider-wordmark { display:flex; align-items:center; gap:10px; text-decoration:none; color:#123b2e; font-size:21px; font-weight:950; letter-spacing:-.07em; }
        .brand-mark { display:grid; place-items:center; width:36px; height:36px; border-radius:12px 12px 12px 4px; background:#b8f36c; color:#153c2e; font-size:26px; font-weight:950; font-style:italic; }
        .brand-sub { display:block; margin-top:2px; font-size:9px; letter-spacing:.16em; font-weight:800; color:#7b8b82; }
        .header-chip { display:flex; align-items:center; gap:8px; border:1px solid #dce4da; border-radius:100px; padding:10px 14px; color:#496459; font-size:10px; font-weight:850; letter-spacing:.1em; background:#ffffff80; }
        .live-dot { width:7px; height:7px; background:#2f9d68; border-radius:50%; box-shadow:0 0 0 4px #2f9d681c; }
        .rider-hero { position:relative; overflow:hidden; display:grid; grid-template-columns:1.15fr .85fr; min-height:380px; background:#123b2e; border-radius:28px; color:#fff; padding:clamp(30px,5.3vw,68px); isolation:isolate; }
        .hero-copy { position:relative; z-index:2; max-width:560px; }
        .eyebrow { display:flex; align-items:center; gap:10px; margin:0 0 24px; color:#c3e8b1; font-size:10px; font-weight:900; letter-spacing:.17em; }
        .eyebrow span { width:23px; height:2px; background:#b8f36c; }
        h1 { margin:0; font-size:clamp(42px,6.5vw,76px); line-height:.98; letter-spacing:-.075em; font-weight:850; }
        h1 em { color:#b8f36c; font-style:normal; }
        .hero-intro { max-width:440px; margin:22px 0 0; color:#d0dfd5; font-size:15px; line-height:1.8; }
        .hero-points { display:flex; flex-wrap:wrap; gap:22px; margin-top:27px; color:#f3f8f3; font-size:11px; font-weight:700; }
        .hero-points span { display:flex; align-items:center; gap:9px; }
        .hero-points b { color:#b8f36c; font-size:10px; letter-spacing:.05em; }
        .hero-art { position:relative; min-height:230px; display:grid; place-items:center; }
        .art-ring { position:absolute; border:1px solid #ffffff19; border-radius:50%; aspect-ratio:1; }
        .ring-one { width:min(31vw,340px); }
        .ring-two { width:min(23vw,250px); border-style:dashed; }
        .art-card { position:relative; z-index:1; width:230px; min-height:220px; border-radius:22px; padding:24px; transform:rotate(5deg); background:#b8f36c; color:#153b2d; box-shadow:0 24px 70px #061b1538; display:flex; flex-direction:column; align-items:flex-start; }
        .art-icon { display:grid; place-items:center; width:34px; height:34px; border-radius:11px; background:#123b2e; color:#b8f36c; font-size:22px; }
        .art-card-label { margin-top:24px; font-size:9px; letter-spacing:.16em; font-weight:900; }
        .art-card strong { margin-top:9px; font-size:26px; line-height:1.03; letter-spacing:-.06em; }
        .art-line { margin-top:auto; width:100%; height:3px; background:#153b2d25; border-radius:8px; }
        .art-spark { position:absolute; color:#b8f36c; font-size:26px; }
        .spark-one { top:14%; right:13%; } .spark-two { bottom:11%; left:8%; font-size:17px; }
        .form-section { margin-top:26px; padding:clamp(24px,4.4vw,48px); border:1px solid #e2e8df; border-radius:26px; background:#fff; box-shadow:0 18px 60px #19382a08; }
        .form-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:30px; }
        .section-kicker { margin:0 0 9px; color:#37835b; font-size:10px; font-weight:900; letter-spacing:.16em; }
        h2 { margin:0; font-size:clamp(27px,4vw,38px); line-height:1.1; letter-spacing:-.06em; font-weight:850; }
        .section-copy { margin:10px 0 0; color:#77857c; font-size:14px; }
        .step-count { display:flex; flex-direction:column; gap:4px; align-items:flex-end; padding:10px 13px; border-radius:13px; background:#f3f7f0; }
        .step-count span { color:#77857c; font-size:9px; font-weight:900; letter-spacing:.13em; }
        .step-count strong { font-size:15px; color:#244b39; } .step-count i { color:#9ba79e; font-size:12px; font-style:normal; }
        .rider-form { display:grid; grid-template-columns:1fr 1fr; gap:22px 20px; }
        .field-block { min-width:0; display:flex; flex-direction:column; gap:9px; }
        .field-block label { color:#2c4338; font-size:12px; font-weight:800; }
        .field-block label span, .required-note span { color:#239363; }
        .field-block label small { margin-left:7px; color:#99a49b; font-size:9px; letter-spacing:.1em; }
        .rider-field { width:100%; min-height:52px; border:1px solid #dfe6de; border-radius:13px; background:#fbfcfa; padding:0 15px; color:#1d3328; font:inherit; font-size:14px; outline:none; transition:border-color .18s, box-shadow .18s, background .18s; }
        .rider-field::placeholder { color:#a0aaa2; }
        .rider-field:focus { border-color:#27865a; background:#fff; box-shadow:0 0 0 4px #27865a14; }
        select.rider-field { cursor:pointer; }
        .privacy-note { grid-column:1 / -1; display:flex; align-items:flex-start; gap:12px; padding:15px 16px; border:1px solid #e2ebdd; border-radius:14px; background:#f7faf4; }
        .privacy-icon { display:grid; place-items:center; flex:0 0 23px; width:23px; height:23px; border-radius:50%; background:#dff2d4; color:#24704a; font-size:13px; font-weight:900; }
        .privacy-note p { margin:0; color:#748078; font-size:11px; line-height:1.7; }
        .privacy-note strong { color:#2d4a39; font-size:12px; }
        .form-message { grid-column:1 / -1; padding:15px 17px; border-radius:13px; font-size:13px; line-height:1.6; }
        .success-message { border:1px solid #bce6c9; background:#f0fbf2; color:#23633c; }
        .error-message { border:1px solid #f2c9c5; background:#fff5f4; color:#a22f2b; }
        .submit-button { grid-column:1 / -1; display:flex; align-items:center; justify-content:center; gap:14px; width:100%; min-height:57px; border:0; border-radius:14px; background:#123b2e; color:#fff; font-size:14px; font-weight:850; cursor:pointer; transition:transform .15s, background .15s, box-shadow .15s; box-shadow:0 8px 18px #123b2e18; }
        .submit-button span[aria-hidden] { display:grid; place-items:center; width:27px; height:27px; border-radius:50%; background:#b8f36c; color:#123b2e; font-size:18px; }
        .submit-button:hover:not(:disabled) { transform:translateY(-1px); background:#1b523f; box-shadow:0 12px 25px #123b2e25; }
        .submit-button:disabled { opacity:.65; cursor:wait; }
        .button-spinner { width:15px; height:15px; border:2px solid #ffffff55; border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
        .required-note { grid-column:1 / -1; margin:-12px 0 0; color:#98a29a; font-size:10px; }
        .rider-footer { display:flex; justify-content:space-between; gap:14px; padding:24px 4px 0; color:#89958c; font-size:10px; font-weight:700; letter-spacing:.02em; }
        .rider-footer b { color:#39875d; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media (max-width:760px) { .rider-page { padding:0 14px 20px; } .rider-header { height:72px; } .header-chip { font-size:8px; padding:9px 10px; } .rider-hero { grid-template-columns:1fr; padding:32px 25px 20px; border-radius:22px; } .hero-art { min-height:220px; margin-top:6px; } .ring-one { width:235px; } .ring-two { width:180px; } .art-card { width:190px; min-height:180px; padding:19px; } .art-card-label { margin-top:17px; } .art-card strong { font-size:23px; } .form-section { margin-top:16px; padding:24px 20px; border-radius:22px; } .rider-form { grid-template-columns:1fr; gap:18px; } .privacy-note, .form-message, .submit-button, .required-note { grid-column:1; } }
        @media (max-width:380px) { .brand-sub { font-size:7px; } .rider-wordmark { font-size:18px; } .header-chip { max-width:125px; line-height:1.4; } .form-heading { gap:10px; } .step-count { padding:8px; } }
        @media (prefers-reduced-motion: reduce) { .rider-field, .submit-button { transition:none; } .button-spinner { animation:none; } }
      `}</style>
    </main>
  );
}
