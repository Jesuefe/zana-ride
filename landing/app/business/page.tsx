'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://zana.ajumalink.com/api/v1';

export default function BusinessPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ businessName: '', contactName: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'register') {
        const response = await fetch(`${API}/food-partners/register`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'We could not submit your application.');
        setMessage('Your application has been received. Our partnerships team will review your business and activate your account. You can sign in after registration.');
        setMode('login');
      } else {
        const response = await fetch(`${API}/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: form.email, password: form.password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Email or password is incorrect.');
        if (!data.token) throw new Error('This account cannot use business portal sign-in. Contact Zana support.');
        sessionStorage.setItem('zana_business_token', data.token);
        router.push('/business/dashboard');
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <main className="biz-site">
      <header className="biz-nav">
        <a href="/" className="biz-logo"><span className="biz-logo-mark">z</span> zana<span>.</span></a>
        <nav><a href="#solutions">Solutions</a><a href="#developers">Developers</a><a href="#how">How it works</a></nav>
        <a className="biz-nav-login" href="#portal">Partner sign in <span>↗</span></a>
      </header>

      <section className="biz-hero">
        <div className="biz-hero-copy">
          <p className="biz-eyebrow"><i /> ZANA BUSINESS · DELIVERY NETWORK</p>
          <h1>Your orders.<br /><em>Our delivery</em><br />network.</h1>
          <p className="biz-hero-lede">Keep your food app, your customers and your checkout. Connect to Zana when an order needs a reliable rider — with dispatch, tracking and one prepaid business wallet.</p>
          <div className="biz-hero-actions"><a className="biz-button biz-button-dark" href="#portal">Get started <span>↗</span></a><a className="biz-text-link" href="#developers">Explore the API ↓</a></div>
          <div className="biz-hero-proof"><span>01 / Keep your own app</span><span>02 / One delivery API</span><span>03 / Kigali-first network</span></div>
        </div>
        <div className="biz-hero-art">
          <div className="biz-route-card"><div className="biz-route-top"><span>LIVE DELIVERY</span><b>● ACTIVE</b></div><div className="biz-route-point"><i className="pickup-dot" /><span><small>PICKUP</small><strong>Your restaurant</strong></span></div><div className="biz-route-line" /><div className="biz-route-point"><i className="drop-dot" /><span><small>DROP-OFF</small><strong>Your customer</strong></span></div><div className="biz-route-bottom"><div className="biz-rider-icon">↗</div><span><strong>Zana rider dispatched</strong><small>Track every step from your system</small></span><b>→</b></div></div>
          <div className="biz-orbit biz-orbit-one" /><div className="biz-orbit biz-orbit-two" /><div className="biz-floating">API<br /><strong>↗</strong></div>
        </div>
      </section>

      <section className="biz-strip"><strong>Built for businesses that already have customers.</strong><span>Restaurants</span><span>Food platforms</span><span>Grocery apps</span><span>Marketplaces</span><span>Retail & ecommerce</span></section>

      <section className="biz-section" id="solutions">
        <div className="biz-section-heading"><p className="biz-eyebrow">THE LAST-MILE PARTNER</p><h2>Don't build a fleet.<br /><em>Plug into ours.</em></h2><p>Your team focuses on orders and customer experience. Zana handles the delivery request, rider dispatch and journey visibility.</p></div>
        <div className="biz-feature-grid">
          <article><span>01</span><div className="biz-feature-icon">↗</div><h3>Keep your own app</h3><p>No need to rebuild your ordering experience or move your customers to another platform.</p></article>
          <article><span>02</span><div className="biz-feature-icon">◎</div><h3>Automatic dispatch</h3><p>Request a courier from your backend and route the job into Zana's existing driver network.</p></article>
          <article><span>03</span><div className="biz-feature-icon">⌖</div><h3>Track each delivery</h3><p>Use delivery IDs and tracking codes to follow the job and keep your own order screen updated.</p></article>
          <article><span>04</span><div className="biz-feature-icon">₣</div><h3>One prepaid wallet</h3><p>Top up your business balance. Zana calculates the delivery price and deducts the fee when a job is created.</p></article>
        </div>
      </section>

      <section className="biz-process" id="how"><div><p className="biz-eyebrow">HOW IT WORKS</p><h2>From checkout<br />to doorstep.</h2><p>Simple integration for your developers. Clear visibility for your operations team.</p></div><ol><li><b>01</b><span><strong>Customer places an order</strong><small>The order stays inside your website or mobile app.</small></span></li><li><b>02</b><span><strong>Your server requests a quote</strong><small>Send pickup and drop-off coordinates to Zana's API.</small></span></li><li><b>03</b><span><strong>Create the delivery</strong><small>Zana validates the price, checks your wallet and creates the delivery.</small></span></li><li><b>04</b><span><strong>Follow the rider</strong><small>Poll the delivery status and update your customer's order timeline.</small></span></li></ol></section>

      <section className="biz-developer" id="developers"><div className="biz-dev-copy"><p className="biz-eyebrow">MADE FOR DEVELOPERS</p><h2>One API call<br />to move an order.</h2><p>Integrate from your backend using a private API key. Your customers never need to leave your app.</p><a href="#portal" className="biz-button biz-button-light">Get API access <span>↗</span></a></div><div className="biz-code-window"><div className="biz-code-bar"><span /><span /><span /><small>create-delivery.js</small></div><pre><code>{`const delivery = await fetch(
  "https://zana.ajumalink.com/api/v1/food-partners/deliveries",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Zana-API-Key": process.env.ZANA_API_KEY
    },
    body: JSON.stringify({
      partnerOrderRef: order.id,
      pickupAddress: restaurant.address,
      pickupLat: restaurant.lat,
      pickupLng: restaurant.lng,
      dropoffAddress: customer.address,
      dropoffLat: customer.lat,
      dropoffLng: customer.lng,
      receiverPhone: customer.phone
    })
  }
);

const result = await delivery.json();`}</code></pre><div className="biz-code-foot"><span>● SERVER-SIDE REQUEST</span><span>RWF · PREPAID</span></div></div></section>

      <section className="biz-api-details"><div><p className="biz-eyebrow">API TOOLKIT</p><h2>Everything your<br />integration needs.</h2></div><div className="biz-api-list"><article><b>POST</b><span><strong>/food-partners/quote</strong><small>Get a delivery estimate from coordinates.</small></span></article><article><b>POST</b><span><strong>/food-partners/deliveries</strong><small>Create a paid delivery from prepaid balance.</small></span></article><article><b>GET</b><span><strong>/food-partners/deliveries/:id</strong><small>Read status, tracking code and assigned rider details.</small></span></article><article><b>POST</b><span><strong>/food-partners/deliveries/:id/cancel</strong><small>Cancel a job before dispatch and receive a wallet refund.</small></span></article><article><b>GET</b><span><strong>/food-partners/wallet</strong><small>Check your available prepaid RWF balance.</small></span></article></div></section>

      <section className="biz-portal" id="portal"><div className="biz-portal-copy"><p className="biz-eyebrow">ZANA BUSINESS PORTAL</p><h2>Your delivery<br />operation, in one place.</h2><p>Manage your delivery activity, check wallet movements, view developer credentials and access integration instructions from your secure dashboard.</p><div className="biz-portal-points"><span>✓ Delivery history & tracking</span><span>✓ Prepaid wallet & ledger</span><span>✓ API credentials & developer guide</span></div></div>
        <form className="biz-auth-card" onSubmit={submit}>
          <div className="biz-auth-tabs"><button type="button" className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');setMessage('');}}>Sign in</button><button type="button" className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('');setMessage('');}}>Create account</button></div>
          <h3>{mode==='login'?'Welcome back.':'Partner with Zana.'}</h3><p>{mode==='login'?'Sign in to manage your business deliveries.':'Apply for access to the Zana delivery network.'}</p>
          {mode==='register' && <><label>Business name<input required maxLength={120} value={form.businessName} onChange={e=>setForm({...form,businessName:e.target.value})} placeholder="e.g. Kigali Food House" /></label><label>Contact person<input value={form.contactName} onChange={e=>setForm({...form,contactName:e.target.value})} placeholder="Your full name" /></label><label>Business phone<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+250..." /></label></>}
          <label>Business email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@business.com" /></label>
          <label>Password<input required type="password" minLength={10} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={mode==='register'?'At least 10 characters':'Your password'} /></label>
          {error && <div className="biz-form-error" role="alert">{error}</div>}{message && <div className="biz-form-success" role="status">{message}</div>}
          <button className="biz-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in to dashboard':'Submit business application'} <span>↗</span></button>
          <small className="biz-auth-note">By continuing, you agree to Zana's <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</small>
        </form>
      </section>

      <footer className="biz-footer"><a href="/" className="biz-logo"><span className="biz-logo-mark">z</span> zana<span>.</span></a><span>Move business forward.</span><a href="mailto:support@zanaride.rw">Business support ↗</a><small>© {new Date().getFullYear()} Zana Ride · Kigali, Rwanda</small></footer>
    </main>
  );
}
