'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Copy, Check, Share2, Clock, Loader2 } from 'lucide-react';
import { getCurrentPositionFresh } from '../../lib/location';
import { reverseGeocode } from '../../lib/geocode';
import { createLocationCode, LocationCode } from '../../lib/api/deliveries';
import { ApiError } from '../../lib/api/client';
import BrandedMap from '../../components/BrandedMap';

export default function ShareLocationPage() {
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('Locating…');
  const [code, setCode] = useState<LocationCode | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    getCurrentPositionFresh().then((c) => {
      if (!c) {
        setError('We need your location to create a code. Please allow location access.');
        return;
      }
      setCoords(c);
      reverseGeocode(c.lat, c.lng).then((a) => setAddress(a ?? 'Your current location'));
    });
  }, []);

  // Live countdown so it's obvious the code is short-lived.
  useEffect(() => {
    if (!code) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(code.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [code]);

  const handleGenerate = async () => {
    if (!coords) return;
    setGenerating(true);
    setError(null);
    try {
      setCode(await createLocationCode(coords.lat, coords.lng, address));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create a code right now.');
    } finally {
      setGenerating(false);
    }
  };

  const shareText = code
    ? `My Zana location code is ${code.code}. Use it in the Zana app to send my delivery here. It expires in 15 minutes.`
    : '';

  const handleShare = async () => {
    if (!code) return;
    // Uses the phone's native share sheet where available, so it goes
    // straight into WhatsApp/SMS rather than needing a manual copy-paste.
    if (navigator.share) {
      await navigator.share({ text: shareText }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const secs = secondsLeft !== null ? secondsLeft % 60 : 0;

  return (
    <div className="animate-fade-in">
      {coords && <BrandedMap origin={coords} height={180} />}

      <div className="p-4">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Send my location</h1>
        </div>

        <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2.5 mb-4">
          <MapPin size={15} className="text-zana-primary mt-0.5 shrink-0" />
          <p className="text-sm text-gray-900">{address}</p>
        </div>

        {error && <p className="text-xs text-zana-error mb-4">{error}</p>}

        {!code ? (
          <>
            <p className="text-sm text-zana-muted mb-5">
              Generate a short code for this exact spot and send it to whoever is delivering to you. They enter it in
              Zana and your location appears on their map — no address needed.
            </p>
            <button
              onClick={handleGenerate}
              disabled={!coords || generating}
              className="w-full bg-zana-primary text-white font-semibold py-3.5 rounded-xl disabled:opacity-40 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Creating code…
                </>
              ) : (
                <>
                  <MapPin size={16} /> Send My Location
                </>
              )}
            </button>
          </>
        ) : (
          <div className="animate-fade-slide-up">
            <div className="bg-zana-primary-dark rounded-2xl px-4 py-6 text-center text-white">
              <p className="text-xs text-white/70">Your location code</p>
              <p className="text-3xl font-bold tracking-wider mt-1.5">{code.code}</p>
              {secondsLeft !== null && secondsLeft > 0 ? (
                <div className="flex items-center justify-center gap-1.5 mt-3 text-white/70 text-xs">
                  <Clock size={12} />
                  Expires in {mins}:{String(secs).padStart(2, '0')}
                </div>
              ) : (
                <p className="text-xs text-zana-secondary mt-3">This code has expired</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 border border-zana-border py-3 rounded-xl text-sm font-semibold text-gray-700"
              >
                {copied ? <Check size={15} className="text-zana-success" /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy code'}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 bg-zana-primary text-white py-3 rounded-xl text-sm font-semibold"
              >
                <Share2 size={15} /> Share
              </button>
            </div>

            <p className="text-[11px] text-zana-muted mt-4 text-center">
              The code works once and expires after 15 minutes, so your location isn&apos;t shared any longer than needed.
            </p>

            {secondsLeft === 0 && (
              <button
                onClick={() => {
                  setCode(null);
                  setSecondsLeft(null);
                }}
                className="w-full mt-3 text-sm font-semibold text-zana-primary"
              >
                Generate a new code
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
