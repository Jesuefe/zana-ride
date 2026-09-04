'use client';

/**
 * Zana logo. Uses the real brand artwork with transparent backgrounds so it
 * sits correctly on light and dark surfaces.
 *
 * Brand colours, sampled from the supplied artwork:
 *   yellow #FEC708  — the Z and its road
 *   green  #59B02D  — the destination pin and the "a"
 */

export const ZANA_YELLOW = '#FEC708';
export const ZANA_GREEN = '#59B02D';

/** The Z mark on its own — app icons, avatars, tight spaces. */
export function ZanaMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/zana-mark.png"
      alt="Zana"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** "zana" wordmark. On dark surfaces the supplied artwork already reads white. */
export function ZanaWordmark({
  size = 32,
  color,
  className = '',
}: { size?: number; color?: string; className?: string }) {
  // The artwork's own letters are white, which vanishes on light backgrounds,
  // so render type there and fall back to the artwork on dark.
  if (color && color.toUpperCase() !== '#FFFFFF') {
    return (
      <span
        className={className}
        style={{
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSize: size,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color,
        }}
      >
        z<span style={{ color: ZANA_GREEN }}>a</span>na
      </span>
    );
  }

  return (
    <img
      src="/zana-wordmark.png"
      alt="Zana"
      className={`object-contain ${className}`}
      style={{ height: size * 1.1, width: 'auto' }}
    />
  );
}

/** Mark and wordmark side by side — headers and sign-in screens. */
export function ZanaHorizontal({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/zana-horizontal.png"
      alt="Zana"
      className={`object-contain ${className}`}
      style={{ height: size, width: 'auto' }}
    />
  );
}

export default function ZanaLogo({
  variant = 'horizontal',
  size = 40,
  color,
  tagline = false,
  className = '',
}: {
  variant?: 'mark' | 'wordmark' | 'horizontal' | 'full';
  size?: number;
  color?: string;
  tagline?: boolean;
  className?: string;
}) {
  if (variant === 'mark') return <ZanaMark size={size} className={className} />;
  if (variant === 'wordmark') return <ZanaWordmark size={size} color={color} className={className} />;
  if (variant === 'horizontal') return <ZanaHorizontal size={size} className={className} />;

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.14 }}
    >
      <ZanaMark size={size} />
      <ZanaWordmark size={size * 0.5} color={color} />
      {tagline && (
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: Math.max(7, size * 0.12),
            fontWeight: 700,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: '#9A9A96',
            marginTop: size * 0.05,
          }}
        >
          Ride<span style={{ color: ZANA_GREEN }}>.</span> Deliver
          <span style={{ color: ZANA_YELLOW }}>.</span> Connect
          <span style={{ color: ZANA_GREEN }}>.</span>
        </span>
      )}
    </span>
  );
}
