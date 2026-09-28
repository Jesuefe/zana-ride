'use client';

import { useEffect, useState } from 'react';

type Role = 'merchant' | 'agent';

const roleCopy: Record<Role, { eyebrow: string; promise: string }> = {
  merchant: { eyebrow: 'Zana Business', promise: 'Sell · Deliver · Grow' },
  agent: { eyebrow: 'Zana Market', promise: 'Shop · Deliver · Earn' },
};

export default function ZanaSplash({
  role = 'merchant',
  onDone,
}: {
  role?: Role;
  onDone?: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const copy = roleCopy[role];

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase(1), 80),
      window.setTimeout(() => setPhase(2), 460),
      window.setTimeout(() => setPhase(3), 1050),
      window.setTimeout(() => setPhase(4), 1700),
      window.setTimeout(() => setPhase(5), 2180),
      window.setTimeout(() => onDone?.(), 2780),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [onDone]);

  return (
    <div
      aria-label="Zana loading"
      role="status"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#FDFDFB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: phase === 5 ? 0 : 1,
        pointerEvents: phase === 5 ? 'none' : 'auto',
        transition: 'opacity 600ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.16,
          backgroundImage:
            'linear-gradient(rgba(89,176,45,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(89,176,45,.18) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
          transform: phase >= 4 ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 1000ms ease',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: 290,
          height: 250,
          transform:
            phase === 5 ? 'translateX(70px) scale(1.08)' : 'scale(0.98)',
          transition: 'transform 600ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <svg
          viewBox="0 0 220 150"
          style={{
            position: 'absolute',
            top: 8,
            left: 35,
            width: 220,
            height: 150,
            overflow: 'visible',
          }}
        >
          <path
            d="M 34 28 L 150 28 L 62 120 L 180 120"
            fill="none"
            stroke="#FEC708"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="410"
            strokeDashoffset={phase >= 2 ? 0 : 410}
            style={{
              transition: 'stroke-dashoffset 720ms cubic-bezier(.45,0,.35,1)',
              opacity: phase >= 2 ? 1 : 0,
            }}
          />
          <path
            d="M 34 28 L 150 28 L 62 120 L 180 120"
            fill="none"
            stroke="#FDFDFB"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="9 11"
            strokeDashoffset={phase >= 3 ? -45 : 0}
            style={{
              transition: 'stroke-dashoffset 1200ms linear',
              opacity: phase >= 3 ? 0.9 : 0,
            }}
          />
          <g
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transform: phase >= 2 ? 'translate(0,0)' : 'translate(-105px,92px)',
              transition: 'transform 700ms cubic-bezier(.45,0,.35,1), opacity 220ms ease',
            }}
          >
            <circle
              cx="180"
              cy="120"
              r="11"
              fill="#59B02D"
              style={{
                transformOrigin: '180px 120px',
                animation: phase === 1 ? 'zanaBusinessPulse 430ms ease-out' : 'none',
              }}
            />
            <circle cx="180" cy="120" r="4" fill="#FDFDFB" />
          </g>
          {phase === 4 && (
            <circle
              cx="180"
              cy="120"
              r="11"
              fill="none"
              stroke="#59B02D"
              strokeWidth="2.5"
              style={{ animation: 'zanaBusinessRipple 700ms ease-out forwards' }}
            />
          )}
        </svg>

        <div
          style={{
            position: 'absolute',
            top: 146,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: 'system-ui,-apple-system,"Segoe UI",sans-serif',
            fontSize: 48,
            lineHeight: 1,
            fontWeight: 850,
            letterSpacing: '-0.045em',
          }}
        >
          {'Zana'.split('').map((letter, index) => (
            <span
              key={letter + index}
              style={{
                color: index < 2 ? '#59B02D' : '#1A1A2E',
                display: 'inline-block',
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? 'translateY(0)' : 'translateY(12px)',
                transition: `opacity 260ms ease ${index * 70}ms, transform 420ms cubic-bezier(.34,1.4,.64,1) ${index * 70}ms`,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            top: 202,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: 'system-ui,-apple-system,sans-serif',
            fontSize: 9.5,
            lineHeight: 1.4,
            fontWeight: 750,
            letterSpacing: '.22em',
            textTransform: 'uppercase',
            color: '#777773',
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 380ms ease, transform 420ms ease',
          }}
        >
          {copy.eyebrow}
          <span style={{ margin: '0 8px', color: '#FEC708' }}>•</span>
          {copy.promise}
        </div>

        {phase === 5 && (
          <svg
            viewBox="0 0 230 24"
            style={{
              position: 'absolute',
              top: 67,
              left: 30,
              width: 230,
              height: 24,
              overflow: 'visible',
            }}
          >
            <path
              d="M 0 12 L 205 12"
              fill="none"
              stroke="#FEC708"
              strokeWidth="4"
              strokeLinecap="round"
              style={{
                animation: 'zanaBusinessDepart 520ms cubic-bezier(.5,0,.75,0) forwards',
              }}
            />
            <circle
              cx="0"
              cy="12"
              r="5"
              fill="#59B02D"
              style={{
                animation: 'zanaBusinessDepartDot 520ms cubic-bezier(.5,0,.75,0) forwards',
              }}
            />
          </svg>
        )}
      </div>

      <style>{`
        @keyframes zanaBusinessPulse {
          0% { transform: scale(.3); opacity: 0; }
          55% { transform: scale(1.45); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes zanaBusinessRipple {
          0% { r: 11; opacity: .9; stroke-width: 2.5; }
          100% { r: 48; opacity: 0; stroke-width: .5; }
        }
        @keyframes zanaBusinessDepart {
          0% { stroke-dasharray: 0 205; opacity: 1; }
          60% { stroke-dasharray: 100 205; opacity: 1; }
          100% { stroke-dasharray: 0 205; stroke-dashoffset: -205; opacity: 0; }
        }
        @keyframes zanaBusinessDepartDot {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(215px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 1ms !important;
          }
        }
      `}</style>
    </div>
  );
}
