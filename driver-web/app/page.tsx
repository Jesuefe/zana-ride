'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, MapPin, Wallet, Star, Navigation } from 'lucide-react';
import {
  fetchMyDriverProfile,
  fetchMyActiveTrip,
  fetchSearchingTrips,
  acceptTrip,
  declineTrip,
  goOnline,
  goOffline,
  updateDriverLocation,
  DriverProfile,
  DriverTrip,
} from '../lib/api/driver';
import { getCurrentPosition, watchPosition, haversineKm, Coords } from '../lib/location';
import { clearToken } from '../lib/api/client';

const REQUEST_TIMEOUT_SECONDS = 15;

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [online, setOnline] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [incoming, setIncoming] = useState<DriverTrip | null>(null);
  const [countdown, setCountdown] = useState(REQUEST_TIMEOUT_SECONDS);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const seenTripIds = useRef<Set<string>>(new Set());

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
        await goOnline();
        setOnline(true);
      }
    } catch {
      // leave state unchanged on failure
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

  const handleLogout = () => {
    clearToken();
    router.replace('/login');
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
            <button onClick={() => router.push('/earnings')} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white">
              <Wallet size={16} />
            </button>
            <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={loadingToggle}
          className={`w-full mt-5 py-4 rounded-2xl font-bold text-center transition-colors ${
            online ? 'bg-zana-secondary text-gray-900' : 'bg-white/15 text-white'
          }`}
        >
          {loadingToggle ? '…' : online ? "You're Online" : 'Go Online'}
        </button>
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
    </div>
  );
}
