'use client';

type ZanaLoadingProps = {
  label?: string;
  variant?: 'page' | 'inline';
};

export default function ZanaLoading({ label = 'Getting things ready', variant = 'page' }: ZanaLoadingProps) {
  return (
    <div className={`zana-loading zana-loading-${variant}`} role="status" aria-live="polite" aria-label={label}>
      <div className="zana-loading-brand" aria-hidden="true">
        <span className="zana-loading-mark">Z</span>
        <span className="zana-loading-orbit zana-loading-orbit-a" />
        <span className="zana-loading-orbit zana-loading-orbit-b" />
      </div>
      <div className="zana-loading-copy">
        <span className="zana-loading-title">{label}</span>
        <span className="zana-loading-track" aria-hidden="true"><span /></span>
      </div>
      {variant === 'page' && (
        <div className="zana-loading-skeletons" aria-hidden="true">
          <div className="zana-loading-skeleton zana-loading-skeleton-wide" />
          <div className="zana-loading-skeleton-row">
            <div className="zana-loading-skeleton zana-loading-skeleton-card" />
            <div className="zana-loading-skeleton zana-loading-skeleton-card" />
          </div>
          <div className="zana-loading-skeleton zana-loading-skeleton-line" />
          <div className="zana-loading-skeleton zana-loading-skeleton-line zana-loading-skeleton-short" />
        </div>
      )}
    </div>
  );
}
