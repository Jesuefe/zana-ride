'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LogOut, Wallet, Navigation, Truck, LayoutGrid, X, Check,
  User, MapPin, Clock, ChevronRight, Package,
} from 'lucide-react';
import ChatPanel from '../components/ChatPanel';
import LanguageSelector from '../components/LanguageSelector';
import { useLang } from '../lib/LangContext';
import {
  fetchMyDriverProfile, fetchSearchingTrips, acceptTrip, declineTrip,
  goOnline, goOffline, updateDriverLocation, updateDriverMode,
  fetchPendingDeliveries, acceptDelivery,
  DriverProfile, DriverTrip, PendingDelivery,
} from '../lib/api/driver';
import { getCurrentPosition, watchPosition, Coords } from '../lib/location';
import { clearToken } from '../lib/api/client';
import { loadGoogleMaps } from '../lib/mapsLoader';

const TIMEOUT = 15;

export default function DriverHome() {
  const router = useRouter();
  const { dt } = useLang();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [online, setOnline] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [incoming, setIncoming] = useState<DriverTrip | null>(null);
  const [countdown, setCountdown] = useState(TIMEOUT);
  const [loading, setLoading] = useState(false);
  const [showMode, setShowMode] = useState(false);
  const [driverMode, setDriverMode] = useState<'RIDES' | 'DELIVERIES' | 'BOTH'>('BOTH');
  const [incomingDelivery, setIncomingDelivery] = useState<PendingDelivery | null>(null);
  const seenIds = useRef(new Set<string>());

  // Init map
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!mapRef.current) return;
      const G = (window as any).google.maps;
      googleMapRef.current = new G.Map(mapRef.current, {
        center: { lat: -1.9536, lng: 30.0605 },
        zoom: 15,
        mapId: 'zana_driver_home',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
    });
  }, []);

  // Update marker when coords change
  useEffect(() => {
    if (!coords || !googleMapRef.current) return;
    const pos = { lat: coords.lat, lng: coords.lng };
    const G = (window as any).google?.maps;
    if (!G) return;

    googleMapRef.current.setCenter(pos);

    if (!markerRef.current) {
      // Create driver marker
      const div = document.createElement('div');
      div.innerHTML = `<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="18" r="16" fill="#00A082" stroke="white" stroke-width="3"/>
        <circle cx="18" cy="18" r="6" fill="white"/>
      </svg>`;
      try {
        markerRef.current = new G.marker.AdvancedMarkerElement({
          position: pos, map: googleMapRef.current, content: div,
        });
      } catch {
        markerRef.current = new G.Marker({ position: pos, map: googleMapRef.current });
      }
    } else {
      try { markerRef.current.position = pos; }
      catch { markerRef.current.setPosition(pos); }
    }
  }, [coords?.lat, coords?.lng]);

  useEffect(() => {
    fetchMyDriverProfile().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    const stop = watchPosition(c => {
      if (c) {
        setCoords(c);
        if (online) updateDriverLocation(c.lat, c.lng).catch(() => {});
      }
    });
    getCurrentPosition().then(c => { if (c) setCoords(c); }).catch(() => {});
    return stop;
  }, [online]);

  // Poll for ride requests
  useEffect(() => {
    if (!online) return;
    const interval = setInterval(async () => {
      if (driverMode === 'DELIVERIES') return;
      try {
        const trips = await fetchSearchingTrips();
        const newTrip = trips.find(t => !seenIds.current.has(t.id));
        if (newTrip && !incoming) {
          seenIds.current.add(newTrip.id);
          setIncoming(newTrip);
          setCountdown(TIMEOUT);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [online, incoming, driverMode]);

  // Poll for deliveries
  useEffect(() => {
    if (!online || !coords || driverMode === 'RIDES') return;
    const interval = setInterval(async () => {
      if (incoming || incomingDelivery) return;
      try {
        const dels = await fetchPendingDeliveries(coords.lat, coords.lng);
        const nd = dels.find(d => !seenIds.current.has(d.id));
        if (nd) { seenIds.current.add(nd.id); setIncomingDelivery(nd); }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [online, coords, incoming, incomingDelivery, driverMode]);

  // Countdown timer
  useEffect(() => {
    if (!incoming) return;
    if (countdown <= 0) { setIncoming(null); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [incoming, countdown]);

  const handleToggle = async () => {
    if (online) {
      setLoading(true);
      await goOffline().catch(() => {});
      setOnline(false);
      setLoading(false);
    } else {
      setShowMode(true);
    }
  };

  const handleModeSelect = async (mode: typeof driverMode) => {
    setDriverMode(mode);
    setShowMode(false);
    setLoading(true);
    try {
      await updateDriverMode(mode);
      await goOnline();
      setOnline(true);
    } catch {} finally { setLoading(false); }
  };

  const handleAccept = async () => {
    if (!incoming) return;
    await acceptTrip(incoming.id).catch(() => {});
    setIncoming(null);
    router.push('/trip');
  };

  const handleDecline = async () => {
    if (incoming) { await declineTrip(incoming.id).catch(() => {}); setIncoming(null); }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900">
      {/* Map fills most of screen */}
      <div ref={mapRef} className="flex-1 relative">
        {/* Top bar overlaid on map */}
        <div className="absolute top-0 left-0 right-0 z-10 px-3 pt-10 pb-3 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">{profile?.user?.firstName ?? 'Driver'}</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <p className="text-white/70 text-[10px]">{online ? `Online · ${driverMode}` : 'Offline'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <Link href="/earnings" className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet size={15} className="text-white" />
              </Link>
              <Link href="/profile" className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <User size={15} className="text-white" />
              </Link>
              <button onClick={() => { clearToken(); router.push('/login'); }}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <LogOut size={15} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Current location label */}
        {coords && (
          <div className="absolute bottom-4 left-3 right-3 z-10">
            <div className="bg-white rounded-xl px-3 py-2 shadow-lg flex items-center gap-2">
              <MapPin size={14} className="text-zana-primary shrink-0" />
              <p className="text-xs text-gray-600 truncate">
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="bg-white shadow-2xl rounded-t-2xl px-4 pt-4 pb-6">
        {/* Vehicle info */}
        {profile && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-zana-primary-light flex items-center justify-center">
              <Navigation size={18} className="text-zana-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{profile.vehicle} · {profile.plate}</p>
              <p className="text-xs text-gray-400">Rating: {profile.rating?.toFixed(1) ?? '0.0'} / 5.0</p>
            </div>
            <Link href="/deliveries"
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg">
              <Package size={13} /> Browse
            </Link>
          </div>
        )}

        {/* Go Online / Offline button */}
        <button onClick={handleToggle} disabled={loading}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-colors ${
            online ? 'bg-amber-400 text-gray-900' : 'bg-zana-primary text-white'
          } disabled:opacity-50`}>
          {loading ? 'Please wait...' : online ? dt('Go Offline') : dt('Go Online')}
        </button>

        {!online && (
          <p className="text-center text-xs text-gray-400 mt-2">Go online to receive ride and delivery requests</p>
        )}
        {online && (
          <p className="text-center text-xs text-green-600 mt-2 font-medium">Waiting for requests...</p>
        )}
      </div>

      {/* Mode selector */}
      {showMode && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="w-full bg-white rounded-t-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">What do you want to receive?</h2>
            <p className="text-sm text-gray-400 mb-5">You can change this from your status badge.</p>
            <div className="space-y-3">
              {([
                { mode: 'RIDES', icon: Navigation, label: 'Rides only', sub: 'Passenger requests only' },
                { mode: 'DELIVERIES', icon: Truck, label: 'Deliveries only', sub: 'Package delivery only' },
                { mode: 'BOTH', icon: LayoutGrid, label: 'Both', sub: 'Rides and deliveries' },
              ] as const).map(({ mode, icon: Icon, label, sub }) => (
                <button key={mode} onClick={() => handleModeSelect(mode)}
                  className="w-full flex items-center gap-4 bg-gray-50 hover:bg-zana-primary-light rounded-xl px-4 py-3.5 text-left">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                    <Icon size={18} className="text-zana-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{label}</p>
                    <p className="text-xs text-gray-500">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowMode(false)} className="w-full mt-4 text-sm text-gray-400 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Incoming ride request */}
      {incoming && (
        <div className="fixed inset-x-4 bottom-32 z-40 bg-white rounded-2xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-zana-primary uppercase tracking-wide">New ride request</p>
            <div className="w-8 h-8 rounded-full bg-zana-primary-light flex items-center justify-center">
              <p className="text-sm font-bold text-zana-primary">{countdown}</p>
            </div>
          </div>
          <div className="mb-1">
            <div className="flex items-start gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-zana-primary mt-1.5 shrink-0" />
              <p className="text-sm text-gray-700 truncate">{incoming.pickupAddress}</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
              <p className="text-sm text-gray-700 truncate">{incoming.destinationAddress}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-4 mt-2">
            <p className="text-lg font-bold text-zana-primary">{incoming.estimatedFare?.toLocaleString()} RWF</p>
            <p className="text-xs text-gray-400">{incoming.serviceType}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleDecline}
              className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm">
              Decline
            </button>
            <button onClick={handleAccept}
              className="flex-1 bg-zana-primary text-white font-bold py-3 rounded-xl text-sm">
              Accept
            </button>
          </div>
        </div>
      )}

      {/* Incoming delivery */}
      {incomingDelivery && !incoming && (
        <div className="fixed inset-x-4 bottom-32 z-40 bg-white rounded-2xl shadow-2xl p-4">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">Delivery Request</p>
          <p className="font-semibold text-gray-900">{incomingDelivery.itemDescription}</p>
          <p className="text-xs text-gray-400 mt-0.5">{incomingDelivery.pickupAddress}</p>
          <div className="flex items-center justify-between mt-2 mb-4">
            <p className="text-lg font-bold text-zana-primary">{incomingDelivery.fee?.toLocaleString()} RWF</p>
            <p className="text-xs text-gray-400">{incomingDelivery.distanceKm} km away</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIncomingDelivery(null)}
              className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm">
              Decline
            </button>
            <button onClick={async () => { await acceptDelivery(incomingDelivery.id); setIncomingDelivery(null); }}
              className="flex-1 bg-zana-primary text-white font-bold py-3 rounded-xl text-sm">
              Accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
