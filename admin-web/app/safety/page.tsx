'use client';

import { useEffect, useRef, useState } from 'react';
import { Shield, Phone, MapPin, User, Clock, LogOut, RefreshCw, AlertTriangle, X, Navigation } from 'lucide-react';
import { api, getToken, clearToken, setToken } from '../../lib/api/client';

const MAPS_KEY = 'AIzaSyD4o-fXIpmGozrClaP1niC407cgRCrzSTI';

type LiveTrip = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  driverName: string;
  driverPhone: string;
  vehicle: string;
  plate: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupLat: number;
  pickupLng: number;
  destinationLat: number;
  destinationLng: number;
  driverLat: number | null;
  driverLng: number | null;
  status: string;
  estimatedFare: number;
  requestedAt: string;
  sosReported?: boolean;
};

function loadMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).__mapsReady) return Promise.resolve();
  return new Promise(resolve => {
    (window as any).__safetyMapCb = () => { (window as any).__mapsReady = true; resolve(); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=__safetyMapCb&v=weekly`;
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  });
}

function TripMap({ trip }: { trip: LiveTrip }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const driverMarker = useRef<any>(null);
  const [eta1, setEta1] = useState<string | null>(null);
  const [eta2, setEta2] = useState<string | null>(null);

  useEffect(() => {
    loadMaps().then(() => {
      if (!ref.current) return;
      const center = { lat: trip.pickupLat, lng: trip.pickupLng };
      mapRef.current = new (window as any).google.maps.Map(ref.current, {
        center, zoom: 13,
        mapId: 'zana_safety_map',
        disableDefaultUI: true,
        zoomControl: true,
      });

      // Pickup marker
      const pickupDiv = document.createElement('div');
      pickupDiv.innerHTML = '<div style="width:14px;height:14px;border-radius:50%;background:#00A082;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>';
      new (window as any).google.maps.marker.AdvancedMarkerElement({ position: { lat: trip.pickupLat, lng: trip.pickupLng }, map: mapRef.current, content: pickupDiv });

      // Destination marker
      const destDiv = document.createElement('div');
      destDiv.innerHTML = '<div style="width:14px;height:14px;border-radius:50%;background:#E6A82E;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>';
      new (window as any).google.maps.marker.AdvancedMarkerElement({ position: { lat: trip.destinationLat, lng: trip.destinationLng }, map: mapRef.current, content: destDiv });

      // Route line
      new (window as any).google.maps.Polyline({
        path: [{ lat: trip.pickupLat, lng: trip.pickupLng }, { lat: trip.destinationLat, lng: trip.destinationLng }],
        geodesic: true, strokeColor: '#00A082', strokeOpacity: 0.4, strokeWeight: 2, map: mapRef.current,
      });

      // Compute ETAs
      const svc = new (window as any).google.maps.DistanceMatrixService();
      if (trip.driverLat && trip.driverLng) {
        svc.getDistanceMatrix({
          origins: [{ lat: trip.driverLat, lng: trip.driverLng }],
          destinations: [{ lat: trip.pickupLat, lng: trip.pickupLng }],
          travelMode: (window as any).google.maps.TravelMode.DRIVING,
        }, (res: any) => {
          const dur = res?.rows[0]?.elements[0]?.duration?.text;
          if (dur) setEta1(dur);
        });
      }
      svc.getDistanceMatrix({
        origins: [{ lat: trip.pickupLat, lng: trip.pickupLng }],
        destinations: [{ lat: trip.destinationLat, lng: trip.destinationLng }],
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
      }, (res: any) => {
        const dur = res?.rows[0]?.elements[0]?.duration?.text;
        if (dur) setEta2(dur);
      });
    });
  }, []);

  // Update driver marker position
  useEffect(() => {
    if (!mapRef.current || !trip.driverLat || !trip.driverLng) return;
    const pos = { lat: trip.driverLat, lng: trip.driverLng };
    if (!driverMarker.current) {
      const div = document.createElement('div');
      div.innerHTML = '<div style="width:18px;height:18px;border-radius:50%;background:#E53E3E;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"><div style="width:6px;height:6px;border-radius:50%;background:white;margin:3px auto"></div></div>';
      driverMarker.current = new (window as any).google.maps.marker.AdvancedMarkerElement({ position: pos, map: mapRef.current, content: div });
    } else {
      driverMarker.current.position = pos;
    }
  }, [trip.driverLat, trip.driverLng]);

  return (
    <div>
      <div ref={ref} style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden' }} />
      <div className="flex gap-3 mt-2 text-xs">
        {eta1 && (
          <div className="flex items-center gap-1 bg-red-900/40 text-red-300 px-2 py-1 rounded-lg">
            <Navigation size={10} /> Driver → Pickup: <strong>{eta1}</strong>
          </div>
        )}
        {eta2 && (
          <div className="flex items-center gap-1 bg-gray-800 text-gray-300 px-2 py-1 rounded-lg">
            <MapPin size={10} /> Pickup → Dest: <strong>{eta2}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SafetyDashboard() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [logging, setLogging] = useState(false);
  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [focusTrip, setFocusTrip] = useState<LiveTrip | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (getToken()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadData();
    const interval = setInterval(loadData, 8000); // refresh every 8s
    return () => clearInterval(interval);
  }, [authed]);

  const loadData = async () => {
    try {
      const data = await api.get<any[]>('/admin/trips');
      const active = data
        .filter((t: any) => !['RIDE_COMPLETED','CUSTOMER_CANCELLED','DRIVER_CANCELLED','NO_DRIVER_FOUND'].includes(t.status))
        .map((t: any) => ({
          id: t.id,
          customerId: t.customerId,
          customerName: `${t.customer?.firstName ?? ''} ${t.customer?.lastName ?? ''}`.trim() || 'Customer',
          customerPhone: t.customer?.phone ?? '',
          driverName: `${t.driver?.user?.firstName ?? ''} ${t.driver?.user?.lastName ?? ''}`.trim() || 'Driver',
          driverPhone: t.driver?.user?.phone ?? '',
          vehicle: t.driver?.vehicle ?? '',
          plate: t.driver?.plate ?? '',
          pickupAddress: t.pickupAddress,
          destinationAddress: t.destinationAddress,
          pickupLat: t.pickupLat,
          pickupLng: t.pickupLng,
          destinationLat: t.destinationLat,
          destinationLng: t.destinationLng,
          driverLat: t.driver?.lastLat ?? null,
          driverLng: t.driver?.lastLng ?? null,
          status: t.status,
          estimatedFare: t.estimatedFare,
          requestedAt: t.requestedAt,
        }));
      setTrips(active);
      // Update focused trip if open
      if (focusTrip) {
        const updated = active.find(t => t.id === focusTrip.id);
        if (updated) setFocusTrip(updated);
      }
      setLastRefresh(new Date());
    } catch {}
  };

  const handleLogin = async () => {
    setLogging(true); setLoginError('');
    try {
      const res = await api.post<{ token: string; user: any }>('/auth/login', { identifier: email, password });
      if (res.user.role !== 'ADMIN') { setLoginError('Admin accounts only.'); return; }
      setToken(res.token);
      setAuthed(true);
    } catch { setLoginError('Invalid credentials.'); }
    finally { setLogging(false); }
  };

  const statusColor = (s: string) => {
    if (s === 'RIDE_IN_PROGRESS') return 'bg-green-500';
    if (s.includes('ARRIVED')) return 'bg-blue-500';
    if (s.includes('ASSIGNED') || s.includes('EN_ROUTE')) return 'bg-amber-500';
    return 'bg-gray-500';
  };

  if (!authed) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center">
            <Shield size={24} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-xl">Zana Safety</p>
            <p className="text-xs text-gray-500">Emergency Response Center</p>
          </div>
        </div>
        <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none border border-gray-700 focus:border-red-500"
            placeholder="admin@zana.rw" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none border border-gray-700 focus:border-red-500"
            placeholder="Password" />
          {loginError && <p className="text-xs text-red-400">{loginError}</p>}
          <button onClick={handleLogin} disabled={logging}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40">
            {logging ? 'Signing in…' : 'Access Safety Center'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Safety Center</p>
            <p className="text-[10px] text-gray-500">
              {trips.length} active · {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : '…'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
            <RefreshCw size={13} className={loading ? 'animate-spin text-green-400' : 'text-gray-400'} />
          </button>
          <button onClick={() => { clearToken(); setAuthed(false); }}
            className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
            <LogOut size={13} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 p-3">
        {[
          { label: 'Active rides', value: trips.length, color: 'text-green-400' },
          { label: 'In progress', value: trips.filter(t => t.status === 'RIDE_IN_PROGRESS').length, color: 'text-blue-400' },
          { label: 'Picking up', value: trips.filter(t => t.status.includes('ASSIGNED') || t.status.includes('ARRIVED')).length, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Trip list */}
      <div className="px-3 pb-24 space-y-2">
        {trips.length === 0 && (
          <div className="text-center py-16">
            <Shield size={36} className="text-gray-800 mx-auto mb-3" />
            <p className="text-sm text-gray-600">No active rides right now</p>
          </div>
        )}
        {trips.map(t => (
          <button key={t.id} onClick={() => setFocusTrip(t)}
            className="w-full text-left bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-600 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusColor(t.status)}`} />
                <span className="text-xs text-gray-400">{t.status.replace(/_/g, ' ')}</span>
              </div>
              <span className="text-xs font-bold text-zana-primary">{t.estimatedFare.toLocaleString()} RWF</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <User size={12} className="text-gray-600 shrink-0" />
              <span className="text-sm font-semibold truncate">{t.customerName}</span>
              <span className="text-gray-600 text-xs">{t.customerPhone}</span>
            </div>
            <div className="flex items-start gap-1.5 mb-0.5">
              <MapPin size={10} className="text-green-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-gray-500 truncate">{t.pickupAddress}</p>
            </div>
            <div className="flex items-start gap-1.5">
              <MapPin size={10} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-gray-500 truncate">{t.destinationAddress}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Emergency button */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3">
        <a href="tel:112"
          className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 rounded-xl text-sm">
          <Phone size={16} /> Emergency — 112
        </a>
      </div>

      {/* Trip detail panel */}
      {focusTrip && (
        <div className="fixed inset-0 z-50 bg-gray-950 overflow-auto">
          <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${statusColor(focusTrip.status)}`} />
              <p className="font-bold text-sm">{focusTrip.status.replace(/_/g, ' ')}</p>
            </div>
            <button onClick={() => setFocusTrip(null)} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Map with live driver position */}
            <TripMap trip={focusTrip} />

            {/* Customer */}
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 font-semibold uppercase mb-2">Customer</p>
              <p className="font-semibold text-white">{focusTrip.customerName}</p>
              <a href={`tel:${focusTrip.customerPhone}`}
                className="flex items-center gap-1.5 text-green-400 text-sm mt-1">
                <Phone size={13} /> {focusTrip.customerPhone}
              </a>
            </div>

            {/* Driver */}
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 font-semibold uppercase mb-2">Driver</p>
              <p className="font-semibold text-white">{focusTrip.driverName}</p>
              <p className="text-xs text-gray-500">{focusTrip.vehicle} · {focusTrip.plate}</p>
              {focusTrip.driverPhone && (
                <a href={`tel:${focusTrip.driverPhone}`}
                  className="flex items-center gap-1.5 text-green-400 text-sm mt-1">
                  <Phone size={13} /> {focusTrip.driverPhone}
                </a>
              )}
            </div>

            {/* Route */}
            <div className="bg-gray-900 rounded-xl p-4 space-y-2">
              <p className="text-[10px] text-gray-500 font-semibold uppercase mb-2">Route</p>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0" />
                <p className="text-sm text-gray-300">{focusTrip.pickupAddress}</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                <p className="text-sm text-gray-300">{focusTrip.destinationAddress}</p>
              </div>
            </div>

            {/* Fare + time */}
            <div className="bg-gray-900 rounded-xl p-4 flex justify-between">
              <div>
                <p className="text-[10px] text-gray-500">Fare</p>
                <p className="text-lg font-bold text-zana-primary">{focusTrip.estimatedFare.toLocaleString()} RWF</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500">Started</p>
                <p className="text-sm text-gray-300">{new Date(focusTrip.requestedAt).toLocaleTimeString()}</p>
              </div>
            </div>

            {/* Emergency actions */}
            <div className="space-y-2">
              <a href={`tel:${focusTrip.customerPhone}`}
                className="flex items-center justify-center gap-2 bg-green-700 text-white font-semibold py-3 rounded-xl text-sm">
                <Phone size={15} /> Call Customer
              </a>
              {focusTrip.driverPhone && (
                <a href={`tel:${focusTrip.driverPhone}`}
                  className="flex items-center justify-center gap-2 bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm">
                  <Phone size={15} /> Call Driver
                </a>
              )}
              <a href="tel:112"
                className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 rounded-xl text-sm">
                <AlertTriangle size={15} /> Emergency — 112
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
