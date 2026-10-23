'use client';

import Link from 'next/link';

const REGISTER = '/merchantform';

export default function MerchantPartnershipPage() {
  return (
    <main className="merchant-page">
      <header className="merchant-nav">
        <Link href="/" className="merchant-logo">zana<span>.</span></Link>
        <a className="merchant-nav-link" href={REGISTER}>Partner with Zana ↗</a>
      </header>

      <section className="merchant-hero">
        <div>
          <p className="merchant-kicker">For Kigali's independent businesses</p>
          <h1>Your shop has a place<br />in <em>more people's</em><br />everyday.</h1>
          <p className="merchant-lede">Meet new customers, receive orders online and let Zana help bring your products to their door. You focus on running your business. We'll help it move.</p>
          <a className="merchant-primary" href={REGISTER}>Register your business <span aria-hidden="true">↗</span></a>
          <p className="merchant-micro">No invite required · Submit in minutes · Our team will contact you</p>
        </div>
        <div className="merchant-art" aria-label="Illustration of a local shop receiving an order">
          <div className="merchant-order"><span className="merchant-order-icon">✳</span><span><strong>A new order</strong><small>Someone found your shop</small></span><span className="merchant-order-check">✓</span></div>
          <div className="merchant-store"><div className="merchant-awning" /><div className="merchant-store-sign">YOUR BUSINESS<small>NOW ON ZANA</small></div><div className="merchant-door" /></div>
        </div>
      </section>

      <section className="merchant-proof" aria-label="Benefits">
        <div><strong>Reach beyond your street</strong><p>Put your business in front of more people exploring food, gifts and everyday products.</p></div>
        <div><strong>No delivery fleet to manage</strong><p>When an order needs to move, Zana's delivery network can help with the last mile.</p></div>
        <div><strong>Your business stays yours</strong><p>You bring the products, prices and know-how. Build your presence at your own pace.</p></div>
      </section>

      <section className="merchant-steps">
        <div className="merchant-section-head"><h2>A simple start.<br />A bigger storefront.</h2><p>We designed onboarding to feel straightforward, even if you've never sold online before.</p></div>
        <div className="merchant-step-grid">
          <article className="merchant-step"><span>STEP 01 / TELL US</span><h3>Tell us about your business</h3><p>Share your business details and the best way to reach you. Our team will call you personally.</p></article>
          <article className="merchant-step"><span>STEP 02 / GET READY</span><h3>We review your shop</h3><p>Our team checks your application and follows up if anything else is needed before approval.</p></article>
          <article className="merchant-step"><span>STEP 03 / GO LIVE</span><h3>Prepare for orders</h3><p>Our team will discuss onboarding, catalogue support and delivery arrangements with you.</p></article>
        </div>
      </section>

      <section className="merchant-bottom">
        <div><h2>Good things happen when local businesses get seen.</h2><p>Take the first step. Your application starts with a few simple details.</p></div>
        <a href={REGISTER}>Tell us about your business ↗</a>
      </section>

      <footer className="merchant-footer"><Link href="/" className="merchant-logo">zana<span>.</span></Link><span>Made for Kigali, Rwanda.</span><a href="mailto:hello@zanaride.rw">Questions? Talk to us</a></footer>
    </main>
  );
}
