'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MapPin, Navigation, Star, Car, Clock, CreditCard, Download, Home } from 'lucide-react';
import { fetchTrip, ApiTrip } from '../../lib/api/trips';

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash Cash', WALLET: 'Wallet Zana Wallet', MOBILE_MONEY: 'MoMo Mobile Money',
};

function ReceiptContent() {
  const params = useSearchParams();
  const router = useRouter();
  const tripId = params.get('tripId');
  const [trip, setTrip] = useState<ApiTrip | null>(null);

  useEffect(() => {
    if (!tripId) return;
    fetchTrip(tripId).then(setTrip).catch(() => {});
  }, [tripId]);

  if (!trip) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-zana-primary border-t-transparent" />
    </div>
  );

  const fare = trip.finalFare ?? trip.estimatedFare;
  const commission = Math.round(fare * 0.15);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Zana header */}
      <div className="bg-zana-primary px-4 pt-12 pb-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center font-black text-zana-primary text-2xl mx-auto mb-3">Z</div>
        <p className="text-white/80 text-xs uppercase tracking-widest font-semibold">Zana Ride</p>
        <p className="text-white text-2xl font-bold mt-1">{fare.toLocaleString()} RWF</p>
        <p className="text-white/60 text-sm mt-0.5">Trip completed · {new Date(trip.requestedAt).toLocaleDateString()}</p>
      </div>

      <div className="px-4 -mt-4 space-y-3">
        {/* Driver card */}
        {trip.driver && (
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zana-primary-light flex items-center justify-center">
              <Car size={20} className="text-zana-primary" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{trip.driver.user.firstName}</p>
              <p className="text-xs text-gray-500">{trip.driver.vehicle} · {trip.driver.plate}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Star size={10} className="text-zana-secondary fill-zana-secondary" />
                {trip.driver.rating.toFixed(1)}
              </div>
            </div>
          </div>
        )}

        {/* Route */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase">Route</p>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 mt-1">
              <div className="w-3 h-3 rounded-full bg-zana-primary" />
              <div className="w-0.5 h-8 bg-gray-200" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-[10px] text-gray-400">Pickup</p>
                <p className="text-sm text-gray-900">{trip.pickupAddress}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Destination</p>
                <p className="text-sm text-gray-900">{trip.destinationAddress}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fare breakdown */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Fare breakdown</p>
          <div className="space-y-2">
            {[
              { label: 'Base fare', value: fare },
              { label: 'Zana platform (15%)', value: -commission, color: 'text-gray-400' },
              { label: 'Driver receives', value: fare - commission, color: 'text-zana-primary font-semibold' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between">
                <span className={`text-sm ${color ?? 'text-gray-700'}`}>{label}</span>
                <span className={`text-sm font-medium ${color ?? 'text-gray-900'}`}>
                  {value < 0 ? '-' : ''}{Math.abs(value).toLocaleString()} RWF
                </span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2 flex justify-between">
              <span className="font-bold text-gray-900">Total charged</span>
              <span className="font-bold text-gray-900">{fare.toLocaleString()} RWF</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-gray-400" />
            <span className="text-sm text-gray-700">Payment</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {PAYMENT_LABELS[(trip as any).paymentMethod] ?? 'Cash Cash'}
          </span>
        </div>

        {/* Trip details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Trip details</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><Clock size={13} /> Date</span>
              <span className="text-gray-900">{new Date(trip.requestedAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Service type</span>
              <span className="text-gray-900 capitalize">{trip.serviceType?.toLowerCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Trip ID</span>
              <span className="text-gray-400 font-mono text-xs">{trip.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* Points earned */}
        <div className="bg-zana-primary-light rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl"></span>
          <div>
            <p className="font-semibold text-zana-primary text-sm">+{Math.floor(fare / 100)} Zana Points earned</p>
            <p className="text-xs text-gray-500">Points added to your account</p>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => router.push('/')}
          className="w-full bg-zana-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2"
        >
          <Home size={16} /> Back to Home
        </button>
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  return <Suspense fallback={null}><ReceiptContent /></Suspense>;
}
