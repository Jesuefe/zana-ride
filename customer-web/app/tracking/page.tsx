'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Phone, Star, User } from 'lucide-react';
import { fetchTrip, cancelRide, ApiTrip } from '../../lib/api/trips';
import DirectionsMap from '../../components/DirectionsMap';

const STATUS_COPY: Record<string, string> = {
  SEARCHING_DRIVER: 'Finding your driver…',
  DRIVER_ASSIGNED: 'Driver assigned',
  DRIVER_EN_ROUTE: 'Driver is on the way',
  DRIVER_ARRIVED: 'Your driver has arrived',
  RIDE_IN_PROGRESS: 'On the way to your destination',
  RIDE_COMPLETED: 'Trip completed',
  NO_DRIVER_FOUND: 'No drivers available nearby',
  CUSTOMER_CANCELLED: 'Trip cancelled',
};

function TrackingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tripId = params.get('tripId');
  const [trip, setTrip] = useState<ApiTrip | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const t = await fetchTrip(tripId);
        if (!cancelled) setTrip(t);
      } catch {
        // retry on next tick
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tripId]);

  const handleCancel = async () => {
    if (tripId) await cancelRide(tripId).catch(() => {});
    router.push('/');
  };

  const status = trip?.status ?? 'SEARCHING_DRIVER';
  const driver = trip?.driver;

  return (
    <div>
      <div className="relative">
        {trip ? (
          <DirectionsMap
            origin={{ lat: trip.pickupLat, lng: trip.pickupLng }}
            destination={{ lat: trip.destinationLat, lng: trip.destinationLng }}
            height={224}
          />
        ) : (
          <div className="h-56 bg-zana-primary-light" />
        )}
        <button
          onClick={() => alert('This alerts the Zana safety team and shares your live trip details.')}
          className="absolute top-4 right-4 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-xs font-bold text-zana-error shadow"
        >
          <AlertTriangle size={13} /> SOS
        </button>
      </div>

      <div className="p-5">
        <h2 className="font-semibold text-lg text-gray-900">{STATUS_COPY[status] ?? status}</h2>

        {driver && status !== 'RIDE_COMPLETED' && (
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mt-4">
            <div className="w-11 h-11 rounded-full bg-zana-primary-light flex items-center justify-center">
              <User size={20} className="text-zana-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-900">{driver.user.firstName ?? 'Your driver'}</p>
              <p className="text-xs text-zana-muted">{driver.vehicle} · {driver.plate}</p>
              <div className="flex items-center gap-1 text-xs text-zana-muted">
                <Star size={11} className="text-zana-secondary fill-zana-secondary" /> {driver.rating.toFixed(1)}
              </div>
            </div>
            <button className="w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center">
              <Phone size={16} className="text-zana-primary" />
            </button>
          </div>
        )}

        <button
          onClick={handleCancel}
          className={`w-full mt-6 py-3.5 rounded-xl font-semibold ${
            status === 'RIDE_COMPLETED'
              ? 'bg-zana-primary text-white'
              : 'border border-zana-primary text-zana-primary'
          }`}
        >
          {status === 'RIDE_COMPLETED' ? 'Rate your trip' : 'Cancel Ride'}
        </button>
      </div>
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={null}>
      <TrackingContent />
    </Suspense>
  );
}
