'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Phone, Star, User, Navigation } from 'lucide-react';
import { fetchTrip, cancelRide, ApiTrip } from '../../lib/api/trips';
import BrandedMap from '../../components/BrandedMap';
import ReportModal from '../../components/ReportModal';
import { useShakeDetector, requestMotionPermission } from '../../lib/shake';

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

const ACTIVE_STATUSES = ['DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_IN_PROGRESS'];

function TrackingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tripId = params.get('tripId');
  const [trip, setTrip] = useState<ApiTrip | null>(null);
  const [showReport, setShowReport] = useState(false);
  const motionRequested = useRef(false);

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

  const status = trip?.status ?? 'SEARCHING_DRIVER';
  const driver = trip?.driver;
  const rideIsActive = ACTIVE_STATUSES.includes(status);

  // Ask for motion sensor permission once, the first time a real driver is
  // assigned — asking earlier (before there's anything to report on) would
  // just be a confusing permission prompt with no context.
  useEffect(() => {
    if (rideIsActive && !motionRequested.current) {
      motionRequested.current = true;
      requestMotionPermission();
    }
  }, [rideIsActive]);

  useShakeDetector(
    useCallback(() => setShowReport(true), []),
    rideIsActive,
  );

  const handleCancel = async () => {
    if (tripId) await cancelRide(tripId).catch(() => {});
    router.push('/');
  };

  const showRouteBanner = status === 'DRIVER_EN_ROUTE' || status === 'RIDE_IN_PROGRESS';

  return (
    <div>
      <div className="relative">
        {trip ? (
          <BrandedMap
            origin={{ lat: trip.pickupLat, lng: trip.pickupLng }}
            destination={{ lat: trip.destinationLat, lng: trip.destinationLng }}
            height={224}
          />
        ) : (
          <div className="h-56 bg-zana-primary-light" />
        )}

        {showRouteBanner && (
          <div className="absolute top-4 left-4 right-24 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-xs text-gray-900 shadow animate-fade-slide-up">
            <Navigation size={13} className="text-zana-primary shrink-0" />
            <span className="truncate">Driver is following the recommended route</span>
          </div>
        )}

        <button
          onClick={() => setShowReport(true)}
          className="absolute top-4 right-4 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-xs font-bold text-zana-error shadow"
        >
          <AlertTriangle size={13} /> SOS
        </button>
      </div>

      <div className="p-5">
        <h2 className="font-semibold text-lg text-gray-900">{STATUS_COPY[status] ?? status}</h2>
        {rideIsActive && (
          <p className="text-xs text-zana-muted mt-1">Shake your phone anytime to report a safety concern.</p>
        )}

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
          className={`w-full mt-6 py-3.5 rounded-xl font-semibold transition-transform active:scale-[0.98] ${
            status === 'RIDE_COMPLETED'
              ? 'bg-zana-primary text-white'
              : 'border border-zana-primary text-zana-primary'
          }`}
        >
          {status === 'RIDE_COMPLETED' ? 'Rate your trip' : 'Cancel Ride'}
        </button>
      </div>

      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
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
