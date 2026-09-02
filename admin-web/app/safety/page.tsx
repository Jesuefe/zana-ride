'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, Phone, MapPin, LogOut, RefreshCw, AlertTriangle, X, CheckCircle, Bell } from 'lucide-react';
import { api, getToken, clearToken, setToken } from '../../lib/api/client';

const MAPS_KEY = 'AIzaSyD4o-fXIpmGozrClaP1niC407cgRCrzSTI';

type SosAlert = {
  id: string;
  tripId?: string | null;
  lat?: number | null;
  lng?: number | null;
  status: string;
  createdAt: string;
  acknowledgedAt?: string | null;
  customer: { firstName: string | null; lastName: string | null; phone: string };
  trip?: {
    pickupAddress: string;
    destinationAddress: string;
    pickupLat: number;
    pickupLng: number;
    estimatedFare: number;
    driver?: {
      vehicle: string;
      plate: string;
      lastLat?: number | null;
      lastLng?: number | null;
      user: { firstName: string | null; lastName: string | null; phone: string };
    } | null;
  } | null;
};

function loadMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  return new Promise(resolve => {
    if ((window as any).__safetyMapPromise) {
      (window as any).__safetyMapPromise.then(resolve);
      return;
    }
    const p = new Promise<void>(res => {
      (window as any).__safetyMapCb = () => res();
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=marker&callback=__safetyMapCb&v=weekly`;
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    });
    (window as any).__safetyMapPromise = p;
    p.then(resolve);
  });
}

function SosMap({ alert }: { alert: SosAlert }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lat = alert.lat ?? alert.trip?.pickupLat;
    const lng = alert.lng ?? alert.trip?.pickupLng;
    if (!lat || !lng) return;

    loadMaps().then(() => {
      if (!ref.current) return;
      const G = (window as any).google.maps;
      const map = new G.Map(ref.current, {
        center: { lat, lng }, zoom: 15,
        mapId: 'zana_sos_map',
        disableDefaultUI: true,
        zoomControl: true,
      });

      // Customer location marker (red pulse)
      const div = document.createElement('div');
      div.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:#E53E3E;border:3px solid white;box-shadow:0 0 0 4px rgba(229,62,62,0.3);animation:pulse 1s infinite"></div>`;
      new G.marker.AdvancedMarkerElement({ position: { lat, lng }, map, content: div });

      // Driver marker if available
      const dLat = alert.trip?.driver?.lastLat;
      const dLng = alert.trip?.driver?.lastLng;
      if (dLat && dLng) {
        const dDiv = document.createElement('div');
        dDiv.innerHTML = '<div style="width:14px;height:14px;border-radius:50%;background:#3182CE;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>';
        new G.marker.AdvancedMarkerElement({ position: { lat: dLat, lng: dLng }, map, content: dDiv });
      }
    });
  }, []);

  const lat = alert.lat ?? alert.trip?.pickupLat;
  const lng = alert.lng ?? alert.trip?.pickupLng;
  if (!lat || !lng) return <div className="bg-gray-800 rounded-xl h-40 flex items-center justify-center text-gray-600 text-sm">No location data</div>;

  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 0 4px rgba(229,62,62,0.3)} 50%{box-shadow:0 0 0 10px rgba(229,62,62,0)} }`}</style>
      <div ref={ref} style={{ width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden' }} />
      <a
        href={`https://maps.google.com/?q=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-blue-400 mt-1 flex items-center gap-1"
      >
        <MapPin size={10} /> Open in Google Maps
      </a>
    </>
  );
}

function AlarmSound({ active }: { active: boolean }) {
  const ctx = useRef<AudioContext | null>(null);
  const interval = useRef<any>(null);

  const beep = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!ctx.current) ctx.current = new AudioContext();
      const osc = ctx.current.createOscillator();
      const gain = ctx.current.createGain();
      osc.connect(gain); gain.connect(ctx.current.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.current.currentTime + 0.4);
      osc.start(ctx.current.currentTime);
      osc.stop(ctx.current.currentTime + 0.4);
    } catch {}
  }, []);

  useEffect(() => {
    if (active) {
      beep();
      interval.current = setInterval(beep, 1200);
    } else {
      clearInterval(interval.current);
    }
    return () => clearInterval(interval.current);
  }, [active, beep]);

  return null;
}

export default function SafetyDashboard() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [logging, setLogging] = useState(false);
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [focused, setFocused] = useState<SosAlert | null>(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [lastCount, setLastCount] = useState(0);
  const [acknowledged, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) setAuthed(true);
  }, []);

  const poll = useCallback(async () => {
    try {
      const data = await api.get<SosAlert[]>('/sos/active');
      setAlerts(data);
      // New alert arrived — sound alarm
      if (data.length > lastCount && lastCount >= 0) {
        setAlarmActive(true);
        // Auto-focus the newest alert
        if (data[0]) setFocused(data[0]);
      }
      if (data.length === 0) setAlarmActive(false);
      setLastCount(data.length);
    } catch {}
  }, [lastCount]);

  useEffect(() => {
    if (!authed) return;
    poll();
    const interval = setInterval(poll, 3000); // poll every 3s
    return () => clearInterval(interval);
  }, [authed, poll]);

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

  const acknowledge = async (id: string) => {
    setAcknowledging(id);
    try {
      await api.patch(`/sos/${id}/acknowledge`);
      setAlarmActive(false);
      await poll();
    } catch {}
    finally { setAcknowledging(null); }
  };

  const resolve = async (id: string) => {
    try {
      await api.patch(`/sos/${id}/resolve`);
      setFocused(null);
      await poll();
    } catch {}
  };

  if (!authed) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <style>{`@keyframes alertPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
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
            className="w-full bg-red-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40">
            {logging ? 'Signing in…' : 'Access Safety Center'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <style>{`
        @keyframes alertPulse { 0%,100%{background:rgba(229,62,62,0.15)} 50%{background:rgba(229,62,62,0.35)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 4px rgba(229,62,62,0.3)} 50%{box-shadow:0 0 0 12px rgba(229,62,62,0)} }
      `}</style>

      <AlarmSound active={alarmActive} />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Zana Safety Center</p>
            <p className="text-[10px] text-gray-500">Polling every 3s</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alarmActive && (
            <button onClick={() => setAlarmActive(false)}
              className="flex items-center gap-1 bg-red-700 text-white text-xs px-2 py-1 rounded-lg animate-pulse">
              <Bell size={12} /> Mute alarm
            </button>
          )}
          <button onClick={() => { clearToken(); setAuthed(false); }}
            className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
            <LogOut size={13} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Standby state */}
      {alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
          <div className="w-20 h-20 rounded-full bg-green-900/30 flex items-center justify-center mb-4">
            <Shield size={36} className="text-green-500" />
          </div>
          <p className="text-lg font-bold text-green-400">All Clear</p>
          <p className="text-sm text-gray-600 mt-1">No active SOS alerts</p>
          <p className="text-xs text-gray-700 mt-4">This page will sound an alarm when a passenger triggers SOS</p>
        </div>
      )}

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <p className="text-sm font-bold text-red-400">{alerts.length} ACTIVE SOS ALERT{alerts.length > 1 ? 'S' : ''}</p>
          </div>
          {alerts.map(alert => (
            <button key={alert.id} onClick={() => setFocused(alert)}
              className="w-full text-left rounded-2xl p-4 border-2 border-red-600"
              style={{ animation: 'alertPulse 1.5s infinite' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  <span className="font-bold text-red-400 text-sm">SOS ALERT</span>
                </div>
                <span className="text-[10px] text-gray-500">{new Date(alert.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="font-semibold text-white">{alert.customer.firstName} {alert.customer.lastName}</p>
              <p className="text-sm text-gray-400">{alert.customer.phone}</p>
              {alert.trip && <p className="text-xs text-gray-600 mt-1 truncate">{alert.trip.pickupAddress}</p>}
              <p className="text-xs text-red-400 mt-2 font-semibold">Tap to respond →</p>
            </button>
          ))}
        </div>
      )}

      {/* Emergency line always at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3">
        <a href="tel:112"
          className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 rounded-xl text-sm">
          <Phone size={16} /> Emergency — 112
        </a>
      </div>

      {/* Full alert detail panel */}
      {focused && (
        <div className="fixed inset-0 z-50 bg-gray-950 overflow-auto">
          <div className="sticky top-0 bg-red-900 px-4 py-3 flex items-center justify-between" style={{ animation: 'alertPulse 1.5s infinite' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-300" />
              <p className="font-bold text-white">SOS — {focused.customer.firstName} {focused.customer.lastName}</p>
            </div>
            <button onClick={() => setFocused(null)} className="w-8 h-8 rounded-full bg-red-800 flex items-center justify-center">
              <X size={16} className="text-white" />
            </button>
          </div>

          <div className="p-4 space-y-4 pb-24">
            {/* Live map */}
            <SosMap alert={focused} />

            {/* Customer contact */}
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 font-semibold uppercase mb-2">Passenger in distress</p>
              <p className="font-bold text-white text-lg">{focused.customer.firstName} {focused.customer.lastName}</p>
              <a href={`tel:${focused.customer.phone}`}
                className="flex items-center gap-2 bg-green-700 text-white font-semibold py-3 px-4 rounded-xl text-sm mt-3">
                <Phone size={16} /> Call {focused.customer.phone}
              </a>
            </div>

            {/* Driver contact */}
            {focused.trip?.driver && (
              <div className="bg-gray-900 rounded-xl p-4">
                <p className="text-[10px] text-gray-500 font-semibold uppercase mb-2">Driver on the trip</p>
                <p className="font-semibold text-white">{focused.trip.driver.user.firstName} {focused.trip.driver.user.lastName}</p>
                <p className="text-xs text-gray-500">{focused.trip.driver.vehicle} · {focused.trip.driver.plate}</p>
                <a href={`tel:${focused.trip.driver.user.phone}`}
                  className="flex items-center gap-2 bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-sm mt-3">
                  <Phone size={16} /> Call Driver {focused.trip.driver.user.phone}
                </a>
              </div>
            )}

            {/* Trip info */}
            {focused.trip && (
              <div className="bg-gray-900 rounded-xl p-4 space-y-2">
                <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Trip Location</p>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0" />
                  <p className="text-sm text-gray-300">{focused.trip.pickupAddress}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                  <p className="text-sm text-gray-300">{focused.trip.destinationAddress}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              {focused.status === 'ACTIVE' && (
                <button
                  onClick={() => acknowledge(focused.id)}
                  disabled={acknowledged === focused.id}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40"
                >
                  <CheckCircle size={16} />
                  {acknowledged === focused.id ? 'Acknowledging…' : 'Acknowledge — I\'m responding'}
                </button>
              )}
              <button
                onClick={() => resolve(focused.id)}
                className="w-full flex items-center justify-center gap-2 bg-green-700 text-white font-semibold py-3 rounded-xl text-sm"
              >
                <CheckCircle size={16} /> Mark Resolved
              </button>
              <a href="tel:112"
                className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 rounded-xl text-sm">
                <Phone size={16} /> Emergency — 112
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
