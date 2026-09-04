'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Phone, Package, ChevronRight, Check } from 'lucide-react';
import { api } from '../../lib/api/client';
import DriverBottomNav from '../../components/DriverBottomNav';
import DriverMap from '../../components/DriverMap';
import { watchPosition, Coords } from '../../lib/location';
import { updateDriverLocation } from '../../lib/api/driver';

type ActiveDelivery = {
  id: string;
  status: string;
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
};

export default function ActiveDeliveryPage() {
  const router = useRouter();
  const [delivery, setDelivery] = useState<ActiveDelivery | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allActive, setAllActive] = useState<any[]>([]);
  const [photoStage, setPhotoStage] = useState<'pickup' | 'dropoff' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoNote, setPhotoNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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

  const onPhotoPicked = async (file: File | undefined) => {
    if (!file || !delivery || !photoStage) return;
    const stage = photoStage;
    setUploading(true);
    setPhotoNote('');
    try {
      const base64 = await compress(file);
      await api.post(`/deliveries/${delivery.id}/photo/${stage}`, { imageBase64: base64 });
    } catch {
      // Upload failed — record it but let the delivery continue.
      setPhotoNote('Photo could not upload. Continuing without it.');
    } finally {
      setUploading(false);
      setPhotoStage(null);
      if (stage === 'pickup') await doPickup();
      else await doComplete();
    }
  };

  const doPickup = async () => {
    if (!delivery) return;
    setActing(true);
    await api.post(`/driver/deliveries/${delivery.id}/pickup`).catch(() => {});
    const updated = await api.get<ActiveDelivery | null>('/driver/deliveries/active').catch(() => null);
    setDelivery(updated);
    setActing(false);
  };

  const doComplete = async () => {
    if (!delivery) return;
    setActing(true);
    await api.post(`/driver/deliveries/${delivery.id}/complete`).catch(() => {});
    setActing(false);
    router.push('/?delivered=1');
  };

  // Both stages ask for a photo first.
  const handlePickup = () => { setPhotoStage('pickup'); fileRef.current?.click(); };
  const handleComplete = () => { setPhotoStage('dropoff'); fileRef.current?.click(); };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      {/* Hidden camera input — capture opens the rear camera on mobile */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => onPhotoPicked(e.target.files?.[0])}
      />

      {/* Other parcels this rider is carrying */}
      {allActive.length > 1 && (
        <div className="px-4 py-2 bg-white border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            Carrying {allActive.length} parcels
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {allActive.map((a: any, i: number) => {
              const isCurrent = a.id === delivery?.id;
              return (
                <button
                  key={a.id}
                  onClick={() => router.push(`/delivery?id=${a.id}`)}
                  className={`shrink-0 px-3 py-2 rounded-xl border-2 text-left ${
                    isCurrent ? 'border-zana-primary bg-zana-primary-light' : 'border-gray-100 bg-white'
                  }`}
                >
                  <p className="text-[10px] font-bold text-gray-400">
                    Stop {a.routeSequence ?? i + 1}
                  </p>
                  <p className={`text-xs font-bold line-clamp-1 max-w-32 ${
                    isCurrent ? 'text-zana-primary' : 'text-gray-800'
                  }`}>
                    {a.itemDescription}
                  </p>
                  <p className="text-[9px] text-gray-400">
                    {a.status === 'PICKED_UP' ? 'On board' : 'To collect'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Uploading overlay */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60">
          <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-white font-bold">Uploading photo…</p>
          <p className="text-white/60 text-xs mt-1">Proof of handling</p>
        </div>
      )}

      {photoNote && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-800">{photoNote}</p>
        </div>
      )}

      <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!delivery) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 p-6 text-center">
      <Package size={40} className="text-gray-200" />
      <p className="font-semibold text-gray-700">No active delivery</p>
      <button onClick={() => router.push('/deliveries')} className="bg-zana-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
        Browse deliveries
      </button>
    </div>
  );

  const isPickup = delivery.status === 'COURIER_ASSIGNED';
  const target = isPickup
    ? { lat: delivery.pickupLat, lng: delivery.pickupLng }
    : { lat: delivery.dropoffLat, lng: delivery.dropoffLng };

  return (
    <div className="h-screen flex flex-col">
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
                {isPickup ? 'Go to pickup location' : 'Deliver to customer'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isPickup ? delivery.pickupAddress : delivery.dropoffAddress}
              </p>
            </div>
          </div>

          {/* Package info */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Package</p>
            <p className="font-semibold text-gray-900">{delivery.itemDescription}</p>
            {delivery.merchant && (
              <p className="text-xs text-gray-400 mt-1">From: {delivery.merchant.businessName}</p>
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
                  <p className="text-[10px] text-gray-400 uppercase">Pickup</p>
                  <p className="text-sm text-gray-800">{delivery.pickupAddress}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Dropoff</p>
                  <p className="text-sm text-gray-800">{delivery.dropoffAddress}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer contact */}
          {delivery.customer && (
            <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3">
              <div>
                <p className="text-xs text-gray-400">Customer</p>
                <p className="font-semibold text-gray-900">{delivery.customer.firstName} {delivery.customer.lastName}</p>
              </div>
              <a href={`tel:${delivery.customer.phone}`}
                className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Phone size={16} className="text-green-600" />
              </a>
            </div>
          )}

          {/* Earnings */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Your earnings</span>
            <span className="text-lg font-black text-zana-primary">{Math.round(delivery.fee * 0.85).toLocaleString()} RWF</span>
          </div>

          {/* Action button */}
          {isPickup && (
            <button onClick={handlePickup} disabled={acting}
              className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50">
              {acting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
              Confirm Pickup
            </button>
          )}

          {!isPickup && (
            <button onClick={handleComplete} disabled={acting}
              className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50">
              {acting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
              Confirm Delivery
            </button>
          )}
        </div>
      </div>
      <DriverBottomNav />
    </div>
  );
}
