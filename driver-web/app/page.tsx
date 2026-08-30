'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, MapPin, Wallet, Star, Navigation, MessageCircle, Globe, Bike, Truck, LayoutGrid } from 'lucide-react';
import ChatPanel from '../components/ChatPanel';
import LanguageSelector from '../components/LanguageSelector';
import { updateDriverMode } from '../lib/api/driver';
import { getStoredLang, dt } from '../lib/lang';
import {
  fetchMyDriverProfile,
  fetchMyActiveTrip,
  fetchSearchingTrips,
  acceptTrip,
  declineTrip,
  goOnline,
  goOffline,
  updateDriverLocation,
  fetchPendingDeliveries,
  acceptDelivery,
  DriverProfile,
  DriverTrip,
  PendingDelivery,
} from '../lib/api/driver';
import { getCurrentPosition, watchPosition, haversineKm, Coords } from '../lib/location';
import { clearToken } from '../lib/api/client';
import DriverMap from '../components/DriverMap';

const REQUEST_TIMEOUT_SECONDS = 15;

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [online, setOnline] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [incoming, setIncoming] = useState<DriverTrip | null>(null);
  const [countdown, setCountdown] = useState(REQUEST_TIMEOUT_SECONDS);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [incomingDelivery, setIncomingDelivery] = useState<PendingDelivery | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [driverMode, setDriverMode] = useState<'RIDES' | 'DELIVERIES' | 'BOTH'>('BOTH');
  const [showChat, setShowChat] = useState(false);
  const [activeTripForChat, setActiveTripForChat] = useState<string | null>(null);
  const lang = getStoredLang();
  const seenTripIds = useRef<Set<string>>(new Set());

  const handleLogout = () => {
    clearToken();
    router.replace('/login');
  };

  // Load profile + check for an already-active trip (e.g. app was closed mid-ride).
  useEffect(() => {
    fetchMyDriverProfile().then((p) => {
      setProfile(p);
      setOnline(p.onlineStatus === 'ONLINE');
    });
    fetchMyActiveTrip().then((trip) => {
      if (trip) router.replace(`/trip?id=${trip.id}`);
    });
  }, [router]);

  if (profile && profile.approvalStatus !== 'APPROVED') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-zana-secondary/20 flex items-center justify-center mb-4">
          <Wallet size={26} className="text-zana-secondary-dark" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">
          {profile.approvalStatus === 'REJECTED' ? 'Application not approved' : 'Application under review'}
        </h1>
        <p className="text-sm text-zana-muted mt-2 max-w-xs">
          {profile.approvalStatus === 'REJECTED'
            ? 'Your driver application was not approved. Contact support for details.'
            : "We're reviewing your documents and vehicle details. This usually takes 1-2 business days."}
        </p>
        <button onClick={handleLogout} className="mt-6 text-sm font-semibold text-zana-primary">
          Log out
        </button>
      </div>
    );
  }

  // Get an initial fix immediately, then keep tracking continuously while online.
  useEffect(() => {
    getCurrentPosition().then((c) => c && setCoords(c));
    if (!online) return;
    const stop = watchPosition((c) => setCoords(c));
    return stop;
  }, [online]);

  // Push location to the backend periodically while online, not on every
  // single GPS tick — a real driver's phone can report many times a second.
  useEffect(() => {
    if (!online || !coords) return;
    updateDriverLocation(coords.lat, coords.lng).catch(() => {});
    const interval = setInterval(() => {
      if (coords) updateDriverLocation(coords.lat, coords.lng).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Poll for new ride requests while online and not already busy with one.
  useEffect(() => {
    if (!online || incoming) return;
    const poll = async () => {
      try {
        const trips = await fetchSearchingTrips();
        const fresh = trips.find((t) => !seenTripIds.current.has(t.id));
        if (fresh) {
          seenTripIds.current.add(fresh.id);
          setIncoming(fresh);
          setCountdown(REQUEST_TIMEOUT_SECONDS);
        }
      } catch {
        // retry next tick
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [online, incoming]);

  // Countdown + auto-decline when a request isn't answered in time.
  useEffect(() => {
    if (!incoming) return;
    if (countdown <= 0) {
      declineTrip(incoming.id).catch(() => {});
      setIncoming(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [incoming, countdown]);

  const handleToggle = async () => {
    setLoadingToggle(true);
    try {
      if (online) {
        await goOffline();
        setOnline(false);
      } else {
        // Show mode selector before going online
        setShowModeSelector(true);
        setLoadingToggle(false);
        return;
      }
    } catch {
      // leave state unchanged on failure
    } finally {
      setLoadingToggle(false);
    }
  };

  const handleModeSelect = async (mode: 'RIDES' | 'DELIVERIES' | 'BOTH') => {
    setDriverMode(mode);
    setShowModeSelector(false);
    setLoadingToggle(true);
    try {
      await updateDriverMode(mode);
      await goOnline();
      setOnline(true);
    } catch {
      // leave offline on failure
    } finally {
      setLoadingToggle(false);
    }
  };

  const handleAccept = async () => {
    if (!incoming) return;
    try {
      await acceptTrip(incoming.id);
      router.push(`/trip?id=${incoming.id}`);
    } catch {
      setIncoming(null);
    }
  };

  const handleDecline = async () => {
    if (!incoming) return;
    await declineTrip(incoming.id).catch(() => {});
    setIncoming(null);
  };

  const distanceToPickup =
    incoming && coords ? haversineKm(coords.lat, coords.lng, incoming.pickupLat, incoming.pickupLng) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-gradient-to-br from-zana-primary-dark to-zana-primary px-4 pt-4 pb-6 rounded-b-3xl animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">Hello,</p>
            <p className="text-white text-lg font-bold">{profile?.user.firstName ?? '…'}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button onClick={() => router.push('/earnings')} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white">
              <Wallet size={16} />
            </button>
            <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Link href="/deliveries" className="flex items-center gap-1.5 bg-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            📦 Browse Deliveries
          </Link>
        </div>

        {online && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-white/70 text-xs">Mode:</span>
            <span className="text-white text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
              {driverMode === 'RIDES' ? dt('Rides only', lang) : driverMode === 'DELIVERIES' ? dt('Deliveries only', lang) : dt('Both', lang)}
            </span>
          </div>
        )}

        <button
          onClick={handleToggle}
          disabled={loadingToggle}
          className={`w-full mt-4 py-4 rounded-2xl font-bold text-center transition-colors ${
            online ? 'bg-zana-secondary text-gray-900' : 'bg-white/15 text-white'
          }`}
        >
          {loadingToggle ? '…' : online ? dt('Go Offline', lang) : dt('Go Online', lang)}
        </button>
      </div>

      <div className="relative">
        <DriverMap position={coords} height={220} />
        <div
          className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shadow ${
            online ? 'bg-zana-primary text-white' : 'bg-white text-zana-muted'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-white' : 'bg-gray-400'}`} />
          {online ? 'Live' : 'Offline'}
        </div>
      </div>

      <div className="flex-1 p-4">
        {profile && (
          <div className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm mb-4">
            <div className="w-10 h-10 rounded-full bg-zana-primary-light flex items-center justify-center">
              <Star size={18} className="text-zana-secondary fill-zana-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{profile.rating.toFixed(1)} rating</p>
              <p className="text-xs text-zana-muted">{profile.vehicle} · {profile.plate}</p>
            </div>
          </div>
        )}

        {!online && (
          <div className="text-center py-16 text-zana-muted text-sm">
            You're offline. Go online to start receiving ride requests.
          </div>
        )}

        {online && !incoming && (
          <div className="text-center py-16 text-zana-muted text-sm animate-fade-in">
            Waiting for ride requests…
          </div>
        )}
      </div>

      {incoming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 animate-fade-slide-up">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg text-gray-900">New Ride Request</h2>
              <span className="text-sm font-bold text-zana-primary">{countdown}s</span>
            </div>
            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-zana-primary transition-all"
                style={{ width: `${(countdown / REQUEST_TIMEOUT_SECONDS) * 100}%` }}
              />
            </div>

            <div className="flex items-start gap-2 mb-2">
              <MapPin size={15} className="text-zana-primary mt-0.5 shrink-0" />
              <p className="text-sm text-gray-900">{incoming.pickupAddress}</p>
            </div>
            <div className="flex items-start gap-2 mb-4">
              <Navigation size={15} className="text-zana-secondary-dark mt-0.5 shrink-0" />
              <p className="text-sm text-gray-900">{incoming.destinationAddress}</p>
            </div>

            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-5">
              <div>
                <p className="text-xs text-zana-muted">Distance to pickup</p>
                <p className="text-sm font-semibold text-gray-900">
                  {distanceToPickup !== null ? `${distanceToPickup.toFixed(1)} km` : '…'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zana-muted">You'll earn</p>
                <p className="text-sm font-semibold text-gray-900">{incoming.estimatedFare.toLocaleString()} RWF</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDecline}
                className="flex-1 border border-zana-border text-gray-700 font-semibold py-3 rounded-xl"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 bg-zana-primary text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming delivery request */}
      {incomingDelivery && !incoming && (
        <div className="fixed inset-x-4 bottom-6 z-40 bg-white rounded-2xl shadow-2xl p-4 animate-fade-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">📦 Delivery Request</p>
              <p className="font-semibold text-gray-900 mt-0.5">{incomingDelivery.itemDescription}</p>
              <p className="text-xs text-zana-muted">{incomingDelivery.pickupAddress}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-zana-primary">{incomingDelivery.fee?.toLocaleString()} RWF</p>
              <p className="text-xs text-zana-muted">{incomingDelivery.distanceKm} km away</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIncomingDelivery(null)}
              className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm"
            >
              Decline
            </button>
            <button
              onClick={async () => {
                await acceptDelivery(incomingDelivery.id);
                setIncomingDelivery(null);
              }}
              className="flex-1 bg-zana-primary text-white font-semibold py-3 rounded-xl text-sm"
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {/* Mode selector — shown before going online */}
      {showModeSelector && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModeSelector(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-6 animate-fade-slide-up">
            <h2 className="text-lg font-bold text-gray-900 mb-1">{dt('What do you want to receive?', lang)}</h2>
            <p className="text-sm text-zana-muted mb-5">You can change this later from the mode badge.</p>
            <div className="space-y-3">
              {([
                { mode: 'RIDES', icon: Navigation, label: dt('Rides only', lang), sub: 'Passenger ride requests only' },
                { mode: 'DELIVERIES', icon: Truck, label: dt('Deliveries only', lang), sub: 'Package delivery requests only' },
                { mode: 'BOTH', icon: LayoutGrid, label: dt('Both', lang), sub: 'Rides and deliveries' },
              ] as const).map(({ mode, icon: Icon, label, sub }) => (
                <button
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  className="w-full flex items-center gap-4 bg-gray-50 hover:bg-zana-primary-light rounded-xl px-4 py-3.5 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                    <Icon size={18} className="text-zana-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{label}</p>
                    <p className="text-xs text-zana-muted">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showChat && activeTripForChat && (
        <ChatPanel context="trip" contextId={activeTripForChat} onClose={() => setShowChat(false)} />
      )}
    </div>
  );
}
