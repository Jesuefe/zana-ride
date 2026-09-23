'use client';

import { useEffect, useState } from 'react';
import { MapPin, UserRound, UsersRound, Navigation, Loader2 } from 'lucide-react';
import BrandedMap from './BrandedMap';
import { reverseGeocode } from '../lib/geocode';

export type OrderRecipient = {
  forSomeoneElse: boolean;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  note: string;
};

type Props = {
  value: OrderRecipient;
  onChange: (value: OrderRecipient) => void;
  defaultAddress: string;
  defaultLat: number;
  defaultLng: number;
};

export default function OrderRecipient({ value, onChange, defaultAddress, defaultLat, defaultLng }: Props) {
  const set = (patch: Partial<OrderRecipient>) => onChange({ ...value, ...patch });
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    if (!value.forSomeoneElse) return;
    setMapOpen(true);
  }, [value.forSomeoneElse]);

  const setCoordinates = async (lat: number, lng: number) => {
    set({ lat, lng });
    const address = await reverseGeocode(lat, lng);
    if (address) set({ address });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      p => {
        void setCoordinates(p.coords.latitude, p.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="border border-gray-100 rounded-2xl p-3 bg-gray-50/70">
      <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">Deliver to</p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button type="button" onClick={() => set({
          forSomeoneElse: false,
          name: '',
          phone: '',
          address: defaultAddress,
          lat: defaultLat,
          lng: defaultLng,
          note: '',
        })} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-xs font-bold ${!value.forSomeoneElse ? 'border-zana-primary bg-zana-primary text-white' : 'border-white bg-white text-gray-600'}`}>
          <UserRound size={14} /> Myself
        </button>
        <button type="button" onClick={() => set({ forSomeoneElse: true })} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-xs font-bold ${value.forSomeoneElse ? 'border-zana-primary bg-zana-primary text-white' : 'border-white bg-white text-gray-600'}`}>
          <UsersRound size={14} /> Someone else
        </button>
      </div>

      {value.forSomeoneElse ? (
        <div className="space-y-2">
          <input value={value.name} onChange={e => set({ name: e.target.value })} placeholder="Recipient full name" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zana-primary" />
          <input value={value.phone} onChange={e => set({ phone: e.target.value })} placeholder="Recipient phone number" inputMode="tel" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zana-primary" />

          <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
            {mapOpen && (
              <BrandedMap
                origin={{ lat: value.lat, lng: value.lng }}
                height={170}
                draggablePickup
                onPickupChange={(coords) => { void setCoordinates(coords.lat, coords.lng); }}
              />
            )}
            <div className="p-2.5">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-zana-primary shrink-0" />
                <input value={value.address} onChange={e => set({ address: e.target.value })} placeholder="Delivery address" className="w-full text-sm outline-none" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Drag the pin to the recipient's exact location. The order sends these coordinates with the address.</p>
              <button type="button" onClick={useCurrentLocation} disabled={locating} className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-zana-primary disabled:opacity-50">
                {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                Use this device's current location
              </button>
            </div>
          </div>

          <input value={value.note} onChange={e => set({ note: e.target.value })} placeholder="Delivery note (optional)" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zana-primary" />
          <p className="text-[10px] text-gray-400">The account holder pays. The recipient only receives the order.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded-xl px-3 py-2.5">
          <MapPin size={14} className="text-zana-primary shrink-0" />
          <span className="truncate">{defaultAddress || 'Your saved delivery location'}</span>
        </div>
      )}
    </div>
  );
}
