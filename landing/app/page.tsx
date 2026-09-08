'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The page is a route. One yellow road runs its full height, each service is
 * a stop along it, and the destination pin travels down as you scroll. That
 * comes straight from the mark — the Z is a road with lane markings and a pin
 * at the end — so the page moves the way the brand already does.
 */

const APP = 'https://app.zanaride.rw';
const DRIVER = 'https://driver.zanaride.rw';
const MERCHANT = 'https://merchant.zanaride.rw';

const STOPS = [
  {
    id: 'ride',
    kicker: 'Rides',
    head: ['Get', 'there.'],
    body:
      'Moto or car, whichever suits the trip. See the fare before you book, follow your driver on the map, and pay from your Zana wallet, mobile money or cash.',
    facts: [
      ['Under a minute', 'To find a driver nearby'],
      ['Fare up front', 'No surprises at the end'],
    ],
    light: false,
  },
  {
    id: 'deliver',
    kicker: 'Deliveries',
    head: ['Send', 'anything.'],
    body:
      'Documents across town, a forgotten key, a parcel to a client. Riders photograph every package at pickup and drop-off, and you follow it the whole way.',
    facts: [
      ['Photographed', 'At pickup and delivery'],
      ['Tracked', 'By a code anyone can check'],
    ],
    light: true,
  },
  {
    id: 'shop',
    kicker: 'Food and shopping',
    head: ['Order', 'in.'],
    body:
      'Restaurants, shops and gifts across Kigali. Or send an agent into the market to buy what you need at the day\u2019s price and bring it to your door.',
    facts: [
      ['Kimironko and more', 'Real market prices'],
      ['One shop per order', 'So nothing arrives cold'],
    ],
    light: false,
  },
  {
    id: 'business',
    kicker: 'For businesses',
    head: ['Grow', 'here.'],
    body:
      'Put your shop in front of Kigali without hiring a delivery team. Take orders, mark them ready, and a Zana rider handles the rest.',
    facts: [
      ['No fleet needed', 'Riders come to you'],
      ['Paid before pickup', 'Every order settled up front'],
    ],
    light: true,
  },
];

export default function Landing() {
  const [progress, setProgress] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // The road draws and the pin travels — the page's only ambient motion.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.body.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);

        // Where each stop falls along the whole journey
        const stops = Array.from(document.querySelectorAll<HTMLElement>('[data-stop]'));
        setMarks(
          stops.map(el => {
            const mid = el.offsetTop + el.offsetHeight / 2;
            return max > 0 ? Math.min(1, Math.max(0, (mid - window.innerHeight / 2) / max)) : 0;
          }),
        );
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Sections arrive as you reach them, once each.
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="wrap" ref={wrapRef}>
      {/* The route: always visible, filling in behind you */}
      <div className="rail" aria-hidden="true">
        <div className="road" />
        <div className="road-lane" />
        <div className="road-fill" style={{ height: `${progress * 100}vh` }} />

        {marks.map((m, i) => (
          <span
            key={i}
            className={`stop-marker ${progress >= m ? 'passed' : ''}`}
            style={{ top: `${m * 100}vh` }}
          />
        ))}

        <svg className="pin" style={{ top: `${progress * 100}vh` }} viewBox="0 0 30 30">
          <path
            d="M15 3c4.4 0 8 3.5 8 7.9 0 5.6-8 15.1-8 15.1S7 16.5 7 10.9C7 6.5 10.6 3 15 3z"
            fill="#59B02D"
          />
          <circle cx="15" cy="10.8" r="3.1" fill="#F5F3EF" />
        </svg>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="hero">
        <span className="lockup">
          <img src="/zana-mark.png" alt="" width={44} height={34} />
          <span className="lockup-word">
            z<span>a</span>na
          </span>
          <span className="sr-only">Zana</span>
        </span>

        <h1 className="display d-hero">
          Move
          <br />
          Kigali.
        </h1>

        <p className="lede" style={{ marginTop: '2rem' }}>
          Rides, deliveries and shopping in one app. Built here, for the way
          this city actually moves.
        </p>

        <div className="cta-row">
          <a className="btn btn--primary" href={APP}>
            Open Zana
          </a>
          <a className="btn btn--ghost" href="#ride">
            See what it does
          </a>
        </div>

        <div className="scroll-hint">
          <span className="arrow-down" aria-hidden="true" />
          Follow the road
        </div>
      </header>

      {/* ── Stops ────────────────────────────────────────────────────── */}
      {STOPS.map((s, i) => (
        <section
          key={s.id}
          id={s.id}
          data-stop=""
          className={`stop ${i % 2 === 1 ? 'stop--right' : ''} ${s.light ? 'stop--light' : ''}`}
        >
          <div className="reveal">
            <p className="stop-kicker">{s.kicker}</p>
            <h2 className="display d-stop">
              {s.head[0]}
              <br />
              {s.head[1]}
            </h2>
            <p className="body stop-body">{s.body}</p>

            <div className="facts">
              {s.facts.map(([value, label]) => (
                <div key={label}>
                  <p className="fact-value">{value}</p>
                  <p className="fact-label">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ── Arrival ──────────────────────────────────────────────────── */}
      <section className="finish" data-stop="">
        <div className="reveal">
          <h2 className="display d-end">
            Kigali,
            <br />
            let&rsquo;s move.
          </h2>

          <p className="lede" style={{ marginTop: '1.8rem' }}>
            Open Zana in your browser. Nothing to install.
          </p>

          <div className="cta-row">
            <a className="btn btn--primary" href={APP}>
              Open Zana
            </a>
            <a className="btn btn--ghost" href={DRIVER}>
              Drive with Zana
            </a>
            <a className="btn btn--ghost" href={MERCHANT}>
              Sell on Zana
            </a>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div>
          <img
            src="/zana-mark.png"
            alt="Zana"
            width={46}
            height={36}
            style={{ display: 'block', marginBottom: '0.9rem' }}
          />
          <p>Kigali, Rwanda</p>
        </div>

        <nav className="foot-links" aria-label="Footer">
          <a href={APP}>Ride</a>
          <a href={DRIVER}>Drive</a>
          <a href={MERCHANT}>Sell</a>
          <a href="mailto:hello@zanaride.rw">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
