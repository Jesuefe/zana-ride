'use client';

import { useEffect, useState } from 'react';

type ZanaSplashProps = {
  onDone?: () => void;
  variant?: 'customer' | 'driver';
};

/**
 * Zana's signature startup moment.
 *
 * Point → route → ZANA → promise → journey.
 * Kept deliberately short so the brand moment feels premium, not like a delay.
 */
export default function ZanaSplash({ onDone, variant = 'customer' }: ZanaSplashProps) {
  const [phase, setPhase] = useState(0);
  const isDriver = variant === 'driver';

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 80),
      setTimeout(() => setPhase(2), 460),
      setTimeout(() => setPhase(3), 1120),
      setTimeout(() => setPhase(4), 1680),
      setTimeout(() => setPhase(5), 2180),
      setTimeout(() => setPhase(6), 2640),
      setTimeout(() => onDone?.(), 2920),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  const promise = isDriver ? 'Ride. Deliver. Earn.' : 'Ride. Deliver. Connect.';

  return (
    <div
      aria-label="Zana"
      role="status"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#FDFDFB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: phase === 6 ? 0 : 1,
        transition: 'opacity 280ms ease',
      }}
    >
      {/* Quiet navigation atmosphere — the route is the hero, not decoration. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-20%',
          backgroundImage:
            'linear-gradient(rgba(89,176,45,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(89,176,45,0.035) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          maskImage: 'radial-gradient(circle at center, black 0%, transparent 66%)',
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 5 ? 'scale(1.08)' : 'scale(1)',
          transition: 'opacity 700ms ease, transform 900ms ease',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: 300,
          height: 250,
          transform:
            phase >= 6
              ? 'translateX(72px) scale(1.08)'
              : phase >= 5
                ? 'scale(1.025)'
                : 'scale(0.98)',
          transition:
            phase >= 5
              ? 'transform 740ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Destination glow */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 40,
            right: 48,
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'rgba(89,176,45,0.14)',
            filter: 'blur(2px)',
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'scale(1)' : 'scale(0.2)',
            transition: 'opacity 260ms ease, transform 480ms cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />

        <svg
          viewBox="0 0 240 150"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 8,
            left: 30,
            width: 240,
            height: 150,
            overflow: 'visible',
          }}
        >
          {/* Route shadow */}
          <path
            d="M 30 30 L 156 30 L 58 116 L 194 116"
            fill="none"
            stroke="rgba(26,26,46,0.08)"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="430"
            strokeDashoffset={phase >= 2 ? 0 : 430}
            style={{
              transition: 'stroke-dashoffset 760ms cubic-bezier(0.45,0,0.2,1)',
              opacity: phase >= 2 ? 1 : 0,
            }}
          />

          {/* Zana route */}
          <path
            d="M 30 30 L 156 30 L 58 116 L 194 116"
            fill="none"
            stroke="#FEC708"
            strokeWidth="17"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="430"
            strokeDashoffset={phase >= 2 ? 0 : 430}
            style={{
              transition: 'stroke-dashoffset 760ms cubic-bezier(0.45,0,0.2,1)',
              opacity: phase >= 2 ? 1 : 0,
            }}
          />

          {/* Moving road centre line */}
          <path
            d="M 30 30 L 156 30 L 58 116 L 194 116"
            fill="none"
            stroke="#FFFDF5"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray="10 12"
            strokeDashoffset={phase >= 3 ? -80 : 0}
            style={{
              transition: 'stroke-dashoffset 1200ms linear',
              opacity: phase >= 3 ? 0.9 : 0,
            }}
          />

          {/* Origin point */}
          <circle
            cx="30"
            cy="30"
            r="7"
            fill="#1A1A2E"
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transformOrigin: '30px 30px',
              animation: phase === 1 ? 'zanaOrigin 520ms ease-out' : 'none',
            }}
          />

          {/* Destination point */}
          <g
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transformOrigin: '194px 116px',
              animation: phase === 1 ? 'zanaDestination 520ms ease-out' : 'none',
            }}
          >
            <circle cx="194" cy="116" r="10" fill="#59B02D" />
            <circle cx="194" cy="116" r="3.5" fill="#FDFDFB" />
          </g>

          {phase === 4 && (
            <circle
              cx="194"
              cy="116"
              r="10"
              fill="none"
              stroke="#59B02D"
              strokeWidth="2.5"
              style={{ animation: 'zanaRipple 720ms ease-out forwards' }}
            />
          )}
        </svg>

        {/* Wordmark arrives after the route completes. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 142,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'baseline',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: 52,
            lineHeight: 1,
            fontWeight: 850,
            letterSpacing: '-0.055em',
          }}
        >
          {['Z', 'a', 'n', 'a'].map((ch, i) => (
            <span
              key={ch + i}
              style={{
                color: i < 2 ? '#59B02D' : '#1A1A2E',
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.82)',
                transition: `opacity 260ms ease ${i * 55}ms, transform 460ms cubic-bezier(0.34,1.56,0.64,1) ${i * 55}ms`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>

        {/* The promise is revealed only after ZANA lands. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 204,
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: '#7D7D78',
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? 'translateY(0)' : 'translateY(7px)',
            transition: 'opacity 360ms ease, transform 420ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {promise.split('. ').map((word, i, all) => (
            <span key={word}>
              {word.replace('.', '')}
              {i < all.length - 1 && <span style={{ color: i === 1 ? '#FEC708' : '#59B02D' }}> • </span>}
            </span>
          ))}
        </div>

        {/* Final journey streak. */}
        {phase === 5 && (
          <svg
            viewBox="0 0 250 20"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 98,
              left: 52,
              width: 250,
              height: 20,
              overflow: 'visible',
            }}
          >
            <path
              d="M 0 10 L 225 10"
              fill="none"
              stroke="#FEC708"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ animation: 'zanaDepart 620ms cubic-bezier(0.5,0,0.75,0) forwards' }}
            />
            <circle
              cx="0"
              cy="10"
              r="5"
              fill="#59B02D"
              style={{ animation: 'zanaDepartDot 620ms cubic-bezier(0.5,0,0.75,0) forwards' }}
            />
          </svg>
        )}
      </div>

      <style>{`
        @keyframes zanaOrigin {
          0% { transform: scale(0); opacity: 0; }
          55% { transform: scale(1.45); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes zanaDestination {
          0% { transform: scale(0.2); opacity: 0; }
          55% { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes zanaRipple {
          0% { r: 10; opacity: 0.85; stroke-width: 2.5; }
          100% { r: 48; opacity: 0; stroke-width: 0.5; }
        }
        @keyframes zanaDepart {
          0% { stroke-dasharray: 0 225; opacity: 1; }
          55% { stroke-dasharray: 125 225; opacity: 1; }
          100% { stroke-dasharray: 0 225; stroke-dashoffset: -225; opacity: 0; }
        }
        @keyframes zanaDepartDot {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(232px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
        }
      `}</style>
    </div>
  );
}
