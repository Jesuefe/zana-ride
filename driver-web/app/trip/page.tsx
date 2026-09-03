'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, ChevronUp, ChevronDown, MapPin, Navigation, MessageCircle } from 'lucide-react';
import ChatPanel from '../../components/ChatPanel';
import VoiceCall from '../../components/VoiceCall';
import { io, Socket } from 'socket.io-client';
import { api, getToken } from '../../lib/api/client';
import RatingModal from '../../components/RatingModal';
import { getStoredLang, dt } from '../../lib/lang';
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

  // Connect to WebSocket for incoming call events
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com';
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('call:incoming', async (data: { callId: string; callerName: string; rideId: string; expiresAt: string }) => {
      // Accept automatically and get LiveKit token
      try {
        const res = await api.post<{ callId: string; roomName: string; wsUrl: string; token: string }>(
          `/calls/${data.callId}/accept`
        );
        setIncomingCall({
          callId: data.callId,
          callerName: data.callerName,
          rideId: data.rideId,
          roomName: res.roomName,
          wsUrl: res.wsUrl,
          token: res.token,
        });
      } catch (e) {
        console.error('[CALL] Could not accept incoming call:', e);
      }
    });

    socket.on('call:cancelled', () => setIncomingCall(null));
    socket.on('call:ended', () => { setIncomingCall(null); setShowCall(false); });

    return () => { socket.disconnect(); };
  }, []);
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [acting, setActing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [showCallOptions, setShowCallOptions] = useState(false);
  const [outgoingCallId, setOutgoingCallId] = useState<string | null>(null);
  const [outgoingToken, setOutgoingToken] = useState<string | null>(null);
  const [outgoingWsUrl, setOutgoingWsUrl] = useState<string | null>(null);
  const [outgoingRoom, setOutgoingRoom] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<{callId:string;callerName:string;rideId:string;roomName:string;wsUrl:string;token:string}|null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [showRating, setShowRating] = useState(false);
  const lang = getStoredLang();
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

  // Navigate toward pickup until trip starts, then toward destination.
  // Keep showing the pickup during DRIVER_ARRIVED so the map stays active.
  const navigationTarget =
    trip.status === 'RIDE_IN_PROGRESS'
      ? { lat: trip.destinationLat, lng: trip.destinationLng }
      : { lat: trip.pickupLat, lng: trip.pickupLng };

  const targetLabel =
    trip.status === 'RIDE_IN_PROGRESS' ? trip.destinationAddress : trip.pickupAddress;

  return (
    // Fixed full-viewport shell so the map genuinely fills the screen,
    // with the nav UI floating over it — like a real navigation app.
    <div className="fixed inset-0 z-40 bg-black">
      <DriverMap position={coords} target={navigationTarget} navigationMode height="100%" lang={lang} />

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
            {/* Chat */}
            <button
              onClick={() => setShowChat(true)}
              className="w-10 h-10 rounded-full bg-zana-primary-light flex items-center justify-center shrink-0"
            >
              <MessageCircle size={16} className="text-zana-primary" />
            </button>

            {/* Free call button — tap to call via Zana */}
            <button
              onClick={async () => {
                if (!trip?.id) return;
                try {
                  const res = await api.post<{callId:string;roomName:string;wsUrl:string;token:string}>(
                    '/calls', { rideId: trip.id }
                  );
                  setOutgoingCallId(res.callId);
                  setOutgoingRoom(res.roomName);
                  setOutgoingWsUrl(res.wsUrl);
                  setOutgoingToken(res.token);
                  setShowCall(true);
                } catch (e: any) {
                  console.error('[CALL] Create call failed:', e?.message);
                  // Fallback to regular call
                  if (trip.customer?.phone) window.location.href = `tel:${trip.customer.phone}`;
                }
              }}
              className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0"
            >
              <Phone size={16} className="text-green-600" />
            </button>
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
      {trip?.status === 'RIDE_COMPLETED' && !showRating && (
        <div className="absolute bottom-24 left-4 right-4">
          <button onClick={() => setShowRating(true)} className="w-full bg-zana-secondary text-gray-900 font-bold py-3 rounded-xl text-sm">
            ⭐ Rate this passenger
          </button>
        </div>
      )}
      {showRating && trip && (
        <RatingModal
          tripId={trip.id}
          driverName={trip.customer?.firstName ?? 'passenger'}
          onClose={() => setShowRating(false)}
        />
      )}
      {/* Outgoing call */}
      {showCall && outgoingCallId && outgoingRoom && outgoingWsUrl && outgoingToken && trip && (
        <VoiceCall
          incomingCallId={outgoingCallId}
          roomName={outgoingRoom}
          wsUrl={outgoingWsUrl}
          token={outgoingToken}
          participantLabel={trip.customer?.firstName ?? 'Passenger'}
          onClose={() => { setShowCall(false); setOutgoingCallId(null); }}
        />
      )}

      {/* Incoming call from customer */}
      {incomingCall && !showCall && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 py-12"
          style={{ background: 'linear-gradient(160deg, #005C4B 0%, #002D24 100%)' }}>
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6 animate-pulse">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="white">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <p className="text-white/60 text-sm mb-1">Incoming call</p>
          <p className="text-white text-3xl font-black mb-2">{incomingCall.callerName}</p>
          <p className="text-white/50 text-xs mb-12">Zana Ride · Free Call</p>
          <div className="flex items-center gap-16">
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => { api.post(`/calls/${incomingCall.callId}/decline`); setIncomingCall(null); }}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6z"/>
                </svg>
              </button>
              <p className="text-white/50 text-xs">Decline</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => setShowCall(true)}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                </svg>
              </button>
              <p className="text-white/50 text-xs">Accept</p>
            </div>
          </div>
        </div>
      )}

      {/* Accepted incoming call — connect to LiveKit */}
      {showCall && incomingCall && (
        <VoiceCall
          incomingCallId={incomingCall.callId}
          roomName={incomingCall.roomName}
          wsUrl={incomingCall.wsUrl}
          token={incomingCall.token}
          participantLabel={incomingCall.callerName}
          onClose={() => { setShowCall(false); setIncomingCall(null); }}
        />
      )}
      {showChat && trip && (
        <ChatPanel context="trip" contextId={trip.id} onClose={() => setShowChat(false)} />
      )}
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
