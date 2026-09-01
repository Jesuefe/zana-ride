'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, MapPin, Navigation, ChevronRight, X } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { useLang } from '../lib/LangContext';
import {
  fetchMyDriverProfile, fetchSearchingTrips, acceptTrip, declineTrip,
  goOnline, goOffline, updateDriverLocation, updateDriverMode,
  fetchPendingDeliveries, acceptDelivery, fetchEarnings,
  DriverProfile, DriverTrip, PendingDelivery,
} from '../lib/api/driver';
import { getCurrentPosition, watchPosition, Coords } from '../lib/location';
import { loadGoogleMaps } from '../lib/mapsLoader';

const TIMEOUT = 20;

// Slide-to-accept component
function SlideToAccept({ label, onAccept, color = '#00A082' }: { label: string; onAccept: () => void; color?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const [offset, setOffset] = useState(0);
  const [accepted, setAccepted] = useState(false);

  const getTrackWidth = () => (trackRef.current?.clientWidth ?? 300) - 64;

  const handleStart = (clientX: number) => {
    isDragging.current = true;
    startX.current = clientX;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging.current) return;
    const max = getTrackWidth();
    const delta = Math.max(0, Math.min(max, clientX - startX.current));
    setOffset(delta);
    if (delta >= max - 4) {
      isDragging.current = false;
      setAccepted(true);
      setTimeout(onAccept, 200);
    }
  };

  const handleEnd = () => {
    if (!accepted) { isDragging.current = false; setOffset(0); }
  };

  return (
    <div
      ref={trackRef}
      className="relative h-14 rounded-full flex items-center px-2 select-none overflow-hidden"
      style={{ background: `${color}22` }}
      onMouseDown={e => { handleStart(e.clientX); }}
      onMouseMove={e => { handleMove(e.clientX); }}
      onMouseUp={handleEnd}
      onTouchStart={e => handleStart(e.touches[0].clientX)}
      onTouchMove={e => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
    >
      <p className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color }}>
        {accepted ? 'Accepted!' : label}
      </p>
      <div
        ref={thumbRef}
        className="w-12 h-12 rounded-full z-10 flex items-center justify-center shadow-md transition-colors"
        style={{ transform: `translateX(${offset}px)`, background: color, transition: offset === 0 ? 'transform 0.3s' : 'none' }}
      >
        <ChevronRight size={22} color="white" />
      </div>
    </div>
  );
}

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
  const [earnings, setEarnings] = useState<{ todayEarnings: number; totalTrips: number; walletBalance: number } | null>(null);
  const [notifications] = useState(3);
  const [showMenu, setShowMenu] = useState(false);
  const seenIds = useRef(new Set<string>());

  // Init map
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!mapRef.current || googleMapRef.current) return;
      const G = (window as any).google.maps;
      googleMapRef.current = new G.Map(mapRef.current, {
        center: { lat: -1.9536, lng: 30.0605 },
        zoom: 15,
        mapId: 'zana_driver_home',
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        zoomControl: false,
      });
    });
  }, []);

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
        if (online) updateDriverLocation(c.lat, c.lng).catch(() => {});
      }
    });
    return stop;
  }, [online]);

  // Poll for ride requests
  useEffect(() => {
    if (!online || driverMode === 'DELIVERIES') return;
    const interval = setInterval(async () => {
      if (incoming) return;
      try {
        const trips = await fetchSearchingTrips();
        const newTrip = trips.find(t => !seenIds.current.has(t.id));
        if (newTrip) { seenIds.current.add(newTrip.id); setIncoming(newTrip); setCountdown(TIMEOUT); }
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

  // Countdown for trip request
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
      const updated = await goOnline();
      setOnline(true);
      setProfile(updated as any);
    } catch {} finally { setLoading(false); }
  };

  const handleAcceptTrip = async () => {
    if (!incoming) return;
    await acceptTrip(incoming.id).catch(() => {});
    setIncoming(null);
    router.push('/trip');
  };

  const handleDeclineTrip = async () => {
    if (incoming) { await declineTrip(incoming.id).catch(() => {}); setIncoming(null); }
  };

  const onlineTimeStr = '0h 0m';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-10 pb-2 flex items-center justify-between">
        <button
          onClick={() => setShowMenu(true)}
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
        <div ref={mapRef} className="w-full h-full" />

        {/* Online status pill */}
        <div className="absolute top-24 left-0 right-0 flex justify-center z-10">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow ${online ? 'bg-white' : 'bg-white'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
            <p className="text-sm font-semibold text-gray-800">
              {online ? dt('You are online') : dt('You are offline')}
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
                <rect x="4" y="9" width="10" height="6" rx="1" fill="#00A082"/>
              </svg>
              <div>
                <p className="text-sm font-bold text-gray-900">85%</p>
                <p className="text-[9px] text-gray-400">Battery</p>
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
                <p className="text-sm font-bold text-gray-900">Good</p>
                <p className="text-[9px] text-gray-400">Vehicle</p>
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
              Details <ChevronRight size={12} />
            </button>
          </div>

          {/* Go Online / Offline — Slide button */}
          {online ? (
            <button
              onClick={handleToggle}
              disabled={loading}
              className="w-full bg-amber-400 rounded-2xl py-4 flex items-center justify-between px-5 disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.5"/>
                  <path d="M12 7v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="text-center flex-1">
                <p className="text-gray-900 font-black text-base">
                  {dt('Go Offline')}
                </p>
                <p className="text-gray-700 text-xs">Go offline →</p>
              </div>
              <ChevronRight size={18} className="text-gray-700" />
            </button>
          ) : (
            <SlideToAccept
              label={loading ? 'Going online...' : `Slide to go online`}
              onAccept={() => setShowMode(true)}
              color="#00A082"
            />
          )}

          {/* Status message */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
            <p className="text-xs text-gray-500">
              {online ? "You're online and ready to receive requests" : "Go online to start receiving ride requests"}
            </p>
          </div>

          {/* Today's overview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900">Today's Overview</p>
              <button onClick={() => router.push('/earnings')} className="text-xs text-zana-primary font-semibold flex items-center gap-0.5">
                See all <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                {
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#00A082" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="#E6A82E" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="#00A082" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="#E6A82E" strokeWidth="2"/></svg>,
                  bg: '#E3F5F1', value: earnings?.totalTrips ?? 0, label: 'Completed'
                },
                {
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#E6A82E" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="#E6A82E" strokeWidth="2" strokeLinecap="round"/></svg>,
                  bg: '#FBF1DD', value: onlineTimeStr, label: 'Online time'
                },
                {
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="#4F9EF8" strokeWidth="2"/><path d="M2 9h20" stroke="#4F9EF8" strokeWidth="2"/></svg>,
                  bg: '#E8F0FE', value: earnings ? `${(earnings.todayEarnings ?? 0).toLocaleString()}` : '0', label: 'RWF Earnings', small: true
                },
                {
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><polygon points="12,2 15,8.5 22,9.5 17,14.2 18.2,21 12,17.7 5.8,21 7,14.2 2,9.5 9,8.5" stroke="#9B59B6" strokeWidth="2" fill="none"/></svg>,
                  bg: '#F3E8FF', value: (profile?.rating ?? 0).toFixed(1), label: 'Rating'
                },
              ].map(({ icon, bg, value, label, small }, i) => (
                <div key={i} className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-sm">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: bg }}>
                    {icon}
                  </div>
                  <p className={`font-black text-gray-900 ${small ? 'text-xs' : 'text-base'}`}>{value}</p>
                  <p className="text-[9px] text-gray-400 text-center leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: '📈', label: 'Earnings', route: '/earnings' },
              { icon: '🎁', label: 'Incentives', route: '/earnings' },
              { icon: '🎧', label: 'Help', route: '/profile' },
              { icon: '👥', label: 'Refer', route: '/profile' },
            ].map(({ icon, label, route }) => (
              <button key={label} onClick={() => router.push(route)}
                className="flex flex-col items-center gap-1.5 py-3">
                <span className="text-xl">{icon}</span>
                <span className="text-[10px] text-gray-500 font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode selector sheet */}
      {showMode && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="w-full bg-white rounded-t-3xl p-6">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-black text-gray-900 mb-1">What do you want to receive?</h2>
            <p className="text-sm text-gray-400 mb-5">Choose your mode for this session.</p>
            <div className="space-y-3">
              {([
                { mode: 'RIDES', label: 'Rides only', sub: 'Passenger pickup requests' },
                { mode: 'DELIVERIES', label: 'Deliveries only', sub: 'Package delivery requests' },
                { mode: 'BOTH', label: 'Both', sub: 'Rides and deliveries' },
              ] as const).map(({ mode, label, sub }) => (
                <button key={mode} onClick={() => handleModeSelect(mode)}
                  className="w-full flex items-center gap-4 bg-gray-50 hover:bg-zana-primary-light rounded-2xl px-4 py-4 text-left transition-colors">
                  <div className="w-5 h-5 rounded-full border-2 border-zana-primary flex items-center justify-center shrink-0">
                    {driverMode === mode && <div className="w-2.5 h-2.5 rounded-full bg-zana-primary" />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{label}</p>
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
        <div className="fixed inset-x-4 bottom-28 z-40">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Countdown bar */}
            <div className="h-1 bg-gray-100">
              <div
                className="h-full bg-zana-primary transition-all duration-1000"
                style={{ width: `${(countdown / TIMEOUT) * 100}%` }}
              />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-zana-primary-light flex items-center justify-center">
                    <MapPin size={14} className="text-zana-primary" />
                  </div>
                  <p className="text-xs font-bold text-zana-primary uppercase tracking-wide">New ride request</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <p className="text-sm font-black text-gray-700">{countdown}</p>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-zana-primary mt-1.5 shrink-0" />
                  <p className="text-sm text-gray-700 truncate">{incoming.pickupAddress}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <p className="text-sm text-gray-700 truncate">{incoming.destinationAddress}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-black text-zana-primary">{(incoming.estimatedFare ?? 0).toLocaleString()} RWF</p>
                  <p className="text-xs text-gray-400">{incoming.serviceType} · {(incoming as any).paymentMethod ?? 'Cash'}</p>
                </div>
                <button onClick={handleDeclineTrip} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              <SlideToAccept label="Slide to accept ride" onAccept={handleAcceptTrip} color="#00A082" />
            </div>
          </div>
        </div>
      )}

      {/* Incoming delivery */}
      {incomingDelivery && !incoming && (
        <div className="fixed inset-x-4 bottom-28 z-40">
          <div className="bg-white rounded-3xl shadow-2xl p-4">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-3">Delivery Request</p>
            <p className="font-bold text-gray-900">{incomingDelivery.itemDescription}</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">{incomingDelivery.pickupAddress}</p>
            <div className="flex items-center justify-between mb-4">
              <p className="text-2xl font-black text-zana-primary">{(incomingDelivery.fee ?? 0).toLocaleString()} RWF</p>
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
        </div>
      )}

      {/* Side menu */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 bg-white h-full shadow-2xl p-6">
            <div className="flex items-center justify-between mb-8">
              <p className="font-black text-lg text-gray-900">Menu</p>
              <button onClick={() => setShowMenu(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {[
                { label: 'Home', route: '/' },
                { label: 'Deliveries', route: '/deliveries' },
                { label: 'Earnings', route: '/earnings' },
                { label: 'Profile', route: '/profile' },
              ].map(({ label, route }) => (
                <button key={label} onClick={() => { router.push(route); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold text-gray-700">
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setShowMenu(false)} />
        </div>
      )}
    </div>
  );
}
