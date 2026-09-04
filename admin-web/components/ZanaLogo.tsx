'use client';

/**
 * Zana logo, rebuilt as vector so it renders crisply at any size and can
 * recolour for dark mode. Three variants:
 *   mark      — the Z with its road and destination pin
 *   wordmark  — "zana" text only
 *   full      — mark above wordmark, with the optional tagline
 */

const TEAL = '#00A082';
const YELLOW = '#FFC244';

export function ZanaMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="Zana">
      {/* The Z, drawn as a road */}
      <path
        d="M 22 22 L 74 22 L 30 70 L 82 70"
        stroke={YELLOW}
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Centre dashes — reads as a road rather than a letter */}
      <path
        d="M 22 22 L 74 22 L 30 70 L 82 70"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 8"
        fill="none"
        opacity="0.85"
      />
      {/* Destination pin at the end of the route */}
      <path
        d="M 82 58 C 87 58 91 62 91 67 C 91 73 82 82 82 82 C 82 82 73 73 73 67 C 73 62 77 58 82 58 Z"
        fill={TEAL}
      />
      <circle cx="82" cy="67" r="3.4" fill="#FFFFFF" />
    </svg>
  );
}

export function ZanaWordmark({
  size = 32,
  color = '#1A1A2E',
}: { size?: number; color?: string }) {
  return (
    <span
      style={{
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        fontSize: size,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        color,
      }}
    >
      z<span style={{ color: TEAL }}>a</span>na
    </span>
  );
}

export default function ZanaLogo({
  variant = 'full',
  size = 40,
  color = '#1A1A2E',
  tagline = false,
}: {
  variant?: 'mark' | 'wordmark' | 'full' | 'horizontal';
  size?: number;
  color?: string;
  tagline?: boolean;
}) {
  if (variant === 'mark') return <ZanaMark size={size} />;
  if (variant === 'wordmark') return <ZanaWordmark size={size} color={color} />;

  if (variant === 'horizontal') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.2 }}>
        <ZanaMark size={size} />
        <ZanaWordmark size={size * 0.78} color={color} />
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.12 }}>
      <ZanaMark size={size} />
      <ZanaWordmark size={size * 0.62} color={color} />
      {tagline && (
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: Math.max(7, size * 0.13),
            fontWeight: 700,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: '#9A9A96',
            marginTop: size * 0.06,
          }}
        >
          Ride<span style={{ color: TEAL }}>.</span> Deliver
          <span style={{ color: YELLOW }}>.</span> Connect
          <span style={{ color: TEAL }}>.</span>
        </span>
      )}
    </span>
  );
}
