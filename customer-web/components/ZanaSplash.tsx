'use client';

import { useEffect, useState } from 'react';

/**
 * ZANA signature loading screen — 3 seconds, identical every time.
 *
 * 0.00–0.45  a yellow destination dot appears and pulses
 * 0.45–1.20  a teal route shoots out and draws the Z
 * 1.20–1.85  A · N · A slide in along the route
 * 1.85–2.35  the logo settles with an elastic bounce, dot ripples
 * 2.35–3.00  the Z becomes a route again and the journey departs
 */
export default function ZanaSplash({ onDone }: { onDone?: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 60),    // dot
      setTimeout(() => setPhase(2), 450),   // route draws Z
      setTimeout(() => setPhase(3), 1200),  // letters join
      setTimeout(() => setPhase(4), 1850),  // settle + ripple
      setTimeout(() => setPhase(5), 2350),  // depart
      setTimeout(() => onDone?.(), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#FDFDFB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        opacity: phase === 5 ? 0 : 1,
        transition: 'opacity 620ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 260, height: 200,
          transform: phase === 5
            ? 'translateX(70px) scale(1.12)'
            : phase === 4
              ? 'scale(1)'
              : 'scale(0.985)',
          transition: phase === 4
            ? 'transform 480ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* ── The Z, drawn as a navigation route ─────────────────────── */}
        <svg
          viewBox="0 0 200 130"
          style={{ position: 'absolute', top: 0, left: 30, width: 150, height: 98, overflow: 'visible' }}
        >
          {/* road casing */}
          <path
            d="M 40 22 L 132 22 L 52 100 L 146 100"
            fill="none"
            stroke="#00A082"
            strokeWidth="17"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="330"
            strokeDashoffset={phase >= 2 ? 0 : 330}
            style={{
              transition: 'stroke-dashoffset 780ms cubic-bezier(0.45, 0, 0.35, 1)',
              opacity: phase >= 2 ? 1 : 0,
            }}
          />
          {/* centre line — the "road" detail */}
          <path
            d="M 40 22 L 132 22 L 52 100 L 146 100"
            fill="none"
            stroke="#FDFDFB"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="9 11"
            strokeDashoffset={phase >= 3 ? -40 : 0}
            style={{
              transition: 'stroke-dashoffset 1400ms linear',
              opacity: phase >= 3 ? 0.85 : 0,
            }}
          />

          {/* destination pin at the end of the route */}
          <g
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transform: phase >= 2 ? 'translate(0px, 0px)' : 'translate(-104px, 78px)',
              transition: 'transform 760ms cubic-bezier(0.45, 0, 0.35, 1), opacity 260ms ease',
            }}
          >
            <circle
              cx="146" cy="100" r="10"
              fill="#FFC244"
              style={{
                transformOrigin: '146px 100px',
                animation: phase === 1 ? 'zanaPulse 420ms ease-out' : 'none',
              }}
            />
            <circle cx="146" cy="100" r="3.6" fill="#FDFDFB" />
          </g>

          {/* ripple at the ZANA moment */}
          {phase === 4 && (
            <circle
              cx="146" cy="100" r="10"
              fill="none" stroke="#FFC244" strokeWidth="2"
              style={{ animation: 'zanaRipple 720ms ease-out forwards' }}
            />
          )}
        </svg>

        {/* ── ZANA wordmark — letters flow in along the route ────────── */}
        <div
          style={{
            position: 'absolute', bottom: 26, left: 0, right: 0,
            display: 'flex', alignItems: 'baseline', justifyContent: 'center',
            gap: 1,
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: 46, fontWeight: 800, letterSpacing: '-0.02em',
          }}
        >
          <span
            style={{
              color: '#00A082',
              opacity: phase >= 3 ? 1 : 0,
              transform: phase >= 3 ? 'translateX(0)' : 'translateX(-14px)',
              transition: 'all 300ms cubic-bezier(0.34, 1.4, 0.64, 1) 0ms',
            }}
          >
            Z
          </span>
          {['a', 'n', 'a'].map((ch, i) => (
            <span
              key={i}
              style={{
                color: i === 0 ? '#FFC244' : '#1A1A2E',
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? 'translateX(0)' : 'translateX(-22px)',
                transition: `all 300ms cubic-bezier(0.34, 1.4, 0.64, 1) ${90 + i * 85}ms`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>

        {/* ── Tagline ───────────────────────────────────────────────── */}
        <p
          style={{
            position: 'absolute', bottom: 4, left: 0, right: 0,
            textAlign: 'center', margin: 0,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 9.5, fontWeight: 700,
            letterSpacing: '0.28em', textTransform: 'uppercase',
            color: '#9A9A96',
            opacity: phase >= 4 ? 1 : 0,
            transition: 'opacity 420ms ease 120ms',
          }}
        >
          Ride<span style={{ color: '#00A082' }}>.</span> Deliver
          <span style={{ color: '#FFC244' }}>.</span> Connect
          <span style={{ color: '#00A082' }}>.</span>
        </p>

        {/* ── Departing route streak ────────────────────────────────── */}
        {phase === 5 && (
          <svg
            viewBox="0 0 200 20"
            style={{ position: 'absolute', top: 48, left: 60, width: 220, height: 20, overflow: 'visible' }}
          >
            <path
              d="M 0 10 L 190 10"
              fill="none" stroke="#00A082" strokeWidth="4" strokeLinecap="round"
              style={{ animation: 'zanaDepart 560ms cubic-bezier(0.5, 0, 0.75, 0) forwards' }}
            />
            <circle
              cx="0" cy="10" r="5" fill="#FFC244"
              style={{ animation: 'zanaDepartDot 560ms cubic-bezier(0.5, 0, 0.75, 0) forwards' }}
            />
          </svg>
        )}
      </div>

      <style>{`
        @keyframes zanaPulse {
          0%   { transform: scale(0.3); opacity: 0; }
          55%  { transform: scale(1.45); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes zanaRipple {
          0%   { r: 10; opacity: 0.9; stroke-width: 2.4; }
          100% { r: 46; opacity: 0; stroke-width: 0.5; }
        }
        @keyframes zanaDepart {
          0%   { stroke-dasharray: 0 190; opacity: 1; }
          60%  { stroke-dasharray: 90 190; opacity: 1; }
          100% { stroke-dasharray: 0 190; stroke-dashoffset: -190; opacity: 0; }
        }
        @keyframes zanaDepartDot {
          0%   { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(200px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
