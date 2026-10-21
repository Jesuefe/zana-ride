'use client';

import { useEffect, useState } from 'react';

const APP = 'https://app.zanaride.rw';
const DRIVER = 'https://driver.zanaride.rw';
const MERCHANT = 'https://merchant.zanaride.rw';

const SERVICES = [
  { number: '01', icon: '↗', title: 'Ride across town', text: 'Book a moto or car, see your fare before you go, and follow your driver on the map.', tag: 'Moto + car', href: APP, tone: 'mint' },
  { number: '02', icon: '↗', title: 'Send it with Zana', text: 'From important documents to everyday parcels, get it picked up and delivered with tracking.', tag: 'Door to door', href: APP, tone: 'yellow' },
  { number: '03', icon: '↗', title: 'Bring the good stuff', text: 'Order from local restaurants and shops, or get help buying what you need around Kigali.', tag: 'Food + shopping', href: APP, tone: 'peach' },
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="site-shell">
      <div className="scroll-progress" style={{ width: `${scrollProgress}%` }} aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="/" aria-label="Zana home">
          <img src="/zana-mark.png" alt="" width="42" height="34" />
          <span>zana<span className="brand-dot">.</span></span>
        </a>
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span />
        </button>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#services" onClick={() => setMenuOpen(false)}>What we do</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#business" onClick={() => setMenuOpen(false)}>For business</a>
          <a className="nav-cta" href={APP}>Open Zana <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> MADE FOR KIGALI, RWANDA</div>
          <h1>Your city.<br /><span>Your way.</span></h1>
          <p className="hero-lede">A ride across town. A parcel on its way. Your favourite things at your door. One simple way to get life moving.</p>
          <div className="hero-actions">
            <a className="button button-primary" href={APP}>Get moving <span aria-hidden="true">↗</span></a>
            <a className="text-link" href="#services">Explore Zana <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-trust">
            <span className="trust-icon">✳</span>
            <span><strong>One app, more possibilities.</strong><small>Rides · Deliveries · Food · Shopping</small></span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Illustration of the Zana app and a ride in Kigali">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="sun-disc" />
          <div className="city-skyline skyline-back"><i /><i /><i /><i /><i /><i /></div>
          <div className="city-skyline skyline-front"><i /><i /><i /><i /><i /></div>
          <div className="road-scene"><span className="road-dash dash-a" /><span className="road-dash dash-b" /><span className="road-dash dash-c" /></div>
          <div className="ride-bubble"><span className="bubble-icon">↗</span><span><strong>Your ride is close</strong><small>Driver nearby · Kigali</small></span><span className="bubble-dot" /></div>
          <div className="phone">
            <div className="phone-speaker" />
            <div className="phone-top"><img src="/zana-mark.png" alt="" /><span>Good afternoon</span><strong>Where to?</strong></div>
            <div className="phone-map">
              <div className="map-grid grid-a" /><div className="map-grid grid-b" />
              <span className="map-road road-a" /><span className="map-road road-b" /><span className="map-road road-c" />
              <span className="map-route" /><span className="map-pin pin-start">●</span><span className="map-pin pin-end">⌖</span>
              <span className="map-label label-one">KIGALI</span><span className="map-label label-two">Kacyiru</span>
            </div>
            <div className="phone-options"><div className="mini-option"><span className="mini-vehicle">●</span><span><strong>Moto</strong><small>Quick & easy</small></span><b>›</b></div><div className="mini-option"><span className="mini-vehicle car-dot">▰</span><span><strong>Car</strong><small>Room for more</small></span><b>›</b></div><div className="phone-button">Choose a ride <span>→</span></div></div>
          </div>
          <div className="visual-caption"><span className="caption-star">✳</span><span>Everyday journeys,<br /><strong>made a little easier.</strong></span></div>
          <span className="visual-index">01 / YOUR EVERYDAY, CONNECTED</span>
        </div>
        <a className="hero-scroll" href="#services"><span /> Scroll to explore</a>
      </section>

      <section className="service-section section-pad" id="services">
        <div className="section-heading">
          <div><p className="eyebrow eyebrow-dark">ONE APP. LOTS OF WAYS.</p><h2>Whatever the day<br />calls for<span className="brand-dot">.</span></h2></div>
          <p className="section-intro">The little things that keep your day moving, all together in one place.</p>
        </div>
        <div className="service-grid">
          {SERVICES.map((service) => (
            <a className={`service-card card-${service.tone}`} href={service.href} key={service.number}>
              <div className="service-card-top"><span className="service-number">{service.number} / SERVICE</span><span className="service-arrow">{service.icon}</span></div>
              <div className={`service-art art-${service.tone}`} aria-hidden="true"><span className="art-ring ring-one" /><span className="art-ring ring-two" /><span className="art-symbol">{service.number === '01' ? '↗' : service.number === '02' ? '□' : '✳'}</span><span className="art-road" /></div>
              <div className="service-card-copy"><span className="service-tag">{service.tag}</span><h3>{service.title}</h3><p>{service.text}</p><span className="card-link">Discover more <span aria-hidden="true">↗</span></span></div>
            </a>
          ))}
        </div>
      </section>

      <section className="how-section section-pad" id="how-it-works">
        <div className="how-visual">
          <div className="how-map"><span className="how-road how-road-one" /><span className="how-road how-road-two" /><span className="how-road how-road-three" /><span className="how-pin pin-a">A</span><span className="how-pin pin-b">B</span><span className="how-map-label">KIGALI CITY</span></div>
          <div className="trip-card"><span className="trip-check">✓</span><span><strong>You're all set.</strong><small>Your journey, in your hands.</small></span></div>
        </div>
        <div className="how-copy"><p className="eyebrow">LESS BACK AND FORTH</p><h2>Simple from<br />the first tap<span className="brand-dot">.</span></h2><p>Choose what you need, add the details, and let Zana take it from there. Clear steps, useful updates, and your journey in view.</p><div className="steps"><div className="step"><span>01</span><div><strong>Choose your service</strong><p>Ride, send, eat or shop.</p></div></div><div className="step"><span>02</span><div><strong>Tell us the details</strong><p>Set your destination or delivery.</p></div></div><div className="step"><span>03</span><div><strong>Keep your day moving</strong><p>Follow progress and stay in the loop.</p></div></div></div><a className="button button-dark" href={APP}>Try Zana <span aria-hidden="true">↗</span></a></div>
      </section>

      <section className="business-section section-pad" id="business">
        <div className="business-copy"><p className="eyebrow">BUILT FOR LOCAL BUSINESS</p><h2>Good business<br />keeps moving<span className="yellow-dot">.</span></h2><p>Bring your shop to more people in Kigali. Receive orders, prepare them for pickup, and let a Zana rider handle the delivery.</p><div className="business-points"><span><b>✓</b> Reach more customers</span><span><b>✓</b> No delivery fleet to manage</span><span><b>✓</b> Keep your team focused</span></div><a className="button button-light" href={MERCHANT}>Sell with Zana <span aria-hidden="true">↗</span></a></div>
        <div className="business-art" aria-hidden="true"><div className="shop-window"><div className="shop-awning"><i /><i /><i /><i /><i /><i /></div><div className="shop-sign">YOUR<br />SHOP<span>.</span></div><div className="shop-door" /><div className="shop-plant plant-one" /><div className="shop-plant plant-two" /></div><div className="order-note"><span>✳</span><span><strong>New order</strong><small>Ready when you are</small></span><b>✓</b></div><span className="business-stamp">LOCAL<br />LOVE</span></div>
      </section>

      <section className="final-cta">
        <div className="cta-spark spark-one">✳</div><div className="cta-spark spark-two">+</div>
        <p className="eyebrow">LET'S GET THERE</p><h2>Ready when<br />you are<span className="yellow-dot">.</span></h2><p>Make more room for the things that matter. Let Zana take care of getting you there.</p><a className="button button-light" href={APP}>Open Zana <span aria-hidden="true">↗</span></a>
      </section>

      <footer className="site-footer">
        <div className="footer-main"><div className="footer-brand"><a className="brand brand-footer" href="/"><img src="/zana-mark.png" alt="" width="38" height="30" /><span>zana<span className="brand-dot">.</span></span></a><p>Your everyday, connected.<br />Kigali, Rwanda.</p></div><div className="footer-col"><strong>Explore</strong><a href="#services">Our services</a><a href="#how-it-works">How it works</a><a href={APP}>Open Zana</a></div><div className="footer-col"><strong>Partner with us</strong><a href={DRIVER}>Drive with Zana</a><a href={MERCHANT}>Sell with Zana</a><a href="https://zanaride.rw/form">Join the rider network</a></div><div className="footer-col"><strong>Say hello</strong><a href="mailto:hello@zanaride.rw">hello@zanaride.rw</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Zana Ride. Made for Kigali.</span><span>Move freely. Move with Zana. <span className="brand-dot">✳</span></span></div>
      </footer>
    </main>
  );
}
