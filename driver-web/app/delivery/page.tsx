'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { capturePhoto, stampPhoto } from '../../lib/photoCapture';
import { fetchMyDriverProfile } from '../../lib/api/driver';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Navigation, Phone, Package, ChevronRight, Check, X } from 'lucide-react';
import { api } from '../../lib/api/client';
import DriverBottomNav from '../../components/DriverBottomNav';
import DriverMap from '../../components/DriverMap';
import { watchPosition, Coords } from '../../lib/location';
import { updateDriverLocation } from '../../lib/api/driver';
import { Browser } from '@capacitor/browser';
import { useLang } from '../../lib/LangContext';

// Straight-line distance in meters — same small, self-contained pattern
// already used in a few other files in this app rather than a shared
// import, since it's just a few lines and has no other dependencies.
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// A safe fallback only — the real value is fetched from the backend on
// mount below, so it can be tuned per real-world GPS behavior in Kigali
// without needing to rebuild this app at all.
const DEFAULT_ARRIVAL_RADIUS_M = 200;

type ActiveDelivery = {
  id: string;
  status: string;
  trackingCode?: string | null;
  itemDescription: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  fee: number;
  customer?: { firstName: string | null; lastName: string | null; phone: string };
  merchant?: { businessName: string; businessAddress?: string; businessLat?: number; businessLng?: number };
  pickupContactName?: string | null;
  pickupPhone?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
};

function ActiveDeliveryContent() {
  const router = useRouter();
  const { dt } = useLang();
  const searchParams = useSearchParams();
  // Only ever set by the home screen's crash-recovery redirect — its
  // presence is what tells the driver "this wasn't a normal open, Zana
  // found and restored something for you" instead of leaving them to
  // notice the app still works and piece that together on their own.
  const [showRecoveredBanner, setShowRecoveredBanner] = useState(searchParams.get('recovered') === '1');
  const [delivery, setDelivery] = useState<ActiveDelivery | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allActive, setAllActive] = useState<any[]>([]);
  const [photoStage, setPhotoStage] = useState<'pickup' | 'dropoff' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoNote, setPhotoNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [arrivalRadiusM, setArrivalRadiusM] = useState(DEFAULT_ARRIVAL_RADIUS_M);

  // Fetched once on load — if this ever fails, the hardcoded default above
  // keeps the safety check working exactly as before, just not tunable
  // until the next successful fetch.
  useEffect(() => {
    api.get<{ deliveryGeofenceRadiusMeters: number }>('/driver/config')
      .then(c => { if (c?.deliveryGeofenceRadiusMeters) setArrivalRadiusM(c.deliveryGeofenceRadiusMeters); })
      .catch(() => {});
  }, []);

  // Everything the rider is carrying, so they can switch between stops
  useEffect(() => {
    const load = () =>
      api.get<any[]>('/driver/deliveries/active/all')
        .then(r => setAllActive(Array.isArray(r) ? r : []))
        .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  // Ping position so the customer, merchant and admin can follow the parcel
  useEffect(() => {
    if (!navigator.geolocation) return;
    const ping = () =>
      navigator.geolocation.getCurrentPosition(
        p => { api.post('/driver/deliveries/position', {
          lat: p.coords.latitude, lng: p.coords.longitude,
        }).catch(() => {}); },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    ping();
    const t = setInterval(ping, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = () => api.get<ActiveDelivery | null>('/driver/deliveries/active')
      .then(d => { setDelivery(d); setLoading(false); })
      .catch(() => setLoading(false));
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const stop = watchPosition(c => {
      if (c) {
        setCoords(c);
        updateDriverLocation(c.lat, c.lng).catch(() => {});
      }
    });
    return stop;
  }, []);

  // Downscale before upload — riders are often on a weak connection.
  const compress = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const max = 1000;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('no canvas'));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Goes through Capacitor's Camera plugin rather than a raw file input.
  // A file input hands control to the system camera app, and Android is
  // free to kill the WebView process while that app is in the foreground —
  // when control returns, the app restarted because its JS state was gone.
  // The Camera plugin is built specifically to survive that round trip.
  const runCapture = async (stage: 'pickup' | 'dropoff') => {
    if (!delivery) return;
    setUploading(true);
    setPhotoNote('');
    setActionError('');
    try {
      const shot = await capturePhoto();
      if (!shot) { setUploading(false); return; }

      const me = await fetchMyDriverProfile().catch(() => null);
      const name = (me as any)?.user?.firstName ? `${(me as any).user.firstName}` : 'Zana rider';
      const stamped = await stampPhoto(shot.base64, name, shot.lat != null && shot.lng != null
        ? { lat: shot.lat, lng: shot.lng } : undefined);

      await api.post(`/deliveries/${delivery.id}/photo/${stage}`, { imageBase64: stamped });
    } catch {
      // Upload failed — record it but let the delivery continue. A rider
      // should never be stuck at a door because a photo did not send.
      setPhotoNote(dt('Photo could not upload. Continuing without it.'));
    } finally {
      setUploading(false);
      if (stage === 'pickup') await doPickup();
      else await doComplete();
    }
  };

  const doPickup = async () => {
    if (!delivery) return;
    setActing(true);
    try {
      await api.post(`/driver/deliveries/${delivery.id}/pickup`);
    } catch (e: any) {
      // Was previously swallowed entirely — a rejected pickup (wrong
      // state, payment never confirmed, anything else) left the driver
      // staring at an unexplained stuck screen with no idea why nothing
      // happened.
      setActionError(e?.message || dt('Could not confirm pickup. Please try again.'));
      setActing(false);
      return;
    }
    const updated = await api.get<ActiveDelivery | null>('/driver/deliveries/active').catch(() => null);
    setDelivery(updated);
    setActing(false);
  };

  const doComplete = async () => {
    if (!delivery) return;
    setActing(true);
    try {
      await api.post(`/driver/deliveries/${delivery.id}/complete`);
    } catch (e: any) {
      setActionError(e?.message || dt('Could not confirm delivery. Please try again.'));
      setActing(false);
      return;
    }
    // Was unconditional — every single delivery completion sent the driver
    // home, even with more packages still waiting in the same batch. Pickup
    // already correctly stayed on this page and advanced to the next stop;
    // completion needs the exact same check before it can bounce home.
    const next = await api.get<ActiveDelivery | null>('/driver/deliveries/active').catch(() => null);
    setActing(false);
    if (next) {
      setDelivery(next);
    } else {
      router.push('/?delivered=1');
    }
  };

  // Both stages ask for a photo first.
  const handlePickup = () => runCapture('pickup');
  const handleComplete = () => runCapture('dropoff');

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!delivery) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 p-6 text-center">
      <Package size={40} className="text-gray-200" />
      <p className="font-semibold text-gray-700">{dt('No active delivery')}</p>
      <button onClick={() => router.push('/deliveries')} className="bg-zana-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
        {dt('Browse deliveries')}
      </button>
    </div>
  );

  const isPickup = delivery.status === 'COURIER_ASSIGNED';
  const target = isPickup
    ? { lat: delivery.pickupLat, lng: delivery.pickupLng }
    : { lat: delivery.dropoffLat, lng: delivery.dropoffLng };

  // Previously the confirm button worked from anywhere at all, regardless
  // of whether the driver had actually reached the pickup or drop-off —
  // no check existed. If GPS hasn't resolved yet, don't block the driver
  // on that alone; only block once we genuinely know they're too far.
  const distanceToTarget = coords ? distanceMeters(coords.lat, coords.lng, target.lat, target.lng) : null;
  const closeEnough = distanceToTarget === null || distanceToTarget <= arrivalRadiusM;

  return (
    <div className="h-screen flex flex-col relative">
      {/* Other parcels this rider is carrying */}
      {allActive.length > 1 && (
        <div className="px-4 py-2 bg-white border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            {dt('Carrying')} {allActive.length} {dt('parcels')}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {allActive.map((a: any, i: number) => {
              const isCurrent = a.id === delivery?.id;
              // Not tappable — this page never actually read the ?id= this
              // used to navigate to, so tapping a different parcel did
              // nothing at all despite looking interactive. The spec here
              // is explicit that Zana determines the next stop, not the
              // driver, so the honest fix is a clear display strip, not a
              // half-built manual-switch feature nothing asked for.
              return (
                <div
                  key={a.id}
                  className={`shrink-0 px-3 py-2 rounded-xl border-2 text-left ${
                    isCurrent ? 'border-zana-primary bg-zana-primary-light' : 'border-gray-100 bg-white'
                  }`}
                >
                  <p className="text-[10px] font-bold text-gray-400">
                    {dt('Stop')} {a.routeSequence ?? i + 1}
                  </p>
                  <p className={`text-xs font-bold line-clamp-1 max-w-32 ${
                    isCurrent ? 'text-zana-primary' : 'text-gray-800'
                  }`}>
                    {a.itemDescription}
                  </p>
                  <p className="text-[9px] text-gray-400">
                    {a.status === 'PICKED_UP' ? dt('On board') : dt('To collect')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Uploading overlay */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60">
          <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-white font-bold">{dt('Uploading photo…')}</p>
          <p className="text-white/60 text-xs mt-1">{dt('Proof of handling')}</p>
        </div>
      )}

      {photoNote && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-800">{photoNote}</p>
        </div>
      )}

      {actionError && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-xs text-red-800 flex-1">{actionError}</p>
          <button onClick={() => setActionError('')} className="text-red-400 text-xs font-bold shrink-0">✕</button>
        </div>
      )}

      {/* Shown once, only when this screen was reached via crash recovery
          rather than a normal open — using only real, currently-known
          data (the actual package ID and status), no invented ETA. */}
      {showRecoveredBanner && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-4 animate-fade-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">{dt('Active delivery restored')}</p>
              <p className="text-xs text-zana-muted mt-0.5">
                {delivery.trackingCode ?? delivery.itemDescription}
                {' · '}
                {isPickup ? dt('Status: To collect') : dt('Status: Picked up')}
                {' · '}
                {isPickup ? dt('Next stop: Pickup') : dt('Next stop: Customer')}
              </p>
            </div>
            <button
              onClick={() => setShowRecoveredBanner(false)}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
              aria-label={dt('Dismiss')}
            >
              <X size={14} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="flex-shrink-0" style={{ height: '45%' }}>
        <DriverMap
          position={coords}
          target={target}
          navigationMode
          height="100%"
        />
      </div>

      {/* Bottom sheet */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 overflow-y-auto shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />
        <div className="px-4 pb-8 space-y-4">

          {/* Status */}
          <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${isPickup ? 'bg-amber-50' : 'bg-zana-primary-light'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPickup ? 'bg-amber-100' : 'bg-zana-primary/20'}`}>
              {isPickup ? <MapPin size={18} className="text-amber-600" /> : <Navigation size={18} className="text-zana-primary" />}
            </div>
            <div>
              <p className={`font-bold text-sm ${isPickup ? 'text-amber-800' : 'text-zana-primary'}`}>
                {isPickup ? dt('Go to pickup location') : dt('Deliver to customer')}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isPickup ? delivery.pickupAddress : delivery.dropoffAddress}
              </p>
            </div>
          </div>

          {/* Package info */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{dt('Package')}</p>
            <p className="font-semibold text-gray-900">{delivery.itemDescription}</p>
            {delivery.merchant && (
              <p className="text-xs text-gray-400 mt-1">{dt('From:')} {delivery.merchant.businessName}</p>
            )}
          </div>

          {/* Route */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-zana-primary" />
                <div className="w-0.5 h-8 bg-gray-200" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">{dt('Pickup')}</p>
                  <p className="text-sm text-gray-800">{delivery.pickupAddress}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">{dt('Dropoff')}</p>
                  <p className="text-sm text-gray-800">{delivery.dropoffAddress}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pickup contact — the rider sees the market agent/person and phone */}
          {delivery.pickupPhone && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <div>
                <p className="text-xs text-amber-700">{dt('Pickup contact')}</p>
                <p className="font-semibold text-gray-900">{delivery.pickupContactName || dt('Pickup person')}</p>
                <p className="text-xs text-gray-600 mt-0.5">{delivery.pickupPhone}</p>
              </div>
              <a href={'tel:' + delivery.pickupPhone} className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center" aria-label={dt('Call pickup contact')}><Phone size={16} className="text-green-600" /></a>
            </div>
          )}

          {/* Recipient/customer contact */}
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3">
            <div>
              <p className="text-xs text-gray-400">{dt('Customer / recipient')}</p>
              <p className="font-semibold text-gray-900">{delivery.recipientName || (delivery.customer ? [delivery.customer.firstName, delivery.customer.lastName].filter(Boolean).join(' ') : dt('Recipient'))}</p>
              <p className="text-xs text-gray-600 mt-0.5">{delivery.recipientPhone || delivery.customer?.phone}</p>
            </div>
            {(delivery.recipientPhone || delivery.customer?.phone) && <a href={'tel:' + (delivery.recipientPhone || delivery.customer?.phone)} className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center" aria-label={dt('Call customer')}><Phone size={16} className="text-green-600" /></a>}
          </div>

          {/* Earnings */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{dt('Your earnings')}</span>
            <span className="text-lg font-black text-zana-primary">{Math.round(delivery.fee * 0.85).toLocaleString()} RWF</span>
          </div>

          {/* Distance notice — only shown when genuinely too far, not
              just because GPS hasn't resolved yet */}
          {!closeEnough && distanceToTarget !== null && (
            <p className="text-xs text-amber-600 text-center -mb-1">
              {Math.round(distanceToTarget)}{dt('m away — move closer to confirm')}
            </p>
          )}

          {/* Open Google Maps — same official cross-platform URL scheme,
              same Browser.open-with-fallback pattern already proven on
              the ride trip screen, just never wired in here. A driver
              working through a multi-package batch benefits from this
              even more than on a single ride — this always points at
              whichever stop (pickup or dropoff) is actually next. */}
          <button
            onClick={async () => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`;
              try {
                await Browser.open({ url, presentationStyle: 'popover', toolbarColor: '#00A082' });
              } catch {
                window.open(url, '_system');
              }
            }}
            className="w-full bg-white border-2 border-zana-primary text-zana-primary font-black py-3.5 rounded-2xl text-base flex items-center justify-center gap-2">
            <Navigation size={18} />
            {dt('Navigate')}
          </button>

          {/* Action button */}
          {isPickup && (
            <button onClick={handlePickup} disabled={acting || !closeEnough}
              className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50">
              {acting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
              {dt('Confirm Pickup')}
            </button>
          )}

          {!isPickup && (
            <button onClick={handleComplete} disabled={acting || !closeEnough}
              className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50">
              {acting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
              {dt('Confirm Delivery')}
            </button>
          )}
        </div>
      </div>
      <DriverBottomNav />
    </div>
  );
}

export default function ActiveDeliveryPage() {
  return (
    <Suspense fallback={null}>
      <ActiveDeliveryContent />
    </Suspense>
  );
}
