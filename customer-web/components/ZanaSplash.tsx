'use client';

import { useEffect, useState } from 'react';

type ZanaSplashProps = {
  onDone?: () => void;
  variant?: 'customer' | 'driver';
};

/**
 * ZANA's short brand intro: a route draws, the destination lights up,
 * then the wordmark and MOVE KIGALI promise arrive. No assets or network calls.
 */
export default function ZanaSplash({ onDone, variant = 'customer' }: ZanaSplashProps) {
  const [phase, setPhase] = useState(0);
  const isDriver = variant === 'driver';

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    let reduced = false;

    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      // Keep the animated fallback when matchMedia is unavailable.
    }

    if (reduced) {
      setPhase(5);
      const done = setTimeout(() => onDone?.(), 350);
      return () => clearTimeout(done);
    }

    timers = [
      setTimeout(() => setPhase(1), 90),
      setTimeout(() => setPhase(2), 430),
      setTimeout(() => setPhase(3), 880),
      setTimeout(() => setPhase(4), 1320),
      setTimeout(() => setPhase(5), 1840),
      setTimeout(() => onDone?.(), 2260),
    ];

    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className={`zana-splash ${phase >= 5 ? 'zana-splash-leaving' : ''}`} role="status" aria-label="ZANA loading">
      <div className="zana-splash-grid" aria-hidden="true" />
      <div className="zana-splash-glow zana-splash-glow-a" aria-hidden="true" />
      <div className="zana-splash-glow zana-splash-glow-b" aria-hidden="true" />

      <div className={`zana-splash-core zana-splash-phase-${phase}`}>
        <div className="zana-splash-route" aria-hidden="true">
          <svg viewBox="0 0 280 142" role="presentation">
            <path className="zana-splash-route-shadow" d="M35 32 H174 L92 108 H239" />
            <path className="zana-splash-route-line" d="M35 32 H174 L92 108 H239" />
            <path className="zana-splash-route-dash" d="M35 32 H174 L92 108 H239" />
            <circle className="zana-splash-origin" cx="35" cy="32" r="7" />
            <circle className="zana-splash-destination-halo" cx="239" cy="108" r="17" />
            <circle className="zana-splash-destination" cx="239" cy="108" r="8" />
            <circle className="zana-splash-destination-center" cx="239" cy="108" r="3" />
          </svg>
        </div>

        <div className="zana-splash-wordmark" aria-label="ZANA">
          {'ZANA'.split('').map((letter, index) => (
            <span className={index === 1 ? 'zana-splash-letter-accent' : ''} key={letter + index} style={{ '--letter-index': index } as React.CSSProperties}>
              {letter}
            </span>
          ))}
        </div>

        <div className="zana-splash-tagline">
          <span className="zana-splash-tagline-rule" />
          <span>{isDriver ? 'RIDE. DELIVER. EARN.' : 'MOVE KIGALI'}</span>
          <span className="zana-splash-tagline-rule" />
        </div>
        <div className="zana-splash-loading" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="zana-splash-footer" aria-hidden="true">RIDES · DELIVERIES · SHOPPING</div>

      <style jsx>{`
        .zana-splash {
          --splash-green: #00a082;
          --splash-yellow: #ffc244;
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: grid;
          place-items: center;
          overflow: hidden;
          isolation: isolate;
          background: #f8fbf9;
          color: #17211e;
          opacity: 1;
          transition: opacity 360ms cubic-bezier(.2,.75,.25,1), visibility 360ms ease;
        }
        .zana-splash-leaving { opacity: 0; visibility: hidden; pointer-events: none; }
        .zana-splash-grid {
          position: absolute;
          inset: -10%;
          z-index: -3;
          background-image: linear-gradient(rgba(0,160,130,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,160,130,.045) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: radial-gradient(ellipse at center, #000 0%, transparent 68%);
          animation: zanaSplashGrid 14s linear infinite;
        }
        .zana-splash-glow { position: absolute; z-index: -2; width: 300px; height: 300px; border-radius: 50%; filter: blur(2px); pointer-events: none; }
        .zana-splash-glow-a { top: -190px; right: -100px; background: radial-gradient(circle, rgba(255,194,68,.22), transparent 70%); }
        .zana-splash-glow-b { bottom: -210px; left: -130px; background: radial-gradient(circle, rgba(0,160,130,.16), transparent 70%); }
        .zana-splash-core { width: min(88vw, 340px); display: flex; flex-direction: column; align-items: center; transform: translateY(-8px); }
        .zana-splash-route { width: min(100%, 300px); height: 150px; margin-bottom: -2px; }
        .zana-splash-route svg { width: 100%; height: 100%; overflow: visible; }
        .zana-splash-route-shadow, .zana-splash-route-line, .zana-splash-route-dash { fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .zana-splash-route-shadow { stroke: rgba(14,53,43,.07); stroke-width: 23; stroke-dasharray: 520; stroke-dashoffset: 520; transition: stroke-dashoffset 850ms cubic-bezier(.22,1,.36,1); }
        .zana-splash-route-line { stroke: var(--splash-yellow); stroke-width: 15; stroke-dasharray: 520; stroke-dashoffset: 520; transition: stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1); }
        .zana-splash-route-dash { stroke: rgba(255,255,255,.94); stroke-width: 2; stroke-dasharray: 5 13; stroke-dashoffset: 520; transition: stroke-dashoffset 1100ms cubic-bezier(.22,1,.36,1); }
        .zana-splash-origin { fill: #17211e; opacity: 0; transform-origin: 35px 32px; transform: scale(.1); transition: opacity 220ms ease, transform 450ms cubic-bezier(.34,1.56,.64,1); }
        .zana-splash-destination-halo { fill: rgba(0,160,130,.12); opacity: 0; transform-origin: 239px 108px; transform: scale(.2); transition: opacity 350ms ease, transform 550ms cubic-bezier(.34,1.56,.64,1); }
        .zana-splash-destination { fill: var(--splash-green); opacity: 0; transform-origin: 239px 108px; transform: scale(.2); transition: opacity 280ms ease, transform 500ms cubic-bezier(.34,1.56,.64,1); }
        .zana-splash-destination-center { fill: white; opacity: 0; transition: opacity 250ms ease; }
        .zana-splash-phase-1 .zana-splash-origin, .zana-splash-phase-2 .zana-splash-origin, .zana-splash-phase-3 .zana-splash-origin, .zana-splash-phase-4 .zana-splash-origin, .zana-splash-phase-5 .zana-splash-origin { opacity: 1; transform: scale(1); }
        .zana-splash-phase-2 .zana-splash-route-shadow, .zana-splash-phase-3 .zana-splash-route-shadow, .zana-splash-phase-4 .zana-splash-route-shadow, .zana-splash-phase-5 .zana-splash-route-shadow { stroke-dashoffset: 0; }
        .zana-splash-phase-2 .zana-splash-route-line, .zana-splash-phase-3 .zana-splash-route-line, .zana-splash-phase-4 .zana-splash-route-line, .zana-splash-phase-5 .zana-splash-route-line { stroke-dashoffset: 0; }
        .zana-splash-phase-3 .zana-splash-route-dash, .zana-splash-phase-4 .zana-splash-route-dash, .zana-splash-phase-5 .zana-splash-route-dash { stroke-dashoffset: 0; }
        .zana-splash-phase-2 .zana-splash-destination-halo, .zana-splash-phase-3 .zana-splash-destination-halo, .zana-splash-phase-4 .zana-splash-destination-halo, .zana-splash-phase-5 .zana-splash-destination-halo { opacity: 1; transform: scale(1); }
        .zana-splash-phase-2 .zana-splash-destination, .zana-splash-phase-3 .zana-splash-destination, .zana-splash-phase-4 .zana-splash-destination, .zana-splash-phase-5 .zana-splash-destination { opacity: 1; transform: scale(1); }
        .zana-splash-phase-2 .zana-splash-destination-center, .zana-splash-phase-3 .zana-splash-destination-center, .zana-splash-phase-4 .zana-splash-destination-center, .zana-splash-phase-5 .zana-splash-destination-center { opacity: 1; }
        .zana-splash-wordmark { display: flex; align-items: baseline; gap: 1px; margin-top: -2px; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: clamp(58px, 15vw, 72px); line-height: .95; letter-spacing: -.075em; font-weight: 900; }
        .zana-splash-wordmark span { opacity: 0; transform: translateY(13px) scale(.92); transition: opacity 300ms ease, transform 500ms cubic-bezier(.22,1,.36,1); transition-delay: calc(var(--letter-index) * 55ms); }
        .zana-splash-wordmark span:first-child, .zana-splash-wordmark span:nth-child(3), .zana-splash-wordmark span:nth-child(4) { color: #17211e; }
        .zana-splash-wordmark .zana-splash-letter-accent { color: var(--splash-green); }
        .zana-splash-phase-3 .zana-splash-wordmark span, .zana-splash-phase-4 .zana-splash-wordmark span, .zana-splash-phase-5 .zana-splash-wordmark span { opacity: 1; transform: translateY(0) scale(1); }
        .zana-splash-tagline { display: flex; align-items: center; justify-content: center; gap: 11px; margin-top: 18px; color: #63716b; font-size: 10px; font-weight: 800; letter-spacing: .23em; opacity: 0; transform: translateY(8px); transition: opacity 300ms ease, transform 420ms cubic-bezier(.22,1,.36,1); }
        .zana-splash-tagline-rule { display: block; width: 19px; height: 2px; border-radius: 2px; background: var(--splash-yellow); }
        .zana-splash-phase-4 .zana-splash-tagline, .zana-splash-phase-5 .zana-splash-tagline { opacity: 1; transform: translateY(0); }
        .zana-splash-loading { display: flex; align-items: center; gap: 5px; height: 22px; margin-top: 21px; opacity: 0; transition: opacity 220ms ease; }
        .zana-splash-loading span { width: 5px; height: 5px; border-radius: 50%; background: var(--splash-green); animation: zanaSplashDot 900ms ease-in-out infinite; }
        .zana-splash-loading span:nth-child(2) { animation-delay: 120ms; background: var(--splash-yellow); }
        .zana-splash-loading span:nth-child(3) { animation-delay: 240ms; }
        .zana-splash-phase-4 .zana-splash-loading, .zana-splash-phase-5 .zana-splash-loading { opacity: .85; }
        .zana-splash-phase-5 .zana-splash-core { animation: zanaSplashDepart 500ms cubic-bezier(.22,1,.36,1) both; }
        .zana-splash-footer { position: absolute; bottom: max(25px, env(safe-area-inset-bottom)); color: #8a9791; font-size: 9px; font-weight: 700; letter-spacing: .18em; text-align: center; }
        @keyframes zanaSplashDot { 0%, 60%, 100% { transform: translateY(0); opacity: .35; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes zanaSplashDepart { to { transform: translateY(-12px) scale(1.025); opacity: .7; } }
        @keyframes zanaSplashGrid { to { background-position: 36px 36px; } }
        @media (max-width: 360px) { .zana-splash-route { height: 130px; } .zana-splash-tagline { font-size: 9px; letter-spacing: .18em; gap: 8px; } }
        @media (prefers-reduced-motion: reduce) {
          .zana-splash *, .zana-splash *::before, .zana-splash *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
          .zana-splash-grid { animation: none; }
        }
      `}</style>
    </div>
  );
}
