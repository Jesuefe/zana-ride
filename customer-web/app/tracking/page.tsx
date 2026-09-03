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

function DriverCard({ trip, seatLabel, onChat, onCall }: { trip: ApiTrip; seatLabel?: string; onChat?: () => void; onCall?: () => void }) {
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
  const [showCall, setShowCall] = useState(false);
  const [callData, setCallData] = useState<{callId:string;roomName:string;wsUrl:string;token:string}|null>(null);
  const [incomingCallInfo, setIncomingCallInfo] = useState<{callId:string;driverName:string}|null>(null);
  const socketRef = useRef<any>(null);

  // [call polling moved below primaryTrip declaration]
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
      // Play beep
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
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
      } catch {}
    });

    socket.on('call:missed', () => setIncomingCallInfo(null));
    socket.on('call:declined', () => { setIncomingCallInfo(null); setShowCall(false); });
    socket.on('call:cancelled', () => { setIncomingCallInfo(null); setShowCall(false); });
    socket.on('call:ended', () => { setIncomingCallInfo(null); setShowCall(false); setCallData(null); });

    return () => { socket.disconnect(); };
  }, []);  const status = primaryTrip?.status ?? 'SEARCHING_DRIVER';
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
              <DriverCard key={t.id} trip={t} seatLabel={`Moto ${t.groupSeatIndex} · ${STATUS_COPY[t.status] ?? t.status}`} onChat={() => setShowChat(true)} onCall={async () => {
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
          : trip && <DriverCard trip={trip} onChat={() => setShowChat(true)} onCall={async () => {
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

        <button
          onClick={status === 'RIDE_COMPLETED' || allCompleted ? () => setShowRating(true) : handleCancel}
          className={`w-full mt-6 py-3.5 rounded-xl font-semibold transition-transform active:scale-[0.98] ${
            status === 'RIDE_COMPLETED' || allCompleted
              ? 'bg-zana-primary text-white'
              : 'border border-zana-primary text-zana-primary'
          }`}
        >
          {status === 'RIDE_COMPLETED' || allCompleted ? 'Rate your ride' : 'Cancel Ride'}
        </button>
      </div>

      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
      {showRating && primaryTrip && (
        <RatingModal
          tripId={primaryTrip.id}
          driverName={primaryTrip.driver?.user?.firstName ?? 'your driver'}
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
              <p className="text-white font-black text-base">Incoming call</p>
              <p className="text-white/70 text-xs">Your driver is calling</p>
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
              onClick={() => { setIncomingCallInfo(null); setShowCall(true); }}
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
          participantLabel={primaryTrip?.driver?.user?.firstName ?? 'Driver'}
          onClose={() => { setShowCall(false); setCallData(null); }}
        />
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
              <p className="text-white font-black text-base">Incoming call</p>
              <p className="text-white/70 text-xs">{incomingCallInfo.driverName} is calling</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={async () => {
              await api.post(`/calls/${incomingCallInfo.callId}/decline`).catch(() => {});
              setIncomingCallInfo(null);
            }} className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6z"/>
              </svg>
            </button>
            <button onClick={async () => {
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
