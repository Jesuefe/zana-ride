'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, Phone, MapPin, LogOut, RefreshCw, AlertTriangle, X, CheckCircle, Bell, Clock, Activity, ShieldAlert, Radio, ExternalLink } from 'lucide-react';
import { api, getToken, clearToken, setToken } from '../../lib/api/client';
import { io } from 'socket.io-client';

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
  role?: 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'MERCHANT';
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
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (getToken()) setAuthed(true);
  }, []);

  const poll = useCallback(async () => {
    try {
      const data = await api.get<SosAlert[]>('/sos/active');
      setAlerts(data);
      setLastRefresh(new Date());
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
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com';
    const socket = io(apiBase, { transports: ['websocket'], auth: { token: getToken() } });
    const handleIncoming = (payload: any) => {
      const incoming = payload?.alert ?? payload?.sos ?? payload;
      if (!incoming?.id) return;
      setAlerts(prev => [incoming as SosAlert, ...prev.filter(a => a.id !== incoming.id)]);
      setFocused(incoming as SosAlert);
      setAlarmActive(true);
      setLastRefresh(new Date());
    };
    socket.on('sos:alert', handleIncoming);
    socket.on('sos:new', handleIncoming);
    const interval = setInterval(poll, 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      socket.off('sos:alert', handleIncoming);
      socket.off('sos:new', handleIncoming);
      socket.disconnect();
      clearInterval(interval);
      clearInterval(clock);
    };
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
    } catch {
      // This is an active emergency alert — a safety operator must know
      // immediately if acknowledging it failed, or they may walk away
      // believing it was handled when it was not.
      setActionError('Could not acknowledge the alert. It is still active — try again.');
    } finally { setAcknowledging(null); }
  };

  const elapsed = (createdAt: string) => {
    const seconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = seconds % 60;
    return h ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const resolve = async (id: string) => {
    try {
      await api.patch(`/sos/${id}/resolve`);
      setFocused(null);
      await poll();
    } catch {
      setActionError('Could not mark the alert resolved. Try again.');
    }
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
    <div className="min-h-screen bg-slate-950 text-white pb-8">
      <AlarmSound active={alarmActive} />
      {actionError && <div onClick={() => setActionError('')} className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] bg-red-600 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg cursor-pointer">{actionError} — tap to dismiss</div>}

      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center"><Shield size={19}/></div><div><p className="font-black">Zana Safety Center</p><p className="text-[10px] text-slate-500">Live incident monitoring · {lastRefresh ? lastRefresh.toLocaleTimeString() : 'connecting'}</p></div></div>
          <div className="flex items-center gap-2">
            {alarmActive && <button onClick={() => setAlarmActive(false)} className="flex items-center gap-1.5 bg-red-700 text-white text-xs px-3 py-2 rounded-lg font-bold"><Bell size={13}/> Mute</button>}
            <button onClick={() => poll()} className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center"><RefreshCw size={14}/></button>
            <button onClick={() => { clearToken(); setAuthed(false); }} className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center"><LogOut size={14}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            ['Active incidents', alerts.filter(a=>a.status==='ACTIVE').length, 'border-red-700 bg-red-950/40 text-red-300'],
            ['Acknowledged', alerts.filter(a=>a.status==='ACKNOWLEDGED').length, 'border-amber-800 bg-amber-950/30 text-amber-300'],
            ['Driver SOS', alerts.filter(a=>a.role==='DRIVER').length, 'border-slate-800 bg-slate-900 text-slate-400'],
            ['Customer SOS', alerts.filter(a=>a.role!=='DRIVER').length, 'border-slate-800 bg-slate-900 text-slate-400'],
          ].map(([label,value,style]) => <div key={String(label)} className={`rounded-2xl p-4 border ${style}`}><p className="text-[10px] uppercase tracking-wider font-bold">{label}</p><p className="text-3xl font-black mt-1 text-white">{value}</p></div>)}
        </div>

        {alerts.length===0 ? (
          <section className="min-h-[62vh] rounded-3xl border border-slate-800 bg-slate-900/50 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 rounded-full bg-emerald-900/30 flex items-center justify-center mb-5"><Shield size={34} className="text-emerald-400"/></div>
            <p className="text-xl font-black text-emerald-400">All Clear</p><p className="text-sm text-slate-500 mt-1">No active SOS incidents require response.</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><Radio size={13} className="text-emerald-400"/> Safety monitoring is active</div>
            {lastRefresh && <p className="text-[10px] text-slate-600 mt-2">Last reconciliation {lastRefresh.toLocaleTimeString()}</p>}
          </section>
        ) : (
          <section><div className="flex items-center justify-between mb-3"><div><p className="text-lg font-black">Incident queue</p><p className="text-xs text-slate-500">Open an incident to coordinate the response.</p></div><span className="text-xs font-bold text-red-400">{alerts.length} open</span></div>
            <div className="grid gap-3 lg:grid-cols-2">{alerts.map(alert => (
              <button key={alert.id} onClick={()=>setFocused(alert)} className={`w-full text-left rounded-2xl p-4 border bg-slate-900 ${alert.status==='ACTIVE'?'border-red-700':'border-amber-800'}`}>
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><AlertTriangle size={16} className={alert.status==='ACTIVE'?'text-red-500':'text-amber-400'}/><span className="font-black text-sm">{alert.role==='DRIVER'?'DRIVER SOS':'CUSTOMER SOS'}</span></div><span className="font-mono text-xs text-slate-400 flex items-center gap-1"><Clock size={11}/>{elapsed(alert.createdAt)}</span></div>
                <div className="mt-3 flex items-start justify-between gap-4"><div><p className="font-bold">{alert.customer.firstName} {alert.customer.lastName}</p><p className="text-xs text-slate-500 mt-0.5">{alert.customer.phone}</p>{alert.trip&&<p className="text-xs text-slate-500 mt-2 truncate">{alert.trip.pickupAddress} → {alert.trip.destinationAddress}</p>}</div><span className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-black ${alert.status==='ACTIVE'?'bg-red-950 text-red-300':'bg-amber-950 text-amber-300'}`}>{alert.status}</span></div>
                <div className="mt-3 text-xs text-slate-500 flex justify-between"><span>{new Date(alert.createdAt).toLocaleTimeString()}</span><span className="text-red-400 font-bold">Open incident →</span></div>
              </button>
            ))}</div>
          </section>
        )}
      </main>

      {focused && <div className="fixed inset-0 z-50 bg-slate-950 overflow-auto">
        <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3"><div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center"><AlertTriangle size={17}/></div><div><p className="font-black">SOS · {focused.customer.firstName} {focused.customer.lastName}</p><p className="text-[10px] text-red-300"><Clock size={10} className="inline mr-1"/>{elapsed(focused.createdAt)} elapsed · {focused.status}</p></div></div>
          <button onClick={()=>setFocused(null)} className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center"><X size={16}/></button>
        </div></header>
        <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-4 pb-10">
          <div className="grid grid-cols-3 gap-2">{['ACTIVE','ACKNOWLEDGED','RESOLVED'].map((step,i)=>{const done=step==='ACTIVE'?true:step==='ACKNOWLEDGED'?(focused.status==='ACKNOWLEDGED'||focused.status==='RESOLVED'):focused.status==='RESOLVED';return <div key={step} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center"><div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${done?'bg-red-600':'bg-slate-800 text-slate-600'}`}>{i+1}</div><p className="text-[9px] mt-2 font-bold">{step}</p></div>})}</div>

          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900"><div className="p-4 flex items-center justify-between"><div className="flex items-center gap-2"><ShieldAlert size={17} className="text-red-500"/><div><p className="text-sm font-bold">Live incident location</p><p className="text-[10px] text-slate-500">Location captured with the SOS.</p></div></div><span className="font-mono font-black text-red-400">{elapsed(focused.createdAt)}</span></div><SosMap alert={focused}/></div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-[10px] text-slate-500 uppercase font-bold mb-3">{focused.role==='DRIVER'?'Driver in distress':'Passenger in distress'}</p><p className="text-lg font-black">{focused.customer.firstName} {focused.customer.lastName}</p><p className="text-sm text-slate-400 mt-1">{focused.customer.phone}</p><a href={`tel:${focused.customer.phone}`} className="mt-4 flex items-center justify-center gap-2 bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm"><Phone size={15}/> Call person</a></div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-[10px] text-slate-500 uppercase font-bold mb-3">Incident data</p><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-slate-500 text-xs">Alert ID</p><p className="font-mono text-xs mt-1">{focused.id.slice(0,12)}</p></div><div><p className="text-slate-500 text-xs">Reporter</p><p className="mt-1">{focused.role==='DRIVER'?'Driver':'Customer'}</p></div><div><p className="text-slate-500 text-xs">Triggered</p><p className="mt-1">{new Date(focused.createdAt).toLocaleString('en-GB')}</p></div><div><p className="text-slate-500 text-xs">Trip</p><p className="mt-1">{focused.tripId?focused.tripId.slice(0,12):'—'}</p></div></div></div>
          </div>

          {focused.trip && <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-[10px] text-slate-500 uppercase font-bold mb-3">Trip context</p><div className="grid md:grid-cols-2 gap-3 text-sm"><div><p className="text-slate-500 text-xs">Pickup</p><p className="mt-1">{focused.trip.pickupAddress}</p></div><div><p className="text-slate-500 text-xs">Destination</p><p className="mt-1">{focused.trip.destinationAddress}</p></div>{focused.trip.driver&&<div><p className="text-slate-500 text-xs">Driver / vehicle</p><p className="mt-1">{focused.trip.driver.user.firstName} {focused.trip.driver.user.lastName} · {focused.trip.driver.vehicle} · {focused.trip.driver.plate}</p></div>}{focused.trip.driver&&<a href={`tel:${focused.trip.driver.user.phone}`} className="flex items-center justify-center gap-2 bg-blue-700 text-white font-bold py-3 rounded-xl text-sm"><Phone size={15}/> Call driver</a>}</div></div>}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p className="text-[10px] text-slate-500 uppercase font-bold mb-3">Response actions</p><div className="grid md:grid-cols-3 gap-2">{focused.status==='ACTIVE'&&<button onClick={()=>acknowledge(focused.id)} disabled={acknowledged===focused.id} className="flex items-center justify-center gap-2 bg-amber-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40"><CheckCircle size={15}/>{acknowledged===focused.id?'Acknowledging…':'Acknowledge'}</button>}<button onClick={()=>focused.status==='ACKNOWLEDGED'&&resolve(focused.id)} disabled={focused.status!=='ACKNOWLEDGED'} className="flex items-center justify-center gap-2 bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-30"><CheckCircle size={15}/>Mark resolved</button><a href="tel:112" className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 rounded-xl text-sm"><Phone size={15}/>Call 112</a></div></div>
          <a href={`https://maps.google.com/?q=${focused.lat??focused.trip?.pickupLat},${focused.lng??focused.trip?.pickupLng}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-sm text-blue-400 py-2"><ExternalLink size={14}/>Open incident in Google Maps</a>
        </div>
      </div>}
    </div>
  );
