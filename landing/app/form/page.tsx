'use client';

import { FormEvent, useState } from 'react';

const API = 'https://zana.ajumalink.com/api/v1/rider-registration';
const initial = { fullName: '', phone: '', email: '', vehicleType: '', powerType: '', location: '' };

export default function RiderFormPage() {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
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
      setSuccess(true); setStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error. Please try again.');
    } finally { setBusy(false); }
  }

  const field = 'rider-field';
  const steps = [
    { key: 'fullName', label: 'First things first.', question: 'What should we call you?', hint: 'Your full name', placeholder: 'Type your full name', type: 'text', required: true, auto: 'name' },
    { key: 'phone', label: 'Let’s stay connected.', question: 'What’s your phone number?', hint: 'So our team can reach you', placeholder: '+250 7xx xxx xxx', type: 'tel', required: true, auto: 'tel' },
    { key: 'email', label: 'One more way to reach you.', question: 'What’s your email?', hint: 'This one is optional', placeholder: 'you@example.com', type: 'email', required: false, auto: 'email' },
    { key: 'location', label: 'Where are you based?', question: 'Where do you ride from?', hint: 'City, district or neighbourhood', placeholder: 'e.g. Kigali, Gasabo', type: 'text', required: true, auto: 'address-level2' },
  ] as const;
  function nextStep() {
    if (step === 0 && !values.fullName.trim()) { setError('Please enter your name to continue.'); return; }
    if (step === 1 && !values.phone.trim()) { setError('Please enter your phone number to continue.'); return; }
    if (step === 3 && !values.location.trim()) { setError('Please enter your location to continue.'); return; }
    setError('');
    setStep(s => Math.min(s + 1, 5));
  }
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

        {success ? (
          <section className="success-panel" role="status" aria-live="polite">
            <div className="success-check"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 25.5 20 33l16-18" /></svg></div>
            <p className="section-kicker">YOU’RE ALL SET</p>
            <h2>That’s you, registered.</h2>
            <p className="success-copy">Thanks for your interest in joining the Zana rider network. We’ve received your details, and our team will be in touch about the next steps.</p>
            <div className="success-reassurance"><span>✓</span> Registration submitted successfully</div>
            <a className="back-home" href="/">Back to home <span>↗</span></a>
          </section>
        ) : (
          <section className="form-section">
            <div className="form-heading"><div><p className="section-kicker">A FEW QUICK QUESTIONS</p><h2>Let’s get you moving.</h2><p className="section-copy">One small step at a time. You’re in control.</p></div><div className="step-count"><span>YOUR PROGRESS</span><strong>0{step + 1} <i>/ 06</i></strong></div></div>
            <div className="progress-track" aria-label={`Step ${step + 1} of 6`}><span style={{ width: `${((step + 1) / 6) * 100}%` }} /></div>
            <form onSubmit={submit} className="rider-form wizard-form">
              {step < 4 ? (
                <div className="wizard-question" key={step}>
                  <p className="question-eyebrow">{steps[step].label}</p>
                  <label className="question-title" htmlFor={steps[step].key}>{steps[step].question}</label>
                  <p className="question-hint">{steps[step].hint}</p>
                  <input autoFocus className={field + ' wizard-input'} id={steps[step].key} name={steps[step].key} autoComplete={steps[step].auto} maxLength={steps[step].key === 'phone' ? 25 : 150} required={steps[step].required} type={steps[step].type} value={values[steps[step].key]} onChange={change} placeholder={steps[step].placeholder} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); nextStep(); } }} />
                </div>
              ) : step === 4 ? (
                <div className="wizard-question" key="vehicleType">
                  <p className="question-eyebrow">What’s your ride?</p><label className="question-title" htmlFor="vehicleType">Which vehicle do you have?</label><p className="question-hint">Choose the option that fits you best.</p>
                  <div className="choice-grid">
                    {([{value:'Motorcycle',title:'Motorcycle',sub:'Moto / motorbike',symbol:'↗'},{value:'Car',title:'Car',sub:'Four wheels',symbol:'▰'},{value:'Bicycle',title:'Bicycle',sub:'Pedal bike',symbol:'◎'},{value:'Other',title:'Other',sub:'Something else',symbol:'＋'}]).map(o => <button type="button" key={o.value} className={'choice-card ' + (values.vehicleType === o.value ? 'selected' : '')} onClick={() => { setValues(v => ({...v, vehicleType:o.value})); setError(''); }}><span className="choice-symbol">{o.symbol}</span><span className="choice-title">{o.title}</span><span className="choice-sub">{o.sub}</span>{values.vehicleType === o.value && <span className="choice-selected">✓</span>}</button>)}
                  </div>
                </div>
              ) : (
                <div className="wizard-question" key="powerType">
                  <p className="question-eyebrow">Last quick question</p><label className="question-title" htmlFor="powerType">What powers your vehicle?</label><p className="question-hint">This helps us understand your ride.</p>
                  <div className="choice-grid power-grid">
                    {([{value:'Electric',title:'Electric',sub:'Battery powered',symbol:'ϟ'},{value:'Petrol',title:'Petrol',sub:'Fuel powered',symbol:'◉'},{value:'Not applicable',title:'Not applicable',sub:'No motor / other',symbol:'—'}]).map(o => <button type="button" key={o.value} className={'choice-card ' + (values.powerType === o.value ? 'selected' : '')} onClick={() => { setValues(v => ({...v, powerType:o.value})); setError(''); }}><span className="choice-symbol">{o.symbol}</span><span className="choice-title">{o.title}</span><span className="choice-sub">{o.sub}</span>{values.powerType === o.value && <span className="choice-selected">✓</span>}</button>)}
                  </div>
                </div>
              )}
              {error && <div role="alert" className="form-message error-message">{error}</div>}
              <div className="wizard-actions">
                {step > 0 && <button type="button" className="back-button" onClick={() => { setStep(s => s - 1); setError(''); }}>← Back</button>}
                {step < 5 ? <button type="button" className="submit-button" onClick={() => { if (step === 4 && !values.vehicleType) { setError('Choose the vehicle you ride to continue.'); return; } nextStep(); }}>Continue <span aria-hidden="true">→</span></button> : <button type="submit" disabled={busy || !values.powerType} className="submit-button">{busy ? <><span className="button-spinner" /> Sending…</> : <>Finish registration <span aria-hidden="true">↗</span></>}</button>}
              </div>
              <p className="required-note">Your details are only used to follow up on your registration.</p>
            </form>
          </section>
        )}
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

        .progress-track { width:100%; height:4px; background:#edf1ea; border-radius:99px; overflow:hidden; margin:-12px 0 24px; }
        .progress-track span { display:block; height:100%; background:#48a36b; border-radius:99px; transition:width .3s ease; }
        .wizard-form { grid-template-columns:1fr; min-height:350px; align-content:space-between; gap:22px; }
        .wizard-question { min-height:245px; padding:18px 0 8px; animation:question-in .28s ease both; }
        .question-eyebrow { margin:0 0 14px; color:#39875d; font-size:11px; font-weight:850; letter-spacing:.13em; text-transform:uppercase; }
        .question-title { display:block; color:#193a2b; font-size:clamp(28px,5vw,43px); line-height:1.1; font-weight:850; letter-spacing:-.065em; }
        .question-hint { margin:12px 0 27px; color:#7e8a80; font-size:14px; line-height:1.6; }
        .wizard-input { min-height:65px; padding:0 19px; font-size:clamp(16px,2vw,19px); border-radius:15px; background:#fbfcfa; }
        .wizard-actions { display:flex; gap:12px; align-items:center; }
        .wizard-actions .submit-button { flex:1; grid-column:auto; }
        .back-button { min-height:57px; padding:0 20px; border:1px solid #dfe6de; border-radius:14px; background:white; color:#375444; font-weight:800; cursor:pointer; }
        .choice-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        .choice-card { position:relative; min-height:115px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:6px; padding:17px; border:1px solid #dfe6de; border-radius:15px; background:#fbfcfa; color:#244335; text-align:left; cursor:pointer; transition:border-color .15s,background .15s,transform .15s; }
        .choice-card:hover { transform:translateY(-1px); border-color:#8cb89b; }
        .choice-card.selected { border:1.5px solid #2f8d59; background:#f0f8ed; box-shadow:0 0 0 3px #2f8d5912; }
        .choice-symbol { display:grid; place-items:center; width:30px; height:30px; border-radius:9px; background:#eaf3e6; color:#2b7950; font-size:20px; font-weight:800; }
        .choice-title { font-size:14px; font-weight:850; }
        .choice-sub { color:#839087; font-size:11px; }
        .choice-selected { position:absolute; top:12px; right:12px; display:grid; place-items:center; width:20px; height:20px; border-radius:50%; background:#2f8d59; color:white; font-size:12px; font-weight:900; }
        .success-panel { margin-top:26px; min-height:440px; padding:clamp(32px,7vw,76px) 24px; border:1px solid #e2e8df; border-radius:26px; background:white; box-shadow:0 18px 60px #19382a08; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
        .success-check { display:grid; place-items:center; width:88px; height:88px; margin-bottom:27px; border-radius:50%; background:#e7f8e9; border:1px solid #c3ebca; box-shadow:0 0 0 10px #f4fbf2; animation:check-pop .5s cubic-bezier(.2,.8,.2,1) both; }
        .success-check svg { width:48px; height:48px; fill:none; stroke:#258849; stroke-width:4; stroke-linecap:round; stroke-linejoin:round; }
        .success-panel h2 { margin:7px 0 0; font-size:clamp(30px,5vw,46px); }
        .success-copy { max-width:460px; margin:17px auto 0; color:#77857c; font-size:15px; line-height:1.8; }
        .success-reassurance { display:flex; align-items:center; gap:9px; margin-top:25px; padding:12px 16px; border-radius:99px; background:#f0f8ed; color:#36774c; font-size:12px; font-weight:800; }
        .success-reassurance span { display:grid; place-items:center; width:20px; height:20px; border-radius:50%; background:#cfeecf; }
        .back-home { display:inline-flex; align-items:center; gap:12px; margin-top:28px; color:#244b39; font-size:13px; font-weight:850; text-decoration:none; }
        .back-home span { display:grid; place-items:center; width:27px; height:27px; border-radius:50%; background:#b8f36c; }
        @keyframes question-in { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes check-pop { from { opacity:0; transform:scale(.7); } to { opacity:1; transform:scale(1); } }
        @media (max-width:760px) { .wizard-form { min-height:365px; } .wizard-question { min-height:250px; padding-top:12px; } .choice-card { min-height:105px; padding:13px; } .success-panel { margin-top:16px; min-height:400px; border-radius:22px; } }
        @media (prefers-reduced-motion:reduce) { .progress-track span,.choice-card { transition:none; } .wizard-question,.success-check { animation:none; } }
        @media (prefers-reduced-motion: reduce) { .rider-field, .submit-button { transition:none; } .button-spinner { animation:none; } }
      `}</style>
    </main>
  );
}
