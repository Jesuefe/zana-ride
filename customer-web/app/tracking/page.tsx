'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Phone, Star, User, Navigation, MessageCircle } from 'lucide-react';
import ChatPanel from '../../components/ChatPanel';
import RatingModal from '../../components/RatingModal';
import VoiceCall from '../../components/VoiceCall';
import { io } from 'socket.io-client';
import { getToken } from '../../lib/api/client';
import { fetchTrip, fetchTripGroup, cancelRide, ApiTrip } from '../../lib/api/trips';
import { api } from '../../lib/api/client';
import BrandedMap from '../../components/BrandedMap';
import ReportModal from '../../components/ReportModal';
import { useShakeDetector, requestMotionPermission } from '../../lib/shake';
import { useLang } from '../../lib/LangContext';
import { haptic, startCallVibration, stopHaptic } from '../../lib/haptics';

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

function DriverCard({ trip, seatLabel, onChat, onCall, hasUnreadMessage }: { trip: ApiTrip; seatLabel?: string; onChat?: () => void; onCall?: () => void; hasUnreadMessage?: boolean }) {
  const { t } = useLang();
  const driver = trip.driver;
  if (!driver || trip.status === 'RIDE_COMPLETED') return null;
  // Previously the plate was just a small line of plain text at all
  // times — easy to miss exactly when it matters most: right before
  // getting into an unfamiliar car. Made prominent specifically once
  // the driver is actually en route or has arrived, with a direct
  // instruction rather than just displaying the number passively.
  const showPlateCheck = trip.status === 'DRIVER_EN_ROUTE' || trip.status === 'DRIVER_ARRIVED';
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
        <div className="w-11 h-11 rounded-full bg-zana-primary-light flex items-center justify-center">
          <User size={20} className="text-zana-primary" />
        </div>
        <div className="flex-1">
          {seatLabel && <p className="text-[11px] font-semibold text-zana-primary">{seatLabel}</p>}
          <p className="text-sm font-semibold text-gray-900">{driver.user.firstName ?? t('Your driver')}</p>
          {!showPlateCheck && <p className="text-xs text-zana-muted">{driver.vehicle} · {driver.plate}</p>}
          <div className="flex items-center gap-2 text-xs text-zana-muted">
            <span className="flex items-center gap-0.5"><Star size={11} className="text-zana-secondary fill-zana-secondary" /> {driver.rating.toFixed(1)}</span>
            {(driver as any).totalTrips && <span>· {(driver as any).totalTrips} {t('rides')}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onChat && (
            <button
              onClick={onChat}
              className="relative w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center"
            >
              <MessageCircle size={16} className="text-zana-primary" />
              {hasUnreadMessage && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>
          )}
          {onCall && (
            <button
              onClick={onCall}
            className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center"
          >
            <Phone size={16} className="text-green-600" />
          </button>
        )}
      </div>
      </div>

      {showPlateCheck && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mt-2">
          <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-1">{t('Check before you get in')}</p>
          <p className="text-xs text-amber-700 mb-2">{t('Confirm this plate matches the car in front of you.')}</p>
          <div className="bg-white border-2 border-amber-400 rounded-lg py-2 text-center">
            <p className="text-2xl font-black tracking-widest text-gray-900">{driver.plate}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{driver.vehicle}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackingContent() {
  const router = useRouter();
  const { t } = useLang();
  const params = useSearchParams();
  const tripId = params.get('tripId');
  const groupId = params.get('groupId');

  const [trip, setTrip] = useState<ApiTrip | null>(null);
  const [groupTrips, setGroupTrips] = useState<GroupTrip[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [callNotice, setCallNotice] = useState('');
  const [showChat, setShowChat] = useState(false);
  // Previously there was no indication at all that a new message
  // arrived while the panel was closed — it only ever polled while
  // mounted. This tracks whether there's something unseen, using a ref
  // for the socket handler (which closes over state once) to check the
  // panel's current open/closed status without going stale.
  const [hasUnreadMessage, setHasUnreadMessage] = useState(false);
  const showChatRef = useRef(showChat);
  useEffect(() => { showChatRef.current = showChat; }, [showChat]);
  const [sosSent, setSosSent] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [callData, setCallData] = useState<{callId:string;roomName:string;wsUrl:string;token:string}|null>(null);
  const [incomingCallInfo, setIncomingCallInfo] = useState<{callId:string;driverName:string}|null>(null);
  const socketRef = useRef<any>(null);

  // [call polling moved below primaryTrip declaration]
  const [receiptShown, setReceiptShown] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceText: string; durationText: string } | null>(null);
  const [driverEta, setDriverEta] = useState<{ durationText: string; distanceText: string } | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const motionRequested = useRef(false);
  const previousRideStatusRef = useRef<string | null>(null);
  const callVibrationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerSOS = () => {
    setShowReport(true);
    if (sosSent) return;
    setSosSent(true);
    // Fire immediately without waiting for GPS permission
    haptic('warning');
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



  // [WebSocket handles incoming calls — see below]
  // WebSocket — incoming call from driver
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com';
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('call:incoming', (data: { callId: string; callerName: string }) => {
      setIncomingCallInfo({ callId: data.callId, driverName: data.callerName });
      stopCallVibration();
      startCallVibration();
      callVibrationTimerRef.current = setInterval(startCallVibration, 1600);
      // Play Zana ringtone
      try {
        const audio = new Audio('/ringtone.mp3');
        audio.loop = true;
        audio.volume = 1.0;
        audio.play().catch(() => {});
        (window as any).__zanaRingtone = audio;
      } catch {}
    });

    socket.on('call:accepted', async (data: { callId: string; roomName: string; wsUrl: string }) => {
      // Get our token and open call
      try {
        const res = await api.post<{ token: string; roomName: string; wsUrl: string }>(
          `/calls/${data.callId}/token`
        );
        setCallData({ callId: data.callId, roomName: res.roomName, wsUrl: res.wsUrl, token: res.token });
        setShowCall(true);
      } catch {
        setCallNotice(t('Could not join the call. Try calling again.'));
        setTimeout(() => setCallNotice(''), 4000);
      }
    });

    socket.on('call:missed', () => { stopCallVibration(); setIncomingCallInfo(null); try { (window as any).__zanaRingtone?.pause(); } catch {} });
    socket.on('call:declined', () => { stopCallVibration(); setIncomingCallInfo(null); setShowCall(false); });
    socket.on('call:cancelled', () => { stopCallVibration(); setIncomingCallInfo(null); setShowCall(false); });
    socket.on('call:ended', () => { stopCallVibration(); setIncomingCallInfo(null); setShowCall(false); setCallData(null); });
    socket.on('chat:message', () => {
      if (!showChatRef.current) setHasUnreadMessage(true);
    });

    // Driver cancelled the ride
    socket.on('trip:cancelled', (data: { message: string }) => {
      try { (window as any).__zanaRingtone?.pause(); } catch {}
      setShowCall(false);
      setIncomingCallInfo(null);
      setCancelNotice(data?.message ?? t('Your driver cancelled this ride'));
    });

    return () => { stopCallVibration(); socket.disconnect(); };
  }, []);

  // ── Driver → pickup ETA (only while driver is heading to the customer) ───
  useEffect(() => {
    const drv = primaryTrip?.driver as any;
    const drvLat = drv?.lastLat;
    const drvLng = drv?.lastLng;
    const st = primaryTrip?.status;
    const enRoute = st === 'DRIVER_ASSIGNED' || st === 'DRIVER_EN_ROUTE';

    if (!enRoute || drvLat == null || drvLng == null || !primaryTrip) {
      setDriverEta(null);
      return;
    }

    // Only trust the driver's location if it was reported in the last 2 minutes.
    // A stale fix would produce a wildly wrong "X mins away".
    const reportedAt = drv?.lastLocationAt ? new Date(drv.lastLocationAt).getTime() : 0;
    const isFresh = reportedAt > 0 && Date.now() - reportedAt < 120_000;
    if (!isFresh) {
      setDriverEta(null);
      return;
    }

    const calc = () => {
      const G = (window as any).google?.maps;
      if (!G) return;
      const svc = new G.DirectionsService();
      svc.route(
        {
          origin: new G.LatLng(drvLat, drvLng),
          destination: new G.LatLng(primaryTrip.pickupLat, primaryTrip.pickupLng),
          travelMode: G.TravelMode.DRIVING,
        },
        (res: any, status: any) => {
          if (status !== 'OK') { setDriverEta(null); return; }
          const leg = res.routes[0]?.legs[0];
          if (leg) {
            setDriverEta({ durationText: leg.duration.text, distanceText: leg.distance.text });
          }
        }
      );
    };

    calc();
    const t = setInterval(calc, 15000);
    return () => clearInterval(t);
  }, [primaryTrip?.driver?.lastLat, primaryTrip?.driver?.lastLng, primaryTrip?.status]);
  const status = primaryTrip?.status ?? 'SEARCHING_DRIVER';
  const rideIsActive = ACTIVE_STATUSES.includes(status);

  // The phone may have been offline while the driver changed the ride state.
  // Haptics make the important transition visible even when the customer is
  // not looking directly at the screen.
  useEffect(() => {
    if (!primaryTrip) return;
    const previous = previousRideStatusRef.current;
    if (previous && previous !== status) {
      haptic(
        status === 'DRIVER_ARRIVED' || status === 'RIDE_COMPLETED'
          ? 'success'
          : 'ride'
      );
    }
    previousRideStatusRef.current = status;
  }, [status, primaryTrip?.id]);

  const stopCallVibration = useCallback(() => {
    if (callVibrationTimerRef.current) {
      clearInterval(callVibrationTimerRef.current);
      callVibrationTimerRef.current = null;
    }
    stopHaptic();
  }, []);

  useEffect(() => () => stopCallVibration(), [stopCallVibration]);
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

  const rideInProgress = status === 'RIDE_IN_PROGRESS';

  const handleCancel = async () => {
    // Once a ride is actually under way it can't just be undone — the
    // button routes to reporting a problem instead (see the render below).
    if (rideInProgress) { setShowReport(true); return; }

    setCancelError('');
    try {
      if (groupId) {
        await Promise.all(groupTrips.map((t) => cancelRide(t.id)));
      } else if (tripId) {
        await cancelRide(tripId);
      }
      router.push('/');
    } catch (e: any) {
      // A cancel that silently fails leaves someone standing at the
      // roadside believing a ride they don't want is no longer coming.
      setCancelError(e?.message?.includes('RIDE_ALREADY_IN_PROGRESS')
        ? t('This ride has already started — report a problem instead.')
        : t('Could not cancel. Try again.'));
    }
  };

  const showRouteBanner = status === 'DRIVER_EN_ROUTE' || status === 'RIDE_IN_PROGRESS';
  const allCompleted = isGroup && groupTrips.length > 0 && groupTrips.every((t) => t.status === 'RIDE_COMPLETED');

  // Show rating first when trip completes, then go to receipt
  useEffect(() => {
    if ((status === 'RIDE_COMPLETED' || allCompleted) && !receiptShown && primaryTrip) {
      setReceiptShown(true);
      // Show rating modal immediately
      setShowRating(true);
    }
  }, [status, allCompleted, receiptShown, primaryTrip?.id]);

  return (
    <div>
      {callNotice && (
        <div className="fixed top-4 left-4 right-4 z-[70] bg-gray-900 text-white text-sm text-center py-3 rounded-xl shadow-lg">
          {callNotice}
        </div>
      )}
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
            <span className="truncate">{t('Driver is following the recommended route')}</span>
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
          {isGroup && !allCompleted ? `${groupTrips.length} ${t('motos')} · ` : ''}
          {allCompleted ? t('All trips completed') : t(STATUS_COPY[status] ?? status)}
        </h2>
        {/* Driver on the way — show how far away they are */}
        {driverEta && (
          <div className="flex items-center gap-2 mt-2 bg-zana-primary-light rounded-2xl px-4 py-2.5 w-fit">
            <div className="w-2 h-2 rounded-full bg-zana-primary animate-pulse" />
            <div>
              <span className="text-base font-black text-zana-primary">
                {driverEta.durationText} {t('to your pickup')}
              </span>
              <span className="text-xs text-gray-500 ml-1.5">· {driverEta.distanceText}</span>
            </div>
          </div>
        )}
        {rideIsActive && routeInfo && !driverEta && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-lg font-bold text-zana-primary">{routeInfo.durationText}</span>
            <span className="text-xs text-zana-muted">· {routeInfo.distanceText} {t('remaining')}</span>
          </div>
        )}
        {rideIsActive && !routeInfo && primaryTrip?.driver && (
          <p className="text-sm text-zana-primary font-semibold mt-1">{t('Calculating ETA…')}</p>
        )}
        {rideIsActive && (
          <p className="text-xs text-zana-muted mt-1">{t('Shake your phone anytime to report a safety concern.')}</p>
        )}

        {isGroup
          ? groupTrips.map((t) => (
              <DriverCard key={t.id} trip={t} seatLabel={`Moto ${t.groupSeatIndex} · ${STATUS_COPY[t.status] ?? t.status}`} hasUnreadMessage={hasUnreadMessage} onChat={() => { setShowChat(true); setHasUnreadMessage(false); }} onCall={async () => {
                haptic('tap');
                const tripId = primaryTrip?.id;
                if (!tripId) return;
                try {
                  const res = await api.post<{callId:string;roomName:string;wsUrl:string;token:string}>(
                    '/calls', { rideId: tripId }
                  );
                  setCallData({ callId: res.callId, roomName: res.roomName, wsUrl: res.wsUrl, token: res.token });
                  setShowCall(true);
                } catch (e: any) {
                  console.error('[CALL] Failed to start call:', e?.message);
                }
              }} />
            ))
          : trip && <DriverCard trip={trip} hasUnreadMessage={hasUnreadMessage} onChat={() => { setShowChat(true); setHasUnreadMessage(false); }} onCall={async () => {
                haptic('tap');
                const tripId = primaryTrip?.id;
                if (!tripId) return;
                try {
                  const res = await api.post<{callId:string;roomName:string;wsUrl:string;token:string}>(
                    '/calls', { rideId: tripId }
                  );
                  setCallData({ callId: res.callId, roomName: res.roomName, wsUrl: res.wsUrl, token: res.token });
                  setShowCall(true);
                } catch (e: any) {
                  console.error('[CALL] Failed to start call:', e?.message);
                }
              }} />}

        {cancelError && <p className="text-xs text-zana-error text-center mt-4">{cancelError}</p>}

        <button
          onClick={status === 'RIDE_COMPLETED' || allCompleted ? () => setShowRating(true) : handleCancel}
          className={`w-full mt-6 py-3.5 rounded-xl font-semibold transition-transform active:scale-[0.98] ${
            status === 'RIDE_COMPLETED' || allCompleted
              ? 'bg-zana-primary text-white'
              : rideInProgress
                ? 'border border-zana-error text-zana-error'
                : 'border border-zana-primary text-zana-primary'
          }`}
        >
          {status === 'RIDE_COMPLETED' || allCompleted
            ? t('Rate your ride')
            : rideInProgress
              ? t('Report a problem')
              : t('Cancel Ride')}
        </button>
      </div>

      {showReport && primaryTrip && (
        <ReportModal tripId={primaryTrip.id} onClose={() => setShowReport(false)} />
      )}
      {showRating && primaryTrip && (
        <RatingModal
          tripId={primaryTrip.id}
          driverName={primaryTrip.driver?.user?.firstName ?? t('your driver')}
          onClose={() => {
            setShowRating(false);
            router.push(`/receipt?tripId=${primaryTrip.id}`);
          }}
        />
      )}
      {/* Incoming call banner */}
      {incomingCallInfo && !showCall && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-zana-primary px-4 py-4 flex items-center justify-between shadow-2xl animate-fade-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-black text-base">{t('Incoming call')}</p>
              <p className="text-white/70 text-xs">{t('Your driver is calling')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIncomingCallInfo(null)}
              className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4z"/>
              </svg>
            </button>
            <button
              onClick={() => { haptic('tap'); stopCallVibration(); setIncomingCallInfo(null); setShowCall(true); }}
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#00A082">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {showCall && callData && (
        <VoiceCall
          incomingCallId={callData.callId}
          roomName={callData.roomName}
          wsUrl={callData.wsUrl}
          token={callData.token}
          participantLabel={primaryTrip?.driver?.user?.firstName ?? t('Driver')}
          onClose={() => { setShowCall(false); setCallData(null); }}
        />
      )}

      {/* ── Driver cancelled ────────────────────────────────────────── */}
      {cancelNotice && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8 bg-white">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-5">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </div>
          <p className="text-xl font-black text-gray-900 mb-2">{t('Ride cancelled')}</p>
          <p className="text-sm text-gray-500 text-center mb-6">{cancelNotice}</p>
          <button onClick={() => router.replace('/')}
            className="bg-zana-primary text-white font-bold px-8 py-3 rounded-2xl">
            {t('Book another ride')}
          </button>
        </div>
      )}

      {/* Incoming call banner — driver is calling */}
      {incomingCallInfo && !showCall && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-zana-primary px-4 py-4 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-black text-base">{t("Incoming call")}</p>
              <p className="text-white/70 text-xs">{incomingCallInfo.driverName} {t('is calling')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={async () => {
              haptic('tap');
              stopCallVibration();
              await api.post(`/calls/${incomingCallInfo.callId}/decline`).catch(() => {});
              setIncomingCallInfo(null);
              try { (window as any).__zanaRingtone?.pause(); } catch {}
            }} className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6z"/>
              </svg>
            </button>
            <button onClick={async () => {
              try { (window as any).__zanaRingtone?.pause(); } catch {}
              haptic('success');
              stopCallVibration();
              try {
                const res = await api.post<{callId:string;roomName:string;wsUrl:string;token:string}>(
                  `/calls/${incomingCallInfo.callId}/accept`
                );
                setCallData(res);
                setIncomingCallInfo(null);
                setShowCall(true);
              } catch {}
            }} className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#00A082">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
          </div>
        </div>
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
