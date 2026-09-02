'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, MapPin, Loader2, Check } from 'lucide-react';
import { api } from '../../lib/api/client';
import { fetchWallet } from '../../lib/api/trips';
import { loadGoogleMaps } from '../../lib/mapsLoader';
import { getStoredPickup } from '../../lib/location';
import { reverseGeocode } from '../../lib/geocode';

const SPECIAL_REQUESTS = [
  'Airport Drop-off', 'Airport Pick-up', 'Bank Visit',
  'Hospital', 'Hotel', 'Wedding', 'Shopping Trip', 'School Run', 'Custom',
];

const SERVICE_TYPES = [
  { id: 'BIKE', label: 'Moto', sub: 'Fast & affordable' },
  { id: 'ECONOMY', label: 'Basic Car', sub: 'Up to 4 passengers' },
  { id: 'COMFORT', label: 'Premium Car', sub: 'Top-rated drivers' },
] as const;

const PAYMENT_OPTIONS = [
  { id: 'CASH' as const, label: 'Cash', sub: 'Pay driver directly' },
  { id: 'WALLET' as const, label: 'Zana Wallet', sub: 'Deducted at trip end' },
  { id: 'MOBILE_MONEY' as const, label: 'Mobile Money', sub: 'MoMo request at trip end' },
];

type PlaceResult = { address: string; lat: number; lng: number };

function PlaceInput({
  label,
  placeholder,
  value,
  onSelect,
  color = '#00A082',
}: {
  label: string;
  placeholder: string;
  value: PlaceResult | null;
  onSelect: (p: PlaceResult) => void;
  color?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<any>(null);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!inputRef.current || acRef.current) return;
      const G = (window as any).google.maps.places;
      acRef.current = new G.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'rw' },
        fields: ['formatted_address', 'geometry'],
      });
      acRef.current.addListener('place_changed', () => {
        const place = acRef.current.getPlace();
        if (place?.geometry?.location) {
          onSelect({
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    });
  }, []);

  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 block mb-1.5">{label}</label>
      <div className={`flex items-center gap-2 border-2 rounded-xl px-3 py-3 focus-within:border-zana-primary transition-colors ${value ? 'border-zana-primary/30 bg-zana-primary-light' : 'border-gray-200'}`}>
        <MapPin size={15} style={{ color }} className="shrink-0" />
        <input
          ref={inputRef}
          defaultValue={value?.address ?? ''}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent"
        />
        {value && <Check size={14} className="text-zana-primary shrink-0" />}
      </div>
      {value && <p className="text-[10px] text-zana-primary mt-1 truncate px-1">{value.address}</p>}
    </div>
  );
}

export default function ScheduleRidePage() {
  const router = useRouter();
  const [pickup, setPickup] = useState<PlaceResult | null>(null);
  const [destination, setDestination] = useState<PlaceResult | null>(null);
  const [serviceType, setServiceType] = useState<'BIKE' | 'ECONOMY' | 'COMFORT'>('ECONOMY');
  const [scheduledFor, setScheduledFor] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'WALLET' | 'MOBILE_MONEY'>('WALLET');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    fetchWallet().then((w: any) => setWalletBalance(w.balance)).catch(() => {});
  }, []);
  const [success, setSuccess] = useState(false);

  const minTime = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);
  const maxTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  // Pre-fill pickup from stored GPS
  useEffect(() => {
    const stored = getStoredPickup();
    reverseGeocode(stored.lat, stored.lng).then(addr => {
      setPickup({ address: addr ?? 'Current location', lat: stored.lat, lng: stored.lng });
    });
  }, []);

  const handleBook = async () => {
    if (!pickup || !destination || !scheduledFor) {
      setError('Please fill pickup, destination and time.');
      return;
    }
    setBooking(true);
    setError('');
    try {
      await api.post('/scheduled-rides', {
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destinationAddress: destination.address,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        serviceType,
        scheduledFor,
        specialRequest: specialRequest || undefined,
        paymentMethod,
      });
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? 'Could not schedule ride.');
    } finally {
      setBooking(false);
    }
  };

  if (success) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
      <div className="w-20 h-20 rounded-full bg-zana-primary-light flex items-center justify-center mb-4">
        <Check size={36} className="text-zana-primary" />
      </div>
      <h2 className="text-xl font-black text-gray-900 mb-2">Ride Scheduled</h2>
      <p className="text-sm text-gray-500 mb-1">Confirmed for</p>
      <p className="font-bold text-zana-primary">{new Date(scheduledFor).toLocaleString()}</p>
      {specialRequest && <p className="text-xs text-gray-400 mt-1">{specialRequest}</p>}
      <p className="text-xs text-gray-400 mt-4 max-w-xs">
        You will be notified 45 minutes before pickup. Your driver will be assigned automatically.
      </p>
      <button onClick={() => router.push('/')}
        className="mt-8 bg-zana-primary text-white font-bold px-10 py-3.5 rounded-2xl">
        Back to Home
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-black text-gray-900">Schedule a Ride</h1>
          <p className="text-xs text-gray-400">Book up to 24 hours in advance</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Pickup */}
        <PlaceInput
          label="Pickup location"
          placeholder="Where should we pick you up?"
          value={pickup}
          onSelect={setPickup}
          color="#00A082"
        />

        {/* Destination */}
        <PlaceInput
          label="Destination"
          placeholder="Where are you going?"
          value={destination}
          onSelect={setDestination}
          color="#E6A82E"
        />

        {/* Date & Time */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Pickup time</label>
          <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-3 focus-within:border-zana-primary transition-colors">
            <Clock size={15} className="text-gray-400 shrink-0" />
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={e => setScheduledFor(e.target.value)}
              min={minTime}
              max={maxTime}
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Service type */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Ride type</label>
          <div className="grid grid-cols-3 gap-2">
            {SERVICE_TYPES.map(s => (
              <button key={s.id} onClick={() => setServiceType(s.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                  serviceType === s.id ? 'border-zana-primary bg-zana-primary-light' : 'border-gray-100 bg-white'
                }`}>
                <p className={`text-sm font-bold ${serviceType === s.id ? 'text-zana-primary' : 'text-gray-800'}`}>{s.label}</p>
                <p className="text-[10px] text-gray-400 text-center leading-tight">{s.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Special request */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Special request (optional)</label>
          <div className="flex flex-wrap gap-2">
            {SPECIAL_REQUESTS.map(req => (
              <button key={req} onClick={() => setSpecialRequest(r => r === req ? '' : req)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  specialRequest === req
                    ? 'bg-zana-primary text-white border-zana-primary'
                    : 'border-gray-200 text-gray-600 bg-white'
                }`}>
                {req}
              </button>
            ))}
          </div>
        </div>

        {/* Payment method */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Payment method</label>
          <div className="space-y-2">
            {PAYMENT_OPTIONS.map(({ id, label, sub }) => (
              <button key={id} onClick={() => setPaymentMethod(id)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition-colors ${
                  paymentMethod === id ? 'border-zana-primary bg-zana-primary-light' : 'border-gray-100 bg-white'
                }`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  paymentMethod === id ? 'border-zana-primary' : 'border-gray-300'
                }`}>
                  {paymentMethod === id && <div className="w-2.5 h-2.5 rounded-full bg-zana-primary" />}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${paymentMethod === id ? 'text-zana-primary' : 'text-gray-800'}`}>{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-600 text-center">{error}</p>}

        <button onClick={handleBook} disabled={booking || !pickup || !destination || !scheduledFor}
          className="w-full bg-zana-primary text-white font-black text-base py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2">
          {booking
            ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scheduling...</>
            : <><Calendar size={18} /> Schedule Ride</>}
        </button>
      </div>
    </div>
  );
}
