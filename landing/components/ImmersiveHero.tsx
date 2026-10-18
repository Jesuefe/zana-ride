'use client';

import { useEffect, useState } from 'react';

export default function ImmersiveHero() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  function move(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion || window.matchMedia('(max-width: 760px)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((e.clientY - rect.top) / rect.height - 0.5) * -7,
      y: ((e.clientX - rect.left) / rect.width - 0.5) * 9,
    });
  }

  return (
    <div
      className={`immersive-stage ${reducedMotion ? 'motion-reduced' : ''}`}
      onMouseMove={move}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      aria-label="A 3D-inspired Zana Ride scene showing Kigali, a moto, and the Zana booking app"
    >
      <div className="stage-halo" />
      <div className="stage-grid" />
      <div className="stage-orbit orbit-one" />
      <div className="stage-orbit orbit-two" />
      <div className="skyline skyline-back" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i /><i /><i />
      </div>
      <div className="skyline skyline-front" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
      </div>
      <div className="stage-road" aria-hidden="true">
        <span /><span /><span />
      </div>

      <div className="vehicle-plinth" style={{ transform: `translateZ(35px) rotateX(58deg) rotateZ(-18deg) translateY(35px)` }} />
      <div className="moto-scene" style={{ transform: `translateZ(75px) rotateX(${tilt.x}deg) rotateY(${tilt.y - 13}deg)` }} aria-hidden="true">
        <div className="moto-shadow" />
        <div className="wheel wheel-back"><span /></div>
        <div className="wheel wheel-front"><span /></div>
        <div className="moto-frame" />
        <div className="moto-body"><span className="moto-mark">Z</span></div>
        <div className="moto-seat" />
        <div className="moto-fork" />
        <div className="moto-handle" />
        <div className="moto-light" />
        <div className="moto-rider"><span /><i /><b /></div>
      </div>

      <div className="phone-float" style={{ transform: `translateZ(125px) rotateX(${tilt.x * 0.65 - 2}deg) rotateY(${tilt.y * 0.8 + 9}deg) rotateZ(-5deg)` }}>
        <div className="phone-frame">
          <div className="phone-island" />
          <div className="phone-screen">
            <div className="phone-status"><span>9:41</span><span>●●● ▰</span></div>
            <div className="phone-brand"><span className="phone-logo">Z</span><span>Zana</span><b>•••</b></div>
            <p className="phone-greeting">Good morning</p>
            <h3>Where to?</h3>
            <div className="phone-search"><span className="search-dot" /> Enter destination <b>⌕</b></div>
            <div className="phone-map">
              <div className="map-road map-road-a" /><div className="map-road map-road-b" /><div className="map-road map-road-c" />
              <span className="map-pin pin-start" /><span className="map-pin pin-end" />
              <div className="map-route" />
            </div>
            <div className="phone-options">
              <div className="phone-option active"><span className="option-icon moto-icon">M</span><span><b>Moto</b><small>Fast and easy</small></span><strong>1,500 <small>RWF</small></strong></div>
              <div className="phone-option"><span className="option-icon car-icon">C</span><span><b>Car</b><small>Ride in comfort</small></span><strong>9,000 <small>RWF</small></strong></div>
            </div>
            <div className="phone-book">Find a ride <span>→</span></div>
          </div>
        </div>
        <div className="phone-glow" />
      </div>

      <div className="float-chip chip-live"><span className="live-dot" /><span><b>You're in control</b><small>Track every trip</small></span></div>
      <div className="float-chip chip-delivery"><span className="chip-icon">↗</span><span><b>More than a ride</b><small>Food · parcels · shopping</small></span></div>
      <div className="stage-caption"><span className="caption-line" /> MADE FOR KIGALI <span className="caption-dot">•</span> BUILT TO MOVE</div>
    </div>
  );
}
