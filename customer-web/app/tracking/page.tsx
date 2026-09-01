'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Phone, Star, User, Navigation, MessageCircle } from 'lucide-react';
import ChatPanel from '../../components/ChatPanel';
import RatingModal from '../../components/RatingModal';
import { fetchTrip, fetchTripGroup, cancelRide, ApiTrip } from '../../lib/api/trips';
import { api } from '../../lib/api/client';
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

type GroupTrip = ApiTrip & { groupSeatIndex: number | null };

function DriverCard({ trip, seatLabel, onChat }: { trip: ApiTrip; seatLabel?: string; onChat?: () => void }) {
  const driver = trip.driver;
  if (!driver || trip.status === 'RIDE_COMPLETED') return null;
  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mt-3">
      <div className="w-11 h-11 rounded-full bg-zana-primary-light flex items-center justify-center">
        <User size={20} className="text-zana-primary" />
      </div>
      <div className="flex-1">
        {seatLabel && <p className="text-[11px] font-semibold text-zana-primary">{seatLabel}</p>}
        <p className="text-sm font-semibold text-gray-900">{driver.user.firstName ?? 'Your driver'}</p>
        <p className="text-xs text-zana-muted">{driver.vehicle} · {driver.plate}</p>
        <div className="flex items-center gap-2 text-xs text-zana-muted">
          <span className="flex items-center gap-0.5"><Star size={11} className="text-zana-secondary fill-zana-secondary" /> {driver.rating.toFixed(1)}</span>
          {(driver as any).totalTrips && <span>· {(driver as any).totalTrips} rides</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onChat && (
          <button
            onClick={onChat}
            className="w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center"
          >
            <MessageCircle size={16} className="text-zana-primary" />
          </button>
        )}
        <button className="w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center">
          <Phone size={16} className="text-zana-primary" />
        </button>
      </div>
    </div>
  );
}

function TrackingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tripId = params.get('tripId');
  const groupId = params.get('groupId');

  const [trip, setTrip] = useState<ApiTrip | null>(null);
  const [groupTrips, setGroupTrips] = useState<GroupTrip[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [receiptShown, setReceiptShown] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceText: string; durationText: string } | null>(null);
  const motionRequested = useRef(false);

  const triggerSOS = () => {
    setShowReport(true);
    if (sosSent) return;
    setSosSent(true);
    // Fire immediately without waiting for GPS permission
    api.post('/sos', { tripId: primaryTrip?.id }).catch(() => setSosSent(false));
    // Also try to get GPS and update with coordinates
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        api.post('/sos', {
          tripId: primaryTrip?.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }).catch(() => {});
      }, () => {});
    }
  };

  useEffect(() => {
    if (!tripId && !groupId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        if (groupId) {
          const trips = await fetchTripGroup(groupId);
          if (!cancelled) setGroupTrips(trips);
        } else if (tripId) {
          const t = await fetchTrip(tripId);
          if (!cancelled) setTrip(t);
        }
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
  }, [tripId, groupId]);

  const isGroup = Boolean(groupId);
  // For a group, show the "primary" status as whichever moto is furthest
  // behind — the customer isn't fully picked up until every moto is ready.
  const primaryTrip = isGroup
    ? groupTrips.reduce<GroupTrip | null>((worst, t) => {
        if (!worst) return t;
        const order = ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_IN_PROGRESS', 'RIDE_COMPLETED'];
        return order.indexOf(t.status) < order.indexOf(worst.status) ? t : worst;
      }, null)
    : trip;

  const status = primaryTrip?.status ?? 'SEARCHING_DRIVER';
  const rideIsActive = ACTIVE_STATUSES.includes(status);
  const mapSource = isGroup ? groupTrips[0] : trip;

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
    if (groupId) {
      await Promise.all(groupTrips.map((t) => cancelRide(t.id).catch(() => {})));
    } else if (tripId) {
      await cancelRide(tripId).catch(() => {});
    }
    router.push('/');
  };

  const showRouteBanner = status === 'DRIVER_EN_ROUTE' || status === 'RIDE_IN_PROGRESS';
  const allCompleted = isGroup && groupTrips.length > 0 && groupTrips.every((t) => t.status === 'RIDE_COMPLETED');

  // Auto-redirect to receipt 3 seconds after trip completes
  useEffect(() => {
    if ((status === 'RIDE_COMPLETED' || allCompleted) && !receiptShown && primaryTrip) {
      setReceiptShown(true);
      setTimeout(() => {
        router.push(`/receipt?tripId=${primaryTrip.id}`);
      }, 3000);
    }
  }, [status, allCompleted, receiptShown, primaryTrip?.id]);

  return (
    <div>
      <div className="relative">
        {mapSource ? (
          <BrandedMap
            origin={{ lat: mapSource.pickupLat, lng: mapSource.pickupLng }}
            destination={{ lat: mapSource.destinationLat, lng: mapSource.destinationLng }}
            driverPosition={
              primaryTrip?.driver?.lastLat != null && primaryTrip?.driver?.lastLng != null
                ? { lat: primaryTrip.driver.lastLat, lng: primaryTrip.driver.lastLng }
                : null
            }
            vehicleType={mapSource.serviceType === 'BIKE' ? 'BIKE' : 'ECONOMY'}
            onRouteInfo={setRouteInfo}
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
          onClick={triggerSOS}
          className="absolute top-4 right-4 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full text-xs font-bold text-zana-error shadow"
        >
          <AlertTriangle size={13} /> SOS
        </button>
      </div>

      <div className="p-5">
        <h2 className="font-semibold text-lg text-gray-900">
          {isGroup && !allCompleted ? `${groupTrips.length} motos · ` : ''}
          {allCompleted ? 'All trips completed' : STATUS_COPY[status] ?? status}
        </h2>
        {rideIsActive && routeInfo && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-lg font-bold text-zana-primary">{routeInfo.durationText}</span>
            <span className="text-xs text-zana-muted">· {routeInfo.distanceText} remaining</span>
          </div>
        )}
        {rideIsActive && !routeInfo && primaryTrip?.driver && (
          <p className="text-sm text-zana-primary font-semibold mt-1">Calculating ETA…</p>
        )}
        {rideIsActive && (
          <p className="text-xs text-zana-muted mt-1">Shake your phone anytime to report a safety concern.</p>
        )}

        {isGroup
          ? groupTrips.map((t) => (
              <DriverCard key={t.id} trip={t} seatLabel={`Moto ${t.groupSeatIndex} · ${STATUS_COPY[t.status] ?? t.status}`} onChat={() => setShowChat(true)} />
            ))
          : trip && <DriverCard trip={trip} onChat={() => setShowChat(true)} />}

        <button
          onClick={status === 'RIDE_COMPLETED' || allCompleted ? () => setShowRating(true) : handleCancel}
          className={`w-full mt-6 py-3.5 rounded-xl font-semibold transition-transform active:scale-[0.98] ${
            status === 'RIDE_COMPLETED' || allCompleted
              ? 'bg-zana-primary text-white'
              : 'border border-zana-primary text-zana-primary'
          }`}
        >
          {status === 'RIDE_COMPLETED' || allCompleted ? '⭐ Rate your ride' : 'Cancel Ride'}
        </button>
      </div>

      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
      {showRating && primaryTrip && (
        <RatingModal
          tripId={primaryTrip.id}
          driverName={primaryTrip.driver?.user?.firstName ?? 'your driver'}
          onClose={() => { setShowRating(false); }}
        />
      )}
      {showChat && primaryTrip && (
        <ChatPanel context="trip" contextId={primaryTrip.id} onClose={() => setShowChat(false)} />
      )}
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
