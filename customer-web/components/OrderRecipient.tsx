'use client';

import { MapPin, UserRound, UsersRound, Navigation } from 'lucide-react';

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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => set({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
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
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
              <MapPin size={14} className="text-zana-primary shrink-0" />
              <input value={value.address} onChange={e => set({ address: e.target.value })} placeholder="Delivery address" className="w-full py-2.5 text-sm outline-none" />
            </div>
            <button type="button" onClick={useCurrentLocation} title="Use this device's current location" className="w-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <Navigation size={15} className="text-zana-primary" />
            </button>
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
