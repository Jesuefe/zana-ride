'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin, Clock, Loader2, Star } from 'lucide-react';
import { api } from '../../lib/api/client';

const SPECIAL_REQUESTS = [
  'Airport Drop-off', 'Airport Pick-up', 'Bank Visit',
  'Hospital', 'Hotel', 'Wedding', 'Shopping Trip',
  'School Run', 'Custom',
];

const SERVICE_TYPES = [
  { id: 'ECONOMY', label: 'Economy', icon: '', sub: 'Standard car' },
  { id: 'COMFORT', label: 'Comfort', icon: '', sub: 'Premium car' },
  { id: 'BIKE', label: 'Moto', icon: '', sub: 'Fast & affordable' },
];

export default function ScheduleRidePage() {
  const router = useRouter();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [serviceType, setServiceType] = useState('ECONOMY');
  const [scheduledFor, setScheduledFor] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH'|'WALLET'|'MOBILE_MONEY'>('CASH');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const minTime = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);
  const maxTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  const handleBook = async () => {
    if (!pickup || !destination || !scheduledFor) { setError('Please fill all required fields.'); return; }
    setBooking(true); setError('');
    try {
      await api.post('/scheduled-rides', {
        pickupAddress: pickup, pickupLat: -1.9536, pickupLng: 30.0605,
        destinationAddress: destination, destinationLat: -1.97, destinationLng: 30.12,
        serviceType, scheduledFor,
        specialRequest: specialRequest || undefined,
        paymentMethod,
      });
      setSuccess(true);
    } catch (e: any) { setError(e.message ?? 'Could not schedule ride.'); }
    finally { setBooking(false); }
  };

  if (success) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl mb-4"></div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Ride Scheduled!</h2>
      <p className="text-sm text-gray-500 mb-1">Your ride is confirmed for</p>
      <p className="font-semibold text-zana-primary">{new Date(scheduledFor).toLocaleString()}</p>
      {specialRequest && <p className="text-xs text-gray-400 mt-1">{specialRequest}</p>}
      <p className="text-xs text-gray-400 mt-4">You'll be notified 45 minutes before pickup.</p>
      <button onClick={() => router.push('/')} className="mt-6 bg-zana-primary text-white font-semibold px-8 py-3 rounded-xl">
        Back to Home
      </button>
    </div>
  );

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Schedule a Ride</h1>
          <p className="text-xs text-gray-400">Book up to 24 hours in advance</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Pickup */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Pickup location</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-zana-primary/30">
            <MapPin size={15} className="text-zana-primary shrink-0" />
            <input value={pickup} onChange={e => setPickup(e.target.value)} placeholder="Enter pickup address"
              className="flex-1 text-sm outline-none" />
          </div>
        </div>

        {/* Destination */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Destination</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-zana-primary/30">
            <MapPin size={15} className="text-amber-500 shrink-0" />
            <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Enter destination"
              className="flex-1 text-sm outline-none" />
          </div>
        </div>

        {/* Date/time */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Pickup time</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-zana-primary/30">
            <Clock size={15} className="text-gray-400 shrink-0" />
            <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
              min={minTime} max={maxTime} className="flex-1 text-sm outline-none" />
          </div>
        </div>

        {/* Service type */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Service type</label>
          <div className="grid grid-cols-3 gap-2">
            {SERVICE_TYPES.map(s => (
              <button key={s.id} onClick={() => setServiceType(s.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                  serviceType === s.id ? 'border-zana-primary bg-zana-primary-light' : 'border-gray-100'
                }`}>
                <span className="text-xl">{s.icon}</span>
                <span className="text-xs font-semibold text-gray-900">{s.label}</span>
                <span className="text-[10px] text-gray-400">{s.sub}</span>
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
                  specialRequest === req ? 'bg-zana-primary text-white border-zana-primary' : 'border-gray-200 text-gray-600'
                }`}>
                {req}
              </button>
            ))}
          </div>
        </div>

        {/* Payment */}
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            {([['CASH','Cash','Cash'],['WALLET','Wallet','Wallet'],['MOBILE_MONEY','MoMo','MoMo']] as const).map(([id, icon, label]) => (
              <button key={id} onClick={() => setPaymentMethod(id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-semibold transition-colors ${
                  paymentMethod === id ? 'border-zana-primary bg-zana-primary-light text-zana-primary' : 'border-gray-100 text-gray-500'
                }`}>
                <span className="text-xl">{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button onClick={handleBook} disabled={booking}
          className="w-full bg-zana-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
          {booking ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
          {booking ? 'Scheduling…' : 'Schedule Ride'}
        </button>
      </div>
    </div>
  );
}
