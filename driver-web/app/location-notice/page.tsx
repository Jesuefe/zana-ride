'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Eye, BatteryCharging, ShieldCheck } from 'lucide-react';

/**
 * Shown before the system location prompt.
 *
 * Google Play requires a prominent in-app disclosure explaining background
 * location collection *before* the permission dialog appears. Its absence is
 * one of the most common reasons a driver app is rejected. It is also simply
 * the decent thing to do — a rider should know what is being collected before
 * being asked, not after.
 */
export default function LocationNotice() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try { localStorage.setItem('zana_location_disclosed', '1'); } catch {}

    // Only now do we trigger the system prompt.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => router.replace('/'),
        () => router.replace('/'),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } else {
      router.replace('/');
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 pt-16 pb-10 flex flex-col">
      <div className="w-14 h-14 rounded-2xl bg-zana-primary-light flex items-center justify-center mb-6">
        <MapPin size={26} className="text-zana-primary" />
      </div>

      <h1 className="text-2xl font-black text-gray-900 leading-tight">
        Zana needs your location,
        <br />
        including in the background
      </h1>

      <p className="text-sm text-gray-500 mt-3">
        Before we ask your phone for permission, here is exactly what that
        means.
      </p>

      <div className="space-y-5 mt-8 flex-1">
        <div className="flex gap-3">
          <Eye size={17} className="text-zana-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-gray-900">
              Customers can see where their parcel is
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
              While you are carrying a job, your position is shared with the
              customer waiting for it and with Zana support.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <BatteryCharging size={17} className="text-zana-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-gray-900">
              It keeps working when your screen is off
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
              You will put your phone in your pocket while riding. Without
              background access, tracking stops and the customer sees you frozen
              in the wrong place.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <ShieldCheck size={17} className="text-zana-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-gray-900">
              It stops when you go offline
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
              Zana does not collect your location when you are offline or have
              no active job. Traces are kept for 90 days and never sold.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl px-4 py-3.5 mt-6">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          You can withdraw this permission at any time in your phone settings,
          though you will not be able to accept jobs without it. Full detail is
          in our{' '}
          <a
            href="https://zanaride.rw/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-zana-primary font-semibold"
          >
            privacy policy
          </a>
          .
        </p>
      </div>

      <button
        onClick={accept}
        disabled={busy}
        className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl mt-5 disabled:opacity-50"
      >
        {busy ? 'Opening…' : 'I understand — continue'}
      </button>

      <button
        onClick={() => router.back()}
        className="w-full text-sm text-gray-400 py-3"
      >
        Not now
      </button>
    </div>
  );
}
