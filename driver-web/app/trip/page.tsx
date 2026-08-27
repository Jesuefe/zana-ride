'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, ChevronUp, ChevronDown, MapPin, Navigation } from 'lucide-react';
import { fetchMyActiveTrip, arriveAtPickup, startTrip, completeTrip, updateDriverLocation, DriverTrip } from '../../lib/api/driver';
import { getCurrentPosition, watchPosition, Coords } from '../../lib/location';
import DriverMap from '../../components/DriverMap';

const STATUS_COPY: Record<string, string> = {
  DRIVER_ASSIGNED: 'Heading to pickup',
  DRIVER_ARRIVED: 'Waiting for passenger',
  RIDE_IN_PROGRESS: 'Trip in progress',
};

function TripContent() {
  const router = useRouter();
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [acting, setActing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // A driver on an active trip is inherently "on the clock" — keep tracking
  // and reporting live location the whole time so the customer's map updates.
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

  if (!trip) {
    return <div className="p-6 text-center text-zana-muted text-sm">Loading trip…</div>;
  }

  const buttonLabel =
    trip.status === 'DRIVER_ASSIGNED'
      ? "I've Arrived"
      : trip.status === 'DRIVER_ARRIVED'
        ? 'Start Trip'
        : 'Complete Trip';

  // Navigate toward the pickup point until the driver has arrived, then
  // toward the destination once the trip is actually underway.
  const navigationTarget =
    trip.status === 'DRIVER_ASSIGNED'
      ? { lat: trip.pickupLat, lng: trip.pickupLng }
      : trip.status === 'RIDE_IN_PROGRESS'
        ? { lat: trip.destinationLat, lng: trip.destinationLng }
        : undefined;

  const targetLabel =
    trip.status === 'RIDE_IN_PROGRESS' ? trip.destinationAddress : trip.pickupAddress;

  return (
    // Fixed full-viewport shell so the map genuinely fills the screen,
    // with the nav UI floating over it — like a real navigation app.
    <div className="fixed inset-0 z-40 bg-black">
      <DriverMap position={coords} target={navigationTarget} navigationMode height="100%" />

      {/* Bottom action sheet, collapsed by default so the map stays dominant */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl">
        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="w-full flex items-center justify-center py-1.5"
        >
          {detailsOpen ? <ChevronDown size={18} className="text-zana-muted" /> : <ChevronUp size={18} className="text-zana-muted" />}
        </button>

        <div className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-zana-muted">{STATUS_COPY[trip.status] ?? trip.status}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{targetLabel}</p>
            </div>
            <a
              href={`tel:${trip.customer.phone}`}
              className="w-10 h-10 rounded-full bg-zana-primary-light flex items-center justify-center shrink-0"
            >
              <Phone size={16} className="text-zana-primary" />
            </a>
          </div>

          {detailsOpen && (
            <div className="mt-3 space-y-2 animate-fade-slide-up">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-zana-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-zana-muted">Pickup</p>
                  <p className="text-xs text-gray-900">{trip.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Navigation size={14} className="text-zana-secondary-dark mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-zana-muted">Destination</p>
                  <p className="text-xs text-gray-900">{trip.destinationAddress}</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-[11px] text-zana-muted">Passenger</span>
                <span className="text-xs font-medium text-gray-900">{trip.customer.firstName ?? 'Passenger'}</span>
              </div>
              <div className="flex items-center justify-between bg-zana-primary-light rounded-lg px-3 py-2">
                <span className="text-[11px] text-zana-muted">Fare</span>
                <span className="text-sm font-bold text-gray-900">{trip.estimatedFare.toLocaleString()} RWF</span>
              </div>
            </div>
          )}

          <button
            onClick={handleAction}
            disabled={acting}
            className="w-full mt-3 bg-zana-primary text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition-transform active:scale-[0.98]"
          >
            {acting ? '…' : buttonLabel}
          </button>
        </div>
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
