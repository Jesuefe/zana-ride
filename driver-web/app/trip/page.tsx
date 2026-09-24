'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, ChevronUp, ChevronDown, MapPin, Navigation, MessageCircle, X } from 'lucide-react';
import ChatPanel from '../../components/ChatPanel';
import VoiceCall, { VoiceCallHandle } from '../../components/VoiceCall';
import { io, Socket } from 'socket.io-client';
import { api, getToken } from '../../lib/api/client';
import RatingModal from '../../components/RatingModal';
import { getStoredLang, dt, tt } from '../../lib/lang';
import { fetchMyActiveTrip, arriveAtPickup, startTrip, completeTrip, updateDriverLocation, declineTrip, logRecoveryEvent, DriverTrip } from '../../lib/api/driver';
import { getCurrentPosition, watchPosition, Coords } from '../../lib/location';
import DriverMap from '../../components/DriverMap';
import { Browser } from '@capacitor/browser';

const STATUS_KEYS: Record<string, string> = {
  DRIVER_ASSIGNED: 'Heading to pickup',
  DRIVER_ARRIVED: 'Waiting for passenger',
  RIDE_IN_PROGRESS: 'Trip in progress',
};

function TripContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Landing here via a normal accept is indistinguishable from landing
  // here via crash recovery once the page has loaded — this flag is only
  // ever set by the recovery redirect on the home screen, so its presence
  // is what actually tells the driver "this wasn't just a normal open,
  // something was restored for you" rather than leaving them to guess.
  const [showRecoveredBanner, setShowRecoveredBanner] = useState(searchParams.get('recovered') === '1');

  // Connect to WebSocket for incoming call events
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com';
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('call:incoming', async (data: { callId: string; callerName: string; rideId: string; expiresAt: string }) => {
      // Play ringtone
      try {
        const audio = new Audio('/ringtone.mp3');
        audio.loop = true;
        audio.volume = 1.0;
        audio.play().catch(() => {});
        (window as any).__zanaRingtone = audio;
      } catch {}

      // Store call info for manual accept/decline
      setIncomingCall({
        callId: data.callId,
        callerName: data.callerName,
        rideId: data.rideId,
        roomName: '',
        wsUrl: '',
        token: '',
      });
    });

    socket.on('call:cancelled', () => { try { (window as any).__zanaRingtone?.pause(); } catch {} setIncomingCall(null); });

    // Customer cancelled the ride — close everything and go home
    socket.on('trip:cancelled', (data: { message: string }) => {
      try { (window as any).__zanaRingtone?.pause(); } catch {}
      try { window.speechSynthesis?.cancel(); } catch {}
      setShowCall(false);
      setIncomingCall(null);
      // The driver could be mid-way through their own "Cancel this ride?"
      // confirmation right when the customer cancels from their side too —
      // without this, both dialogs could show stacked, and submitting the
      // driver's own cancel reason at that point would hit a trip that no
      // longer exists.
      setShowCancel(false);
      setCancelReason('');
      setCancelledNotice(data?.message ?? 'The customer cancelled this ride');
      setTimeout(() => router.replace('/'), 3500);
    });
    socket.on('call:ended', () => { setIncomingCall(null); setShowCall(false); });
    socket.on('chat:message', () => {
      if (!showChatRef.current) setHasUnreadMessage(true);
    });

    return () => { socket.disconnect(); };
  }, []);
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [acting, setActing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  // Previously there was no indication at all that a new message
  // arrived while the panel was closed — it only ever polled while
  // mounted. This tracks whether there's something unseen, using a ref
  // for the socket handler (which closes over state once) to check the
  // panel's current open/closed status without going stale.
  const [hasUnreadMessage, setHasUnreadMessage] = useState(false);
  const showChatRef = useRef(showChat);
  useEffect(() => { showChatRef.current = showChat; }, [showChat]);
  const [showCall, setShowCall] = useState(false);
  const [showCallOptions, setShowCallOptions] = useState(false);
  const [cancelledNotice, setCancelledNotice] = useState<string | null>(null);
  // A ref, not the state directly — the polling effect below closes
  // over this once and would otherwise never see updates to the state
  // itself, the same stale-closure issue fixed in the call component
  // earlier: this ref is what lets the poll loop know a notice is
  // already showing, without re-subscribing the whole polling effect
  // every time cancelledNotice changes.
  const cancelledNoticeRef = useRef<string | null>(null);
  useEffect(() => { cancelledNoticeRef.current = cancelledNotice; }, [cancelledNotice]);
  const [momoState, setMomoState] = useState<'idle'|'prompt'|'sending'|'waiting'|'paid'|'failed'>('idle');
  const [momoPhone, setMomoPhone] = useState('');
  const [momoError, setMomoError] = useState('');
  const momoPollRef = useRef<any>(null);
  const [outgoingCallId, setOutgoingCallId] = useState<string | null>(null);
  const [outgoingToken, setOutgoingToken] = useState<string | null>(null);
  const [outgoingWsUrl, setOutgoingWsUrl] = useState<string | null>(null);
  const [outgoingRoom, setOutgoingRoom] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<{callId:string;callerName:string;rideId:string;roomName:string;wsUrl:string;token:string}|null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const lang = getStoredLang();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // A driver on an active trip is inherently "on the clock" — keep tracking
  // and reporting live location the whole time so the customer's map updates.
  // Runs on every mount regardless of how the driver got here — a fresh
  // accept or a crash-recovery redirect look identical to this effect,
  // which is exactly the point: GPS resumes automatically either way,
  // with nothing extra for the driver to press.
  useEffect(() => {
    logRecoveryEvent('GPS_TRACKING_RESUMED', trip?.id, trip?.status);
    getCurrentPosition().then((c) => c && setCoords(c));
    const stop = watchPosition((c) => setCoords(c));
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // While Google Maps is on screen, Zana sits paused in the background —
  // Android can throttle things like the trip poll below while it isn't
  // the active screen. Rather than trust it'll catch up on its own timing,
  // force an immediate, fresh check the instant the driver is back, and
  // prompt them to continue instead of relying on them remembering the
  // button was there.
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    (async () => {
      try {
        const { Browser } = await import('@capacitor/browser');
        handle = await Browser.addListener('browserFinished', async () => {
          try {
            const fresh = await fetchMyActiveTrip();
            if (fresh) {
              setTrip(fresh);
              setShowReturnPrompt(true);
            }
          } catch {
            // Still show the prompt even if the refresh itself failed —
            // better to nudge the driver to check than say nothing.
            setShowReturnPrompt(true);
          }
        });
      } catch {
        // Not running natively — nothing to listen for.
      }
    })();
    return () => handle?.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const t = await fetchMyActiveTrip();
        if (cancelled) return;
        if (!t) {
          // Previously redirected instantly and silently the moment the
          // trip stopped being "active" — which happens the exact
          // instant a customer cancels. This raced directly against the
          // trip:cancelled socket handler's graceful 3.5s notice, and
          // whichever one won left the driver either informed or just
          // abruptly bounced home with zero explanation, which reads as
          // the app randomly kicking them out. The socket handler is
          // the one path that actually knows why the trip is gone, so
          // let it own the notice-then-redirect whenever it's already
          // in flight, rather than racing it with a silent jump.
          if (!cancelledNoticeRef.current) {
            setCancelledNotice('This ride is no longer active');
            setTimeout(() => router.replace('/'), 3500);
          }
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

  const handleCancelTrip = async () => {
    if (!trip || !cancelReason.trim()) return;
    setCancelling(true);
    setCancelError('');
    try {
      await declineTrip(trip.id, cancelReason.trim());
      router.push('/');
    } catch (e: any) {
      setCancelError(tt('Could not cancel. Try again.', lang));
    } finally {
      setCancelling(false);
    }
  };

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
        const pm = (trip as any).paymentMethod ?? 'CASH';
        if (pm === 'MOBILE_MONEY') {
          // Prefill with the customer's registered number, driver can correct it
          setMomoPhone((trip as any).customer?.phone ?? '');
          setMomoState('prompt');
        } else {
          router.replace('/');
        }
      }
    } finally {
      setActing(false);
    }
  };

  // ── MoMo charge ──────────────────────────────────────────────────────────
  const [collectingCash, setCollectingCash] = useState(false);
  const voiceCallRef = useRef<VoiceCallHandle>(null);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [speakerSupported, setSpeakerSupported] = useState(true);

  const handleCollectCash = async () => {
    if (!trip) return;
    setCollectingCash(true);
    try {
      // Was previously a bare navigate-away with no API call at all — the
      // trip's payment method stayed MOBILE_MONEY forever and commission
      // had already been credited to the driver's wallet as a digital
      // payment at completion, even though the driver is walking away
      // with physical cash instead. This corrects the payment method and
      // settles commission the cash way for real.
      await api.post(`/driver/rides/${trip.id}/collect-cash`);
    } catch (e: any) {
      // Was silently swallowed and still navigated away regardless — if
      // the backend correctly refuses the switch (MoMo already went
      // through), the driver needs to actually see that, not be sent
      // home not knowing whether cash still needs collecting.
      setCollectingCash(false);
      setMomoError(
        e?.message === 'PAYMENT_ALREADY_CONFIRMED'
          ? tt('This ride was already paid via MoMo — no need to collect cash.', lang)
          : (e?.message || tt('Could not switch to cash. Please try again.', lang))
      );
      return;
    }
    router.replace('/');
  };

  const sendMomoPrompt = async () => {
    if (!trip) return;
    setMomoState('sending');
    setMomoError('');
    try {
      await api.post(`/driver/rides/${trip.id}/momo-charge`, { phone: momoPhone });
      setMomoState('waiting');
      // Poll for payment confirmation every 4s, give up after 2 minutes
      let ticks = 0;
      clearInterval(momoPollRef.current);
      momoPollRef.current = setInterval(async () => {
        ticks++;
        try {
          const res = await api.get<{ status: string; paid: boolean }>(
            `/driver/rides/${trip.id}/momo-status`
          );
          if (res.paid) {
            clearInterval(momoPollRef.current);
            setMomoState('paid');
            setTimeout(() => router.replace('/'), 2000);
          }
        } catch {}
        if (ticks > 30) {
          clearInterval(momoPollRef.current);
          setMomoState('failed');
          setMomoError(tt('Payment not confirmed. Ask the customer to check their phone.', lang));
        }
      }, 4000);
    } catch (e: any) {
      setMomoState('failed');
      setMomoError(e?.message ?? tt('Could not send the payment request', lang));
    }
  };

  useEffect(() => () => clearInterval(momoPollRef.current), []);

  if (!trip) {
    return <div className="p-6 text-center text-zana-muted text-sm">{tt('Loading trip…', lang)}</div>;
  }

  const buttonLabel =
    trip.status === 'DRIVER_ASSIGNED'
      ? dt("I've Arrived", lang)
      : trip.status === 'DRIVER_ARRIVED'
        ? dt('Start Trip', lang)
        : dt('Complete Trip', lang);

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

      {/* Shown once, only when this screen was reached via crash recovery
          rather than a normal accept — a driver whose app just crashed
          mid-trip should be told plainly that nothing was lost, not left
          to quietly notice the app still works and piece it together
          themselves. */}
      {showRecoveredBanner && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-4 animate-fade-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">{tt('Active ride restored', lang)}</p>
              <p className="text-xs text-zana-muted mt-0.5">
                {dt(STATUS_KEYS[trip.status] ?? trip.status, lang)} · {targetLabel}
              </p>
            </div>
            <button
              onClick={() => setShowRecoveredBanner(false)}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
              aria-label={tt('Dismiss', lang)}
            >
              <X size={14} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Nudge back into the trip flow after Google Maps closes — the
          trip data has already been refreshed by the time this shows, so
          tapping through here is acting on current status, not stale. */}
      {showReturnPrompt && (
        <div className="absolute bottom-[92px] left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-fade-slide-up">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{tt('Back from navigation', lang)}</p>
            <p className="text-xs text-zana-muted">{tt('Ready to continue?', lang)}</p>
          </div>
          <button
            onClick={() => { setShowReturnPrompt(false); handleAction(); }}
            className="bg-zana-primary text-white text-sm font-semibold px-4 py-2 rounded-xl shrink-0"
          >
            {buttonLabel}
          </button>
          <button
            onClick={() => setShowReturnPrompt(false)}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
            aria-label={tt('Dismiss', lang)}
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>
      )}

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
              <p className="text-[11px] text-zana-muted">{dt(STATUS_KEYS[trip.status] ?? trip.status, lang)}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{targetLabel}</p>
            </div>
            {/* Chat */}
            <button
              onClick={() => { setShowChat(true); setHasUnreadMessage(false); }}
              className="relative w-10 h-10 rounded-full bg-zana-primary-light flex items-center justify-center shrink-0"
            >
              <MessageCircle size={16} className="text-zana-primary" />
              {hasUnreadMessage && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>

            {/* Call — asks which method every time, rather than silently
                trying Zana's call and only falling back to a regular call
                if that request happens to fail. The driver decides up
                front, instead of the app deciding for them after the fact. */}
            <button
              onClick={() => setShowCallOptions(true)}
              className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0"
            >
              <Phone size={16} className="text-green-600" />
            </button>

            {/* Speaker — only meaningful once a call is actually
                connected, so it only appears in this row then, rather
                than sitting there doing nothing the rest of the time. */}
            {showCall && (
              <button
                onClick={() => voiceCallRef.current?.toggleSpeaker()}
                disabled={!speakerSupported}
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 ${
                  speakerOn ? 'bg-zana-primary' : 'bg-gray-100'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={speakerOn ? 'white' : '#374151'}>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14M3 9v6h4l5 5V4L7 9H3z"/>
                </svg>
              </button>
            )}
          </div>

          {/* Open in Google Maps — hands off real turn-by-turn to Google's
              own app instead of building it ourselves. This is the same
              pattern apps like Bolt and Uber use: a quick in-app map for
              context, with an explicit handoff for anyone who wants full
              navigation. Given its own full-width, labeled button rather
              than a bare icon crammed alongside Chat and Call, since it's
              the primary action here, not a secondary one. Uses Google's
              official, documented cross-platform Maps URL, which opens the
              native Google Maps app directly if it's installed, or a
              browser tab if not — no new native plugin or permission
              needed for this at all. */}
          <button
            onClick={async () => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${navigationTarget.lat},${navigationTarget.lng}&travelmode=driving`;
              try {
                // Stays layered on top of Zana rather than switching to a
                // separate app — on iOS this is a real small popover; on
                // Android that option doesn't exist, so it opens as a
                // full-screen sheet instead, with an instant "back" to
                // return here. Falls back to a plain external tab if the
                // native plugin isn't available for some reason (e.g. a
                // browser tab with no Capacitor bridge at all).
                await Browser.open({ url, presentationStyle: 'popover', toolbarColor: '#00A082' });
              } catch {
                window.open(url, '_system');
              }
            }}
            className="w-full mt-3 bg-blue-50 text-blue-700 font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <Navigation size={16} />
            {tt('Get Directions', lang)}
          </button>

          {detailsOpen && (
            <div className="mt-3 space-y-2 animate-fade-slide-up">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-zana-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-zana-muted">{tt('Pickup', lang)}</p>
                  <p className="text-xs text-gray-900">{trip.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Navigation size={14} className="text-zana-secondary-dark mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-zana-muted">{tt('Destination', lang)}</p>
                  <p className="text-xs text-gray-900">{trip.destinationAddress}</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-[11px] text-zana-muted">{tt('Passenger', lang)}</span>
                <span className="text-xs font-medium text-gray-900">{trip.customer.firstName ?? tt('Passenger', lang)}</span>
              </div>
              <div className="flex items-center justify-between bg-zana-primary-light rounded-lg px-3 py-2">
                <span className="text-[11px] text-zana-muted">{dt('Fare', lang)}</span>
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

          {trip.status !== 'RIDE_COMPLETED' && (
            <button
              onClick={() => setShowCancel(true)}
              className="w-full mt-2 text-zana-error text-sm font-semibold py-2"
            >
              {tt('Cancel this ride', lang)}
            </button>
          )}
        </div>
      </div>

      {showCallOptions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCallOptions(false)} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-gray-900">{tt('Call passenger', lang)}</h2>
              <button onClick={() => setShowCallOptions(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <button
              onClick={async () => {
                setShowCallOptions(false);
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
                }
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-zana-primary-light mb-2"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <Phone size={16} className="text-zana-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{tt('Free Call', lang)}</p>
                <p className="text-xs text-zana-muted">{tt('Through Zana — no airtime used', lang)}</p>
              </div>
            </button>
            <button
              onClick={() => {
                setShowCallOptions(false);
                if (trip?.customer?.phone) window.location.href = `tel:${trip.customer.phone}`;
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-gray-50"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <Phone size={16} className="text-gray-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{tt('Call Directly', lang)}</p>
                <p className="text-xs text-zana-muted">{tt("Using your phone's carrier network", lang)}</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !cancelling && setShowCancel(false)} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-lg text-gray-900">{tt('Cancel this ride?', lang)}</h2>
              <button onClick={() => setShowCancel(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-zana-muted mb-4">
              {tt('Tell us why — this goes to the customer and to Zana.', lang)}
            </p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder={tt("vehicle problem, customer not reachable…", lang)}
              rows={3}
              autoFocus
              className="w-full border-1.5 border-zana-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-zana-primary"
              style={{ borderWidth: 1.5 }}
            />
            {cancelError && <p className="text-xs text-zana-error mt-3">{cancelError}</p>}
            <button
              onClick={handleCancelTrip}
              disabled={!cancelReason.trim() || cancelling}
              className="w-full mt-4 bg-zana-error text-white font-semibold py-3 rounded-xl disabled:opacity-40"
            >
              {cancelling ? tt('Cancelling…', lang) : tt('Confirm cancellation', lang)}
            </button>
          </div>
        </div>
      )}
      {trip?.status === 'RIDE_COMPLETED' && !showRating && (
        <div className="absolute bottom-24 left-4 right-4">
          <button onClick={() => setShowRating(true)} className="w-full bg-zana-secondary text-gray-900 font-bold py-3 rounded-xl text-sm">
            {tt('⭐ Rate this passenger', lang)}
          </button>
        </div>
      )}
      {showRating && trip && (
        <RatingModal
          tripId={trip.id}
          driverName={trip.customer?.firstName ?? tt('passenger', lang)}
          onClose={() => setShowRating(false)}
        />
      )}
      {/* ── Ride cancelled by customer ────────────────────────────────── */}
      {cancelledNotice && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8 bg-white">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-5">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </div>
          <p className="text-xl font-black text-gray-900 mb-2">{tt('Ride cancelled', lang)}</p>
          <p className="text-sm text-gray-500 text-center mb-6">{cancelledNotice}</p>
          <button onClick={() => router.replace('/')}
            className="bg-zana-primary text-white font-bold px-8 py-3 rounded-2xl">
            {tt('Back to home', lang)}
          </button>
        </div>
      )}

      {/* ── MoMo payment ───────────────────────────────────────────────── */}
      {momoState !== 'idle' && trip && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50">
          <div className="w-full bg-white rounded-t-3xl p-6 pb-8">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            {momoState === 'prompt' || momoState === 'failed' ? (
              <>
                <p className="text-xl font-black text-gray-900 mb-1">{tt('Collect payment', lang)}</p>
                <p className="text-sm text-gray-500 mb-5">
                  {tt('Send a Mobile Money request for', lang)}{' '}
                  <span className="font-bold text-zana-primary">
                    {((trip as any).finalFare ?? trip.estimatedFare)?.toLocaleString()} RWF
                  </span>
                </p>

                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {tt("Customer's MoMo number", lang)}
                </label>
                <input
                  value={momoPhone}
                  onChange={e => setMomoPhone(e.target.value)}
                  placeholder="0788123456"
                  inputMode="tel"
                  className="w-full mt-2 mb-4 px-4 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 text-base font-semibold focus:border-zana-primary focus:outline-none"
                />

                {momoError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                    <p className="text-xs text-red-700">{momoError}</p>
                  </div>
                )}

                <button onClick={sendMomoPrompt} disabled={!momoPhone.trim()}
                  className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl disabled:opacity-40">
                  {momoState === 'failed' ? tt('Send prompt again', lang) : tt('Send payment request', lang)}
                </button>
                <button onClick={handleCollectCash} disabled={collectingCash}
                  className="w-full text-center text-sm text-gray-400 mt-3 py-1 disabled:opacity-50">
                  {collectingCash ? tt('Recording cash payment…', lang) : tt('Collect cash instead', lang)}
                </button>
              </>
            ) : momoState === 'sending' ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-10 h-10 border-3 border-zana-primary/20 border-t-zana-primary rounded-full animate-spin mb-4" />
                <p className="font-bold text-gray-900">{tt('Sending request...', lang)}</p>
              </div>
            ) : momoState === 'waiting' ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4 animate-pulse">
                  <span className="text-3xl">📱</span>
                </div>
                <p className="font-black text-lg text-gray-900 mb-1">{tt('Waiting for payment', lang)}</p>
                <p className="text-sm text-gray-500 text-center mb-1">
                  {tt('A prompt was sent to', lang)} {momoPhone}
                </p>
                <p className="text-xs text-gray-400 text-center mb-5">
                  {tt('Ask the customer to enter their PIN', lang)}
                </p>
                <div className="w-8 h-8 border-2 border-zana-primary/20 border-t-zana-primary rounded-full animate-spin mb-6" />

                <div className="w-full space-y-2">
                  <button onClick={sendMomoPrompt}
                    className="w-full border-2 border-zana-primary text-zana-primary font-bold py-3 rounded-2xl">
                    {tt('Send prompt again', lang)}
                  </button>
                  <button onClick={() => { clearInterval(momoPollRef.current); setMomoState('prompt'); }}
                    className="w-full text-center text-sm text-gray-400 py-2">
                    {tt('Use a different number', lang)}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p className="font-black text-lg text-gray-900">{tt('Payment received', lang)}</p>
                <p className="text-sm text-gray-500 mt-1">{tt('Trip complete', lang)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Outgoing call */}
      {showCall && outgoingCallId && outgoingRoom && outgoingWsUrl && outgoingToken && trip && (
        <VoiceCall
          ref={voiceCallRef}
          incomingCallId={outgoingCallId}
          roomName={outgoingRoom}
          wsUrl={outgoingWsUrl}
          token={outgoingToken}
          participantLabel={trip.customer?.firstName ?? tt('Passenger', lang)}
          onClose={() => { setShowCall(false); setOutgoingCallId(null); }}
          onSpeakerStateChange={s => { setSpeakerOn(s.speakerOn); setSpeakerSupported(s.speakerSupported); }}
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
          <p className="text-white/60 text-sm mb-1">{tt('Incoming call', lang)}</p>
          <p className="text-white text-3xl font-black mb-2">{incomingCall.callerName}</p>
          <p className="text-white/50 text-xs mb-12">{tt('Zana Ride · Free Call', lang)}</p>
          <div className="flex items-center gap-16">
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => { 
              try { (window as any).__zanaRingtone?.pause(); } catch {}
              api.post(`/calls/${incomingCall.callId}/decline`); 
              setIncomingCall(null); 
            }}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6z"/>
                </svg>
              </button>
              <p className="text-white/50 text-xs">{dt('Decline', lang)}</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={async () => {
              try { (window as any).__zanaRingtone?.pause(); } catch {}
              try {
                const res = await api.post<{callId:string;roomName:string;wsUrl:string;token:string}>(
                  `/calls/${incomingCall!.callId}/accept`
                );
                setIncomingCall(prev => prev ? { ...prev, roomName: res.roomName, wsUrl: res.wsUrl, token: res.token } : null);
                setShowCall(true);
              } catch (e) { console.error('[CALL] Accept failed:', e); }
            }}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                </svg>
              </button>
              <p className="text-white/50 text-xs">{dt('Accept', lang)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Accepted incoming call — connect to LiveKit */}
      {showCall && incomingCall && (
        <VoiceCall
          ref={voiceCallRef}
          incomingCallId={incomingCall.callId}
          roomName={incomingCall.roomName}
          wsUrl={incomingCall.wsUrl}
          token={incomingCall.token}
          participantLabel={incomingCall.callerName}
          onClose={() => { setShowCall(false); setIncomingCall(null); }}
          onSpeakerStateChange={s => { setSpeakerOn(s.speakerOn); setSpeakerSupported(s.speakerSupported); }}
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
