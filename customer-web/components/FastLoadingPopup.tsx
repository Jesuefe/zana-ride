'use client';
import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';

// Replaces a static "Loading…" spinner with something that feels
// active rather than stuck — a branded icon with a gentle pulse, plus
// a short sequence of status lines that advance every ~750ms. Nothing
// here is tied to real backend progress; it's purely a perceived-speed
// technique, so the messages should describe what's plausibly
// happening, not claim precise, real milestones.
//
// Uses only stock Tailwind utilities (animate-pulse/animate-ping) plus
// a plain CSS transition triggered on mount — this project's Tailwind
// v4 setup doesn't include the tailwindcss-animate plugin, so classes
// like animate-in/zoom-in/slide-in would silently do nothing here.
export default function FastLoadingPopup({
  messages = ['Finding the best route…', 'Calculating your fare…', 'Confirming with Zana…'],
  visible,
}: {
  messages?: string[];
  visible: boolean;
}) {
  const [step, setStep] = useState(0);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!visible) { setStep(0); setEntered(false); return; }
    const id = requestAnimationFrame(() => setEntered(true));
    const interval = setInterval(() => {
      setStep(s => (s + 1) % messages.length);
    }, 750);
    return () => { cancelAnimationFrame(id); clearInterval(interval); };
  }, [visible, messages.length]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 transition-opacity duration-150"
      style={{ opacity: entered ? 1 : 0 }}
    >
      <div
        className="bg-white rounded-3xl px-8 py-9 flex flex-col items-center max-w-[260px] transition-all duration-200"
        style={{ opacity: entered ? 1 : 0, transform: entered ? 'scale(1)' : 'scale(0.92)' }}
      >
        <div className="relative w-16 h-16 mb-5">
          <div className="absolute inset-0 rounded-full bg-zana-primary/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-zana-primary flex items-center justify-center animate-pulse">
            <Package size={26} className="text-white" />
          </div>
        </div>
        <p className="text-sm font-semibold text-gray-900 text-center transition-opacity duration-200" key={step}>
          {messages[step]}
        </p>
      </div>
    </div>
  );
}
