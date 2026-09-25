'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, MapPin, Navigation, ChevronRight, X, AlertTriangle } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { useLang } from '../lib/LangContext';
import {
  fetchMyDriverProfile, acceptTrip,
  goOnline, goOffline, updateDriverLocation, updateDriverMode,
  fetchPendingDeliveries, acceptDelivery, fetchEarnings, fetchMyActiveTrip,
  fetchRecentlyCompletedRide, logRecoveryEvent,
  fetchMyOffers, declineOffer, triggerSOS, RideOffer,
  DriverProfile, DriverTrip, PendingDelivery,
} from '../lib/api/driver';
import { io } from 'socket.io-client';
import { getToken } from '../lib/api/client';
import { getCurrentPosition, watchPosition, Coords } from '../lib/location';
import { startRideAlert, stopRideAlert } from '../lib/rideAlert';
import { api } from '../lib/api/client';
import { loadGoogleMaps } from '../lib/mapsLoader';
import { ZANA_MAP_STYLE } from '../lib/mapStyle';

const TIMEOUT = 20;

// A deliberately stable, production-grade slide control.
// Uses Pointer Events + pointer capture so the thumb cannot jitter, jump,
// or lose the gesture when the finger moves outside the track.
function SlideAction({
  label,
  busyLabel,
  successLabel,
  onComplete,
  color = '#00A082',
  disabled = false,
}: {
  label: string;
  busyLabel: string;
  successLabel: string;
  onComplete: () => Promise<void> | void;
  color?: string;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const pointerId = useRef<number | null>(null);
  const startX = useRef(0);
  const startOffset = useRef(0);

  const THUMB = 52;
  const EDGE = 6;
  const getMax = () => Math.max(0, (trackRef.current?.clientWidth ?? 320) - THUMB - EDGE * 2);

  const reset = () => {
    setDragging(false);
    setOffset(0);
    pointerId.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || busy || completed) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startOffset.current = offset;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || pointerId.current !== e.pointerId) return;
    const max = getMax();
    const next = Math.max(0, Math.min(max, startOffset.current + e.clientX - startX.current));
    setOffset(next);
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || pointerId.current !== e.pointerId) return;

    const max = getMax();
    const threshold = Math.max(48, max * 0.82);
    setDragging(false);
    pointerId.current = null;

    if (offset >= threshold) {
      setOffset(max);
      setBusy(true);
      try {
        await onComplete();
        setCompleted(true);
      } catch {
        setBusy(false);
        setOffset(0);
      }
    } else {
      setOffset(0);
    }
  };

  const handlePointerCancel = () => {
    if (!busy && !completed) reset();
  };

  return (
    <div
      ref={trackRef}
      role="button"
      aria-disabled={disabled || busy || completed}
      aria-label={busy ? busyLabel : completed ? successLabel : label}
      className="relative h-[60px] rounded-full select-none touch-none overflow-hidden border-2 shadow-sm"
      style={{
        borderColor: disabled ? '#E5E7EB' : color,
        background: disabled ? '#F3F4F6' : '#FFFFFF',
        opacity: disabled ? 0.65 : 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
    >
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ color: disabled ? '#9CA3AF' : color }}
      >
        <span className="text-[13px] font-extrabold tracking-wide">
          {busy ? busyLabel : completed ? successLabel : label}
        </span>
      </div>

      {!busy && !completed && (
        <div
          className="absolute left-[6px] top-[6px] bottom-[6px] rounded-full pointer-events-none"
          style={{
            width: offset + THUMB,
            background: `${color}16`,
            transition: dragging ? 'none' : 'width 180ms ease-out',
          }}
        />
      )}

      <div
        className="absolute top-[4px] left-[4px] w-[52px] h-[52px] rounded-full z-10 flex items-center justify-center shadow-lg border-2 border-white"
        style={{
          transform: `translateX(${offset}px)`,
          background: disabled ? '#9CA3AF' : color,
          transition: dragging ? 'none' : 'transform 180ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {busy ? (
          <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        ) : completed ? (
          <span className="text-white text-lg font-black">✓</span>
        ) : (
          <ChevronRight size={24} color="white" strokeWidth={3} />
        )}
      </div>
    </div>
  );
}

export default function DriverHome() {
  const router = useRouter();
  const { t, dt } = useLang();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);

  // The mandatory location-notice redirect that used to live here existed
  // solely to satisfy Google Play's prominent-disclosure requirement for
  // background location access. V1 no longer requests that permission
  // (see lib/location.ts), so the requirement — and this redirect — no
  // longer apply. The /location-notice page itself is left in place
  // rather than deleted, since it's a straightforward re-enable for V2.

  // A driver who force-closed the app, had it crash, or restarted their
  // phone mid-trip would otherwise land here on the normal home screen
  // with no indication their ride is still running — nothing anywhere
  // else checks for this on app launch, only the trip screen itself does,
  // which is no help if you're not already on it. The backend already
  // only ever returns a trip here if it's genuinely still active, so a
  // hit is always safe to act on directly, no extra status filtering
  // needed on this side.
  const [checkingActiveRide, setCheckingActiveRide] = useState(true);
  const [justCompleted, setJustCompleted] = useState<{ fare: number; paymentMethod: string; driverEarnings: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    logRecoveryEvent('ACTIVE_RIDE_CHECK_STARTED');

    // This endpoint always succeeds with either a trip or null — it never
    // throws just because there's no active ride. So a caught error here
    // can only mean a genuine failure to reach the server, never means
    // "no ride". Treating the two the same was the actual gap: a driver
    // with a real active ride could get sent to the home screen just
    // because one request happened to time out. Retry with backoff
    // before ever falling through to the normal home screen.
    const attempt = async (tries: number): Promise<void> => {
      try {
        // The ride check and the delivery check don't depend on each
        // other's result at all — nothing about one changes how the
        // other should run. They were previously awaited one after the
        // other anyway, meaning every single app launch paid for two
        // full round-trips in sequence before anything could render,
        // even in the ordinary case of no active job at all. Firing the
        // delivery check immediately, in parallel with the ride check,
        // rather than only starting it after the ride check finishes,
        // cuts that common-case wait roughly in half.
        const deliveryCheck = api.get<{ id: string } | null>('/driver/deliveries/active').catch(() => null);

        const trip = await fetchMyActiveTrip();
        if (cancelled) return;
        if (trip) {
          logRecoveryEvent('ACTIVE_RIDE_FOUND', trip.id, trip.status);
          router.replace('/trip?recovered=1');
          return;
        }

        logRecoveryEvent('ACTIVE_RIDE_CHECK_STARTED_NONE_FOUND');

        // No active ride — but this same check only ever covered rides.
        // A driver mid-way through a delivery batch who force-closed and
        // reopened the app would land right here on the normal home
        // screen, exactly the failure this whole recovery system exists
        // to prevent, just for the other half of the app. This was
        // already in flight above, so there's nothing left to wait for
        // here in the common case — its result is likely already back.
        const activeDelivery = await deliveryCheck;
        if (activeDelivery && !cancelled) {
          logRecoveryEvent('ACTIVE_DELIVERY_FOUND', activeDelivery.id);
          router.replace('/delivery?recovered=1');
          return;
        }

        // No active ride and no active delivery — the driver can see the
        // real home screen now; nothing past this point needs to keep it
        // hidden. Whether a ride was JUST completed is only relevant to
        // a small banner, not to whether the screen itself is ready —
        // this used to block the whole screen on that one purely
        // cosmetic check, adding a full extra round-trip to the visible
        // loading time for something that was never worth blocking on.
        setCheckingActiveRide(false);

        try {
          const recent = await fetchRecentlyCompletedRide();
          if (recent && !cancelled) {
            logRecoveryEvent('RIDE_COMPLETION_RECONCILED', recent.id);
            setJustCompleted(recent);
          }
        } catch {}
      } catch {
        if (cancelled) return;
        if (tries > 0) {
          logRecoveryEvent('ACTIVE_RIDE_RETRY');
          await new Promise((r) => setTimeout(r, (4 - tries) * 1500));
          if (!cancelled) await attempt(tries - 1);
        } else {
          // Genuinely couldn't reach the server after real retries — fall
          // through rather than trap the driver on a spinner forever.
          // Not perfect, but a bounded wait beats an infinite one.
          logRecoveryEvent('ACTIVE_RIDE_CHECK_FAILED');
          setCheckingActiveRide(false);
        }
      }
    };

    attempt(3);
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    const nav = navigator as any;
    if (!nav.getBattery) return;
    nav.getBattery().then((b: any) => {
      const update = () => setBattery({ level: Math.round(b.level * 100), charging: b.charging });
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    }).catch(() => {});
  }, []);
  const [online, setOnline] = useState(false);
  // Set when this device's location ping is rejected because a second
  // device has gone online on the same account since — see
  // updateDriverLocation in lib/api/driver.ts for how the backend
  // signals this.
  const [sessionSupersededNotice, setSessionSupersededNotice] = useState(false);
  const handleSessionSuperseded = useCallback(() => {
    setOnline(false);
    setSessionSupersededNotice(true);
  }, []);
  // A single shared slot rather than two separate error states — two
  // independent banners sharing the exact same screen position could both
  // fire close together and silently hide each other; one slot makes that
  // impossible by construction instead of needing careful sequencing.
  const [topBannerError, setTopBannerError] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  // Was a single incoming ride at a time — now a real list, each entry a
  // genuine, individually-tracked offer from the backend, not just
  // whatever happened to be first in a shared queue.
  const [offers, setOffers] = useState<RideOffer[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [driverMode, setDriverMode] = useState<'RIDES' | 'DELIVERIES' | 'BOTH'>('BOTH');
  const [incomingDelivery, setIncomingDelivery] = useState<PendingDelivery | null>(null);
  const [earnings, setEarnings] = useState<{ todayEarnings: number; totalTrips: number; walletBalance: number } | null>(null);
  // No notifications feature exists yet — this must not fabricate a
  // count. Remove this line once a real notification source is wired in.
  const notifications = 0;
  const [showMenu, setShowMenu] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [sosState, setSosState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [showMode, setShowMode] = useState(false);
  const [onlineFlow, setOnlineFlow] = useState<'online' | 'offline'>('online');
  const [onlineTransition, setOnlineTransition] = useState<'online' | 'offline' | null>(null);
  const seenIds = useRef(new Set<string>());

  // Init map
  // Previously started loading the full Maps SDK the instant this
  // component mounted, completely independent of whether the driver was
  // even about to stay on this screen at all. A driver with a genuinely
  // active ride or delivery gets redirected away entirely by the
  // recovery check above — in that whole, very common case, this was
  // pure wasted bandwidth and CPU for a map that would never actually be
  // seen, competing for the same connection as the recovery check itself
  // right when speed matters most. Now waits until we actually know
  // we're staying on this screen before spending anything on it.
  useEffect(() => {
    if (checkingActiveRide) return;
    loadGoogleMaps().then(() => {
      if (!mapRef.current || googleMapRef.current) return;
      const G = (window as any).google.maps;
      googleMapRef.current = new G.Map(mapRef.current, {
        center: { lat: -1.9536, lng: 30.0605 },
        zoom: 15,
        // Was mapId: 'zana_driver_home' — a Cloud-configured style ID
        // this API loading setup was never actually built to support
        // (the loader's own comment says as much, and the trip/delivery
        // map already learned this exact lesson and avoids it). A mapId
        // and inline styles are mutually exclusive — passing one means
        // any real styling gets silently dropped, which combined with
        // this app's dark theme is very likely why the screen looked
        // like a plain dark rectangle instead of an actual map. This
        // real, on-brand style already existed — just never wired in.
        styles: ZANA_MAP_STYLE,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        zoomControl: false,
      });
    });
  }, [checkingActiveRide]);

  // Update marker when coords change
  useEffect(() => {
    if (!coords || !googleMapRef.current) return;
    const G = (window as any).google?.maps;
    if (!G) return;
    const pos = { lat: coords.lat, lng: coords.lng };
    googleMapRef.current.setCenter(pos);
    if (!markerRef.current) {
      const div = document.createElement('div');
      div.innerHTML = `<div style="width:44px;height:44px;border-radius:50%;background:#00A082;border:3px solid white;box-shadow:0 2px 12px rgba(0,160,130,0.5);display:flex;align-items:center;justify-content:center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L19 21L12 17L5 21L12 2Z" fill="white"/>
        </svg>
      </div>`;
      try {
        markerRef.current = new G.marker.AdvancedMarkerElement({ position: pos, map: googleMapRef.current, content: div });
      } catch {
        markerRef.current = new G.Marker({ position: pos, map: googleMapRef.current });
      }
    } else {
      try { markerRef.current.position = pos; } catch { markerRef.current.setPosition(pos); }
    }
  }, [coords?.lat, coords?.lng]);

  // Load profile and earnings

  // Request screen wake lock so GPS keeps running while driver is online
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch { /* not supported */ }
    };
    requestWakeLock();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    });
    return () => { wakeLock?.release?.(); };
  }, []);

  useEffect(() => {
    fetchMyDriverProfile().then(p => {
      if (!p) return;
      setProfile(p);
      setOnline(p.onlineStatus === 'ONLINE');
      setDriverMode((p as any).driverMode ?? 'BOTH');
    }).catch(() => {});
    fetchEarnings().then(e => {
      if (e && typeof e === 'object') setEarnings(e);
    }).catch(() => {});
  }, []);

  // GPS watch
  useEffect(() => {
    getCurrentPosition().then(c => { if (c) setCoords(c); }).catch(() => {});
    const stop = watchPosition(c => {
      if (c) {
        setCoords(c);
        if (online) updateDriverLocation(c.lat, c.lng).catch((e: any) => {
          if (e?.message === 'SESSION_SUPERSEDED') handleSessionSuperseded();
        });
      }
    });
    return stop;
  }, [online]);

  // The watch above only reports a new position after the driver moves
  // roughly 15 meters — deliberately, so an actively-driving trip isn't
  // spamming updates every second. But an online, stationary driver
  // waiting for work is the single most common real state there is, and
  // that same distance filter means their stored position never
  // refreshes again after the first reading the moment they stop
  // moving — found by a tester whose reported location stayed on the
  // other side of the world from where dispatch was actually looking.
  // A driver who genuinely isn't moving still needs to stay findable, so
  // this guarantees a fresh reading on a plain timer too, independent of
  // whether they've physically gone anywhere.
  useEffect(() => {
    if (!online) return;
    const interval = setInterval(() => {
      getCurrentPosition().then(c => {
        if (c) {
          setCoords(c);
          updateDriverLocation(c.lat, c.lng).catch((e: any) => {
            if (e?.message === 'SESSION_SUPERSEDED') handleSessionSuperseded();
          });
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [online]);

  // Real, individual offers now — a WebSocket push the instant one
  // arrives, with a plain fetch of the driver's own current offers as
  // the fallback/reconciliation path if that connection ever drops or
  // misses something, same layered pattern used elsewhere in this app.
  useEffect(() => {
    if (!online || driverMode === 'DELIVERIES') { setOffers([]); return; }

    const load = () => fetchMyOffers().then(setOffers).catch(() => {});
    load();
    const interval = setInterval(load, 5000);

    const token = getToken();
    let socket: ReturnType<typeof io> | undefined;
    if (token) {
      socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com', {
        auth: { token },
        transports: ['websocket'],
      });
      socket.on('ride:offer', () => load());
      // The instant-removal counterpart to a driver declining — the
      // customer cancelling should clear it from view (and stop the
      // alert sounding for it) right away too, not leave it sitting
      // until its own 20s countdown happens to run out.
      socket.on('ride:offer-cancelled', (data: { tripId: string }) => {
        setOffers(prev => prev.filter(o => o.tripId !== data.tripId));
      });
    }

    return () => {
      clearInterval(interval);
      socket?.disconnect();
    };
  }, [online, driverMode]);

  // One shared alert, tied purely to "is there at least one offer
  // waiting" rather than to the exact count — a second or third offer
  // arriving while one is already pending must not start a second,
  // overlapping alert loop, it should just keep the same one going.
  // Accepting, declining, expiring, and now cancellation, all already
  // remove the offer from this same array elsewhere in this file, so
  // stopping the alert the moment the array empties covers all four
  // cases without needing separate handling for each.
  useEffect(() => {
    if (offers.length > 0) {
      startRideAlert();
    } else {
      stopRideAlert();
    }
    return () => stopRideAlert();
  }, [offers.length > 0]);

  // Ticks once a second so every offer's own countdown — each has its own
  // real expiresAt from the backend, not one shared timer — stays live,
  // and quietly drops any that have genuinely run out without waiting on
  // a server round-trip to notice.
  useEffect(() => {
    if (offers.length === 0) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      setOffers(prev => prev.filter(o => new Date(o.expiresAt).getTime() > n));
    }, 1000);
    return () => clearInterval(t);
  }, [offers.length]);

  // Poll for deliveries
  useEffect(() => {
    if (!online || !coords || driverMode === 'RIDES') return;
    const interval = setInterval(async () => {
      if (offers.length > 0 || incomingDelivery) return;
      try {
        const dels = await fetchPendingDeliveries(coords.lat, coords.lng);
        const nd = dels.find(d => !seenIds.current.has(d.id));
        if (nd) { seenIds.current.add(nd.id); setIncomingDelivery(nd); }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [online, coords, offers.length, incomingDelivery, driverMode]);


  const handleSOS = async () => {
    if (sosState === 'sending' || sosState === 'sent') return;
    setSosState('sending');

    const activeTripId = activeTrip?.id;
    const send = async (coords?: { lat: number; lng: number }) => {
      try {
        await triggerSOS(activeTripId, coords);
        setSosState('sent');
      } catch {
        setSosState('error');
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => send({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => send(),
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 5000 },
      );
    } else {
      await send();
    }
  };

  const handleToggle = async () => {
    if (!online) {
      setShowMenu(false);
      setOnlineFlow('online');
      setShowMode(true);
      return;
    }

    setShowMenu(false);
    setOnlineFlow('offline');
    setShowMode(true);
  };

  const handleModeSelect = (mode: typeof driverMode) => {
    setDriverMode(mode);
  };

  const handleOnlineConfirm = async () => {
    setShowMode(false);
    setOnlineTransition('online');
    setLoading(true);
    try {
      await updateDriverMode(driverMode);
      const updated = await goOnline();
      setOnline(true);
      setProfile(updated as any);
      await new Promise(resolve => setTimeout(resolve, 900));
      setOnlineTransition(null);
    } catch (e: any) {
      setOnlineTransition(null);
      setTopBannerError(
        e?.message === 'DRIVER_NOT_APPROVED'
          ? dt("Your account is still pending approval — you can go online once it's reviewed.")
          : dt('Could not go online. Check your connection and try again.')
      );
      setTimeout(() => setTopBannerError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineConfirm = async () => {
    setShowMode(false);
    setOnlineTransition('offline');
    setLoading(true);
    try {
      await goOffline();
      setOnline(false);
      setOffers([]);
      setIncomingDelivery(null);
      await new Promise(resolve => setTimeout(resolve, 900));
      setOnlineTransition(null);
    } catch {
      setOnlineTransition(null);
      setTopBannerError(dt('Could not go offline. Check your connection and try again.'));
      setTimeout(() => setTopBannerError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offer: RideOffer) => {
    try {
      // Previously silent — if someone else took the ride first, or the
      // request just failed to reach the server, this used to send the
      // driver to /trip anyway with nothing actually there to show. Now
      // the driver stays here and sees why, instead of landing on a page
      // that looks broken for a reason that had nothing to do with the app.
      await acceptTrip(offer.tripId);
      // Winning one ride means every other ride offer this driver was
      // holding is now moot — the backend already cancels them on its
      // side too; this just reflects that immediately rather than
      // waiting for the next poll to catch up.
      setOffers([]);
      router.push('/trip');
    } catch (e: any) {
      setTopBannerError(
        e?.message?.includes('404') || e?.message?.includes('already')
          ? 'Someone else already took this ride.'
          : 'Could not accept — check your connection and try again.'
      );
      setTimeout(() => setTopBannerError(''), 4000);
      setOffers(prev => prev.filter(o => o.id !== offer.id));
    }
  };

  const handleDeclineOffer = async (offer: RideOffer) => {
    // Removed from view immediately — no reason to make the driver watch
    // out a countdown for something they've already said no to.
    setOffers(prev => prev.filter(o => o.id !== offer.id));
    await declineOffer(offer.id).catch(() => {});
  };

  const onlineTimeStr = '0h 0m';

  // Used to fully block the entire home screen behind a spinner while
  // this ran — every single launch paid for a full network round-trip
  // of blank screen before showing anything, even in the overwhelming
  // common case of no active ride to recover. The check itself still
  // runs exactly the same; it just no longer holds the whole page
  // hostage to do it. A driver who genuinely does have an active ride
  // still gets redirected away the moment it's found — they just don't
  // stare at a blank spinner for a round-trip first if they don't.
  if (justCompleted) {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-8 bg-white">
        <div className="w-20 h-20 rounded-full bg-zana-primary-light flex items-center justify-center mb-5">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00A082" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p className="text-xl font-black text-gray-900 mb-1">{t('Ride completed successfully')}</p>
        <p className="text-sm text-zana-muted mb-6">
          {justCompleted.paymentMethod === 'CASH' ? 'Cash payment' : justCompleted.paymentMethod}
        </p>
        <div className="w-full bg-gray-50 rounded-2xl p-4 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zana-muted">{dt("Fare")}</span>
            <span className="text-sm font-bold text-gray-900">{justCompleted.fare.toLocaleString()} RWF</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zana-muted">{dt("Your earnings")}</span>
            <span className="text-sm font-bold text-zana-primary">{justCompleted.driverEarnings.toLocaleString()} RWF</span>
          </div>
        </div>
        <button
          onClick={() => { setJustCompleted(null); }}
          className="w-full bg-zana-primary text-white font-bold py-3.5 rounded-2xl"
        >{dt("Done")}</button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      {sessionSupersededNotice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm text-center">
            <p className="text-sm text-gray-800 leading-relaxed mb-5">
              {dt("You've been logged in on another device, so this one has been taken offline.")}
            </p>
            <button
              onClick={() => setSessionSupersededNotice(false)}
              className="w-full bg-zana-primary text-white font-bold py-3 rounded-xl"
            >
              {dt('I understand — continue')}
            </button>
          </div>
        </div>
      )}
      {topBannerError && (
        <div className="fixed top-4 left-4 right-4 z-[60] bg-red-600 text-white text-sm text-center py-3 rounded-xl shadow-lg">
          {topBannerError}
        </div>
      )}
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-10 pb-2 flex items-center justify-between">
        <button
          onClick={() => { setShowMode(false); setShowMenu(true); }}
          className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center"
        >
          <Menu size={20} className="text-gray-700" />
        </button>

        <div className="flex flex-col items-center">
          <p className="font-black text-xl tracking-tight">
            <span className="text-zana-primary">ZANA</span>
          </p>
          <p className="text-[10px] text-gray-500 font-semibold tracking-widest -mt-1">— Driver —</p>
        </div>

        <button className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center relative">
          <Bell size={20} className="text-gray-700" />
          {notifications > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">{notifications}</span>
            </div>
          )}
        </button>
      </div>

      {/* Map — takes up ~55% of screen */}
      <div className="relative" style={{ height: '52%' }}>
        <div ref={mapRef} className="w-full h-full" style={{ backgroundColor: '#F7F5EF' }} />

        {/* Online status pill */}
        <div className="absolute top-24 left-0 right-0 flex justify-center z-10">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow ${online ? 'bg-white' : 'bg-white'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
            <p className="text-sm font-semibold text-gray-800">
              {online ? t('You are online') : t('You are offline')}
            </p>
          </div>
        </div>

        {/* Map controls */}
        <div className="absolute right-3 bottom-4 flex flex-col gap-2 z-10">
          <button
            onClick={() => { if (coords && googleMapRef.current) googleMapRef.current.panTo({ lat: coords.lat, lng: coords.lng }); }}
            className="w-11 h-11 bg-white rounded-full shadow flex items-center justify-center"
          >
            <Navigation size={18} className="text-zana-primary" />
          </button>
        </div>

        {/* Battery + Vehicle status cards */}
        <div className="absolute left-3 bottom-4 z-10">
          <div className="bg-white rounded-2xl shadow px-3 py-2 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="7" width="18" height="10" rx="2" stroke="#00A082" strokeWidth="2"/>
                <path d="M20 11v2" stroke="#00A082" strokeWidth="2" strokeLinecap="round"/>
                <rect x="4" y="9" width={`${battery ? battery.level / 10 : 8.5}`} height="6" rx="1" fill={battery && battery.level < 20 ? '#EF4444' : '#00A082'}/>
              </svg>
              <div>
                <p className={`text-sm font-bold ${battery && battery.level < 20 ? 'text-red-500' : 'text-gray-900'}`}>{battery ? `${battery.level}%` : '--'}{battery?.charging ? ' ⚡' : ''}</p>
                <p className="text-[9px] text-gray-400">{t('Battery')}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex items-center gap-1.5">
              <svg width="18" height="14" viewBox="0 0 24 18" fill="none">
                <path d="M3 12c0-3 2-5 5-5h8c3 0 5 2 5 5" stroke="#00A082" strokeWidth="2"/>
                <circle cx="7" cy="14" r="2" fill="#00A082"/>
                <circle cx="17" cy="14" r="2" fill="#00A082"/>
              </svg>
              <div>
                <p className="text-sm font-bold text-gray-900">{t('Good')}</p>
                <p className="text-[9px] text-gray-400">{t('Vehicle')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom panel — scrollable */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 overflow-y-auto shadow-2xl z-10">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-4 space-y-4 pb-24">
          {/* Vehicle info */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
            <div className="w-12 h-12 rounded-xl bg-zana-primary-light flex items-center justify-center">
              <Navigation size={20} className="text-zana-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">
                {profile?.vehicle ?? '—'} • {(profile as any)?.color ?? ''} • {profile?.plate ?? '—'}
              </p>
              <p className="text-xs text-zana-primary font-semibold mt-0.5">
                ID: ZN-DV-{profile?.id?.slice(0, 4).toUpperCase() ?? '----'}
              </p>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700"
            >
              {dt('Details')} <ChevronRight size={12} />
            </button>
          </div>

          {/* Driver SOS */}
          <button
            onClick={() => { setSosState('idle'); setShowSOS(true); }}
            className="w-full mb-3 h-12 rounded-2xl border-2 border-red-200 bg-red-50 text-red-700 flex items-center justify-center gap-2 font-black text-sm active:scale-[0.99] transition-transform"
          >
            <AlertTriangle size={17} />
            {dt('SOS EMERGENCY')}
          </button>

          {/* ZANA online/offline control */}
          {online ? (
            <button
              onClick={() => { setOnlineFlow('offline'); setShowMode(true); }}
              disabled={loading}
              className="w-full h-[72px] rounded-2xl bg-white border-2 border-amber-500 shadow-sm flex items-center justify-center gap-3 active:scale-[0.99] transition-transform disabled:opacity-60"
            >
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-[15px] font-black tracking-wide text-gray-900">{dt('GO OFFLINE')}</span>
            </button>
          ) : (
            <button
              onClick={() => { setOnlineFlow('online'); setShowMode(true); }}
              disabled={loading}
              className="w-full h-[72px] rounded-2xl bg-zana-primary text-white shadow-lg flex flex-col items-center justify-center active:scale-[0.99] transition-transform disabled:opacity-60"
            >
              <span className="text-[16px] font-black tracking-wide">{dt('GO ONLINE')}</span>
              <span className="text-[11px] font-semibold opacity-90 mt-0.5">{dt('Ready to receive requests')}</span>
            </button>
          )}

          {/* Status message */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
            <p className="text-xs text-gray-500">
              {online
                ? `${dt("You're online and ready to receive requests")} · ${dt(driverMode === 'RIDES' ? 'Rides only' : driverMode === 'DELIVERIES' ? 'Deliveries only' : 'Rides & Deliveries')}`
                : dt('Go online to start receiving ride requests')}
            </p>
          </div>

          {/* Today's overview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900">{t("Today's Overview")}</p>
              <button onClick={() => router.push('/earnings')} className="text-xs text-zana-primary font-semibold flex items-center gap-0.5">
                See all <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                {
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#00A082" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="#E6A82E" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="#00A082" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="#E6A82E" strokeWidth="2"/></svg>,
                  bg: '#E3F5F1', value: earnings?.totalTrips ?? 0, label: t('Completed'), route: '/rides'
                },
                {
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#E6A82E" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="#E6A82E" strokeWidth="2" strokeLinecap="round"/></svg>,
                  bg: '#FBF1DD', value: onlineTimeStr, label: t('Online time'), route: null
                },
                {
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="#4F9EF8" strokeWidth="2"/><path d="M2 9h20" stroke="#4F9EF8" strokeWidth="2"/></svg>,
                  bg: '#E8F0FE', value: earnings ? `${(earnings.todayEarnings ?? 0).toLocaleString()}` : '0', label: 'RWF Earnings', small: true, route: '/earnings'
                },
                {
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><polygon points="12,2 15,8.5 22,9.5 17,14.2 18.2,21 12,17.7 5.8,21 7,14.2 2,9.5 9,8.5" stroke="#9B59B6" strokeWidth="2" fill="none"/></svg>,
                  bg: '#F3E8FF', value: (profile?.rating ?? 0).toFixed(1), label: t('Rating'), route: '/ratings'
                },
              ].map(({ icon, bg, value, label, small, route }, i) => (
                <button
                  key={i}
                  onClick={() => route && router.push(route)}
                  disabled={!route}
                  className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-sm disabled:opacity-100"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: bg }}>
                    {icon}
                  </div>
                  <p className={`font-black text-gray-900 ${small ? 'text-xs' : 'text-base'}`}>{value}</p>
                  <p className="text-[9px] text-gray-400 text-center leading-tight">{label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showSOS && (
        <div className="fixed inset-0 z-[75] flex items-end bg-black/60">
          <div className="w-full bg-white rounded-t-[30px] p-5 pb-7 shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {sosState === 'sent' ? (
              <div className="text-center py-5">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <AlertTriangle size={30} className="text-red-600" />
                </div>
                <h2 className="text-xl font-black text-gray-900">{dt('SOS alert sent')}</h2>
                <p className="text-sm text-gray-500 mt-2">{dt('Zana Safety has received your emergency alert and your location.')}</p>
                <button onClick={() => setShowSOS(false)} className="w-full mt-6 bg-zana-primary text-white font-bold py-3.5 rounded-xl">
                  {dt('Close')}
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-5">
                  <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertTriangle size={30} className="text-red-600" />
                  </div>
                  <h2 className="text-xl font-black text-gray-900">{dt('Emergency SOS')}</h2>
                  <p className="text-sm text-gray-500 mt-2">{dt('Use SOS if you are in immediate danger or need urgent safety assistance.')}</p>
                </div>

                {sosState === 'error' && (
                  <p className="text-sm text-red-600 text-center font-semibold mb-3">{dt('SOS could not be sent. Check your connection and try again.')}</p>
                )}

                <button
                  onClick={handleSOS}
                  disabled={sosState === 'sending'}
                  className="w-full py-4 rounded-2xl bg-red-600 text-white font-black text-base disabled:opacity-60"
                >
                  {sosState === 'sending' ? dt('Sending SOS...') : dt('SEND SOS ALERT')}
                </button>

                <button onClick={() => setShowSOS(false)} disabled={sosState === 'sending'} className="w-full mt-3 py-3 text-sm font-semibold text-gray-400">
                  {dt('Cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Online / offline confirmation sheet */}
      {showMode && (
        <div className="fixed inset-0 z-[55] flex items-end bg-black/55">
          <div className="w-full bg-white rounded-t-[30px] p-5 pb-7 shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {onlineFlow === 'online' ? (
              <>
                <div className="mb-5">
                  <p className="text-[11px] font-black tracking-widest text-zana-primary uppercase mb-1">{dt('GO ONLINE')}</p>
                  <h2 className="text-xl font-black text-gray-900">{dt('What do you want to receive?')}</h2>
                  <p className="text-sm text-gray-500 mt-1">{dt('Choose what you want to receive while you are online.')}</p>
                </div>

                <div className="space-y-2.5">
                  {([
                    { mode: 'RIDES', label: t('Rides only'), sub: dt('Passenger pickup requests') },
                    { mode: 'DELIVERIES', label: t('Deliveries only'), sub: dt('Package delivery requests') },
                    { mode: 'BOTH', label: t('Both'), sub: dt('Rides & Deliveries') },
                  ] as const).map(({ mode, label, sub }) => (
                    <button
                      key={mode}
                      onClick={() => handleModeSelect(mode)}
                      className={`w-full flex items-center gap-4 rounded-2xl px-4 py-4 text-left border-2 transition-all ${driverMode === mode ? 'border-zana-primary bg-zana-primary-light' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${driverMode === mode ? 'border-zana-primary' : 'border-gray-300'}`}>
                        {driverMode === mode && <div className="w-3 h-3 rounded-full bg-zana-primary" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-gray-900 text-sm">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  <p className="text-[11px] text-gray-400 text-center mb-2">{dt('Slide to confirm')}</p>
                  <SlideAction
                    label={dt('Slide to go online')}
                    busyLabel={dt('Taking you online...')}
                    successLabel={dt('Online')}
                    onComplete={handleOnlineConfirm}
                    color="#00A082"
                    disabled={loading}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <p className="text-[11px] font-black tracking-widest text-amber-600 uppercase mb-1">{dt('GO OFFLINE')}</p>
                  <h2 className="text-xl font-black text-gray-900">{dt('Go offline?')}</h2>
                  <p className="text-sm text-gray-500 mt-1">{dt('You will stop receiving new requests.')}</p>
                </div>

                <div className="rounded-2xl bg-gray-50 px-4 py-3.5 mb-5 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{dt("You're online")}</p>
                    <p className="text-xs text-gray-500">{dt(driverMode === 'RIDES' ? 'Rides only' : driverMode === 'DELIVERIES' ? 'Deliveries only' : 'Rides & Deliveries')}</p>
                  </div>
                </div>

                <SlideAction
                  label={dt('Slide to go offline')}
                  busyLabel={dt('Going offline...')}
                  successLabel={dt('Offline')}
                  onComplete={handleOfflineConfirm}
                  color="#E6A82E"
                  disabled={loading}
                />
              </>
            )}

            <button
              onClick={() => setShowMode(false)}
              disabled={loading}
              className="w-full mt-4 text-sm font-semibold text-gray-400 py-2 disabled:opacity-50"
            >
              {dt('Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Transition overlay */}
      {onlineTransition && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white">
          <div className="text-center px-8">
            <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6 ${onlineTransition === 'online' ? 'bg-zana-primary-light' : 'bg-gray-100'}`}>
              <div className={`w-10 h-10 rounded-full border-4 animate-spin ${onlineTransition === 'online' ? 'border-zana-primary/20 border-t-zana-primary' : 'border-gray-300 border-t-gray-700'}`} />
            </div>
            <p className="text-2xl font-black text-gray-900">
              {onlineTransition === 'online' ? dt('Taking you online...') : dt('Taking you offline...')}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {onlineTransition === 'online'
                ? dt('Connecting you to new requests')
                : dt('Stopping new requests')}
            </p>
          </div>
        </div>
      )}

      {/* Incoming ride offers — up to 4 at once, each a real, individually
          tracked offer rather than a single shared slot. Stacked in a
          scrollable list rather than each fixed independently, since more
          than one at the same screen position would just sit on top of
          each other. */}
      {offers.length > 0 && (
        <div className="fixed inset-x-4 bottom-28 z-40 max-h-[65vh] overflow-y-auto space-y-3">
          {offers.map(offer => {
            const secondsLeft = Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - now) / 1000));
            const trip = offer.trip;
            return (
              <div key={offer.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="h-1 bg-gray-100">
                  <div
                    className="h-full bg-zana-primary transition-all duration-1000"
                    style={{ width: `${(secondsLeft / TIMEOUT) * 100}%` }}
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-zana-primary-light flex items-center justify-center">
                        <MapPin size={14} className="text-zana-primary" />
                      </div>
                      <p className="text-xs font-bold text-zana-primary uppercase tracking-wide">{dt("New ride request")}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <p className="text-sm font-black text-gray-700">{secondsLeft}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-zana-primary mt-1.5 shrink-0" />
                      <p className="text-sm text-gray-700 truncate">{trip.pickupAddress}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <p className="text-sm text-gray-700 truncate">{trip.destinationAddress}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-2xl font-black text-zana-primary">{(trip.estimatedFare ?? 0).toLocaleString()} RWF</p>
                      <p className="text-xs text-gray-400">
                        {trip.serviceType} · {dt((trip as any).paymentMethod ?? 'Cash')} · {offer.distanceKm} {dt('km away')}
                      </p>
                    </div>
                    <button onClick={() => handleDeclineOffer(offer)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <X size={16} className="text-gray-500" />
                    </button>
                  </div>

                  <SlideAction label={dt("Slide to accept ride")} busyLabel={dt("Accepting…")} successLabel={dt("Accepted!")} onComplete={() => handleAcceptOffer(offer)} color="#00A082" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Incoming delivery */}
      {incomingDelivery && offers.length === 0 && (
        <div className="fixed inset-x-4 bottom-28 z-40">
          <div className="bg-white rounded-3xl shadow-2xl p-4">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-3">{t('Delivery Request')}</p>
            <p className="font-bold text-gray-900">{incomingDelivery.itemDescription}</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">{incomingDelivery.pickupAddress}</p>
            <div className="flex items-center justify-between mb-4">
              <p className="text-2xl font-black text-zana-primary">{(incomingDelivery.fee ?? 0).toLocaleString()} RWF</p>
              <p className="text-xs text-gray-400">{incomingDelivery.distanceKm} {dt('km away')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIncomingDelivery(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm">{dt("Decline")}</button>
              <button onClick={async () => { await acceptDelivery(incomingDelivery.id); setIncomingDelivery(null); }}
                className="flex-1 bg-zana-primary text-white font-bold py-3 rounded-xl text-sm">{dt("Accept")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Side menu */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 bg-white h-full shadow-2xl p-6">
            <div className="flex items-center justify-between mb-8">
              <p className="font-black text-lg text-gray-900">{t('Menu')}</p>
              <button onClick={() => setShowMenu(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {[
                { label: t('Home'), route: '/' },
                { label: t('Deliveries'), route: '/deliveries' },
                { label: t('Earnings'), route: '/earnings' },
                { label: t('Profile'), route: '/profile' },
              ].map(({ label, route }) => (
                <button key={label} onClick={() => { router.push(route); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold text-gray-700">
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{dt("Language")}</p>
              <div className="px-4">
                <LanguageSelector variant="light" />
              </div>
            </div>
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setShowMenu(false)} />
        </div>
      )}
    </div>
  );
}
