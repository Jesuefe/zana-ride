'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Phone, Sparkles } from 'lucide-react';
import { fetchMyActiveTrip, arriveAtPickup, startTrip, completeTrip, updateDriverLocation, DriverTrip } from '../../lib/api/driver';
import { getCurrentPosition, watchPosition, Coords } from '../../lib/location';
import DriverMap from '../../components/DriverMap';
import Navigation3DMap from '../../components/Navigation3DMap';

const STATUS_COPY: Record<string, string> = {
  DRIVER_ASSIGNED: 'Head to the pickup point',
  DRIVER_ARRIVED: 'Waiting for your passenger',
  RIDE_IN_PROGRESS: 'Trip in progress',
};

function TripContent() {
  const router = useRouter();
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [acting, setActing] = useState(false);
  const [use3d, setUse3d] = useState(false);

  // A driver on an active trip is inherently "on the clock" — keep tracking
  // and reporting live location the whole time, same as the Home screen
  // does while online, so the customer's map keeps updating too.
  useEffect(() => {
    getCurrentPosition().then((c) => c && setCoords(c));
    const stop = watchPosition((c) => setCoords(c));
    return stop;
  }, []);

  useEffect(() => {
    if (!coords) return;
    updateDriverLocation(coords.lat, coords.lng).catch(() => {});
    const interval = setInterval(() => {
      if (coords) updateDriverLocation(coords.lat, coords.lng).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const t = await fetchMyActiveTrip();
        if (cancelled) return;
        if (!t) {
          router.replace('/');
          return;
        }
        setTrip(t);
      } catch {
        // retry next tick
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  const handleAction = async () => {
    if (!trip) return;
    setActing(true);
    try {
      if (trip.status === 'DRIVER_ASSIGNED') {
        const updated = await arriveAtPickup(trip.id);
        setTrip(updated);
      } else if (trip.status === 'DRIVER_ARRIVED') {
        const updated = await startTrip(trip.id);
        setTrip(updated);
      } else if (trip.status === 'RIDE_IN_PROGRESS') {
        await completeTrip(trip.id);
        router.replace('/');
      }
    } finally {
      setActing(false);
    }
  };

  if (!trip) return <div className="p-6 text-center text-zana-muted text-sm">Loading trip…</div>;

  const buttonLabel =
    trip.status === 'DRIVER_ASSIGNED'
      ? "I've Arrived"
      : trip.status === 'DRIVER_ARRIVED'
        ? 'Start Trip'
        : 'Complete Trip';

  // Navigate toward the pickup point until the driver has arrived, then
  // toward the destination once the trip is actually underway — same as
  // switching waypoints in a real turn-by-turn nav app.
  const navigationTarget =
    trip.status === 'DRIVER_ASSIGNED'
      ? { lat: trip.pickupLat, lng: trip.pickupLng }
      : trip.status === 'RIDE_IN_PROGRESS'
        ? { lat: trip.destinationLat, lng: trip.destinationLng }
        : undefined;

  return (
    <div className="animate-fade-in">
      {use3d ? (
        <Navigation3DMap position={coords} target={navigationTarget} height={260} />
      ) : (
        <DriverMap position={coords} target={navigationTarget} navigationMode height={260} />
      )}

      <button
        onClick={() => setUse3d((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 bg-gray-100 text-xs font-semibold text-gray-700 py-2"
      >
        <Sparkles size={12} className={use3d ? 'text-amber-500' : 'text-zana-muted'} />
        {use3d ? 'Switch back to standard view' : 'Try experimental 3D view'}
      </button>

      <div className="p-4">
      <h1 className="text-lg font-bold text-gray-900 mb-1">{STATUS_COPY[trip.status] ?? trip.status}</h1>
      <p className="text-xs text-zana-muted mb-5">Trip in progress with {trip.customer.firstName ?? 'passenger'}</p>

      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-start gap-2">
          <MapPin size={15} className="text-zana-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] text-zana-muted">Pickup</p>
            <p className="text-sm text-gray-900">{trip.pickupAddress}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Navigation size={15} className="text-zana-secondary-dark mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] text-zana-muted">Destination</p>
            <p className="text-sm text-gray-900">{trip.destinationAddress}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mt-4">
        <div className="flex-1">
          <p className="text-xs text-zana-muted">Passenger</p>
          <p className="text-sm font-medium text-gray-900">{trip.customer.firstName ?? 'Passenger'}</p>
        </div>
        <a href={`tel:${trip.customer.phone}`} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
          <Phone size={16} className="text-zana-primary" />
        </a>
      </div>

      <div className="mt-4 bg-zana-primary-light rounded-xl p-4 text-center">
        <p className="text-xs text-zana-muted">Fare</p>
        <p className="text-lg font-bold text-gray-900">{trip.estimatedFare.toLocaleString()} RWF</p>
      </div>

      <button
        onClick={handleAction}
        disabled={acting}
        className="w-full mt-6 bg-zana-primary text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition-transform active:scale-[0.98]"
      >
        {acting ? '…' : buttonLabel}
      </button>
      </div>
    </div>
  );
}

export default function TripPage() {
  return (
    <Suspense fallback={null}>
      <TripContent />
    </Suspense>
  );
}
