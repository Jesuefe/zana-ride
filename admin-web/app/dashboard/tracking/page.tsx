'use client';

import { useEffect, useRef, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { getLiveOperations } from '../../../lib/api/admin';
import { loadGoogleMaps } from '../../../lib/mapsLoader';
import { Activity, CarFront, CircleDot, Radio, RefreshCw, Search, Users } from 'lucide-react';

const KIGALI = { lat: -1.9536, lng: 30.0605 };

export default function TrackingPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    try { setData(await getLiveOperations()); setError(''); }
    catch (e: any) { setError(e?.message ?? 'Live operations feed unavailable'); }
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!mapRef.current || map.current) return;
      const G = (window as any).google.maps;
      map.current = new G.Map(mapRef.current, {
        center: KIGALI, zoom: 12.5, fullscreenControl: true, streetViewControl: false, mapTypeControl: false,
      });
    }).catch(() => setError('Google Maps could not be loaded.'));
  }, []);

  useEffect(() => {
    if (!map.current || !data) return;
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];
    const G = (window as any).google.maps;
    (data.drivers ?? []).forEach((d: any) => {
      if (d.lat == null || d.lng == null) return;
      const marker = new G.Marker({
        map: map.current, position: { lat: d.lat, lng: d.lng },
        title: d.name + ' · ' + d.status,
        label: { text: d.status === 'BUSY' ? '●' : '•', color: d.status === 'BUSY' ? '#E6A82E' : '#00A082', fontWeight: '900' },
      });
      marker.addListener('click', () => setSelected({ kind: 'driver', ...d }));
      markers.current.push(marker);
    });
    (data.rides ?? []).forEach((r: any) => {
      if (r.driver?.lat == null || r.driver?.lng == null) return;
      const marker = new G.Marker({
        map: map.current, position: { lat: r.driver.lat, lng: r.driver.lng },
        title: 'Active ride ' + r.id.slice(0, 8),
        icon: { path: G.SymbolPath.CIRCLE, scale: 9, fillColor: '#00A082', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        label: { text: 'R', color: '#fff', fontWeight: '900' },
      });
      marker.addListener('click', () => setSelected({ kind: 'ride', ...r }));
      markers.current.push(marker);
    });
  }, [data]);

  const rides = (data?.rides ?? []).filter((r: any) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return [r.id, r.customer?.firstName, r.customer?.lastName, r.driver?.name, r.driver?.plate, r.pickupAddress, r.destinationAddress].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  return (
    <AdminShell>
      <div className="h-[calc(100vh-40px)] min-h-[720px] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Radio size={18} className="text-zana-primary" /><h1 className="text-2xl font-black text-gray-900">Live Operations Control</h1><span className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-[10px] font-black">LIVE · 5s</span></div>
            <p className="text-xs text-gray-500 mt-1">Kigali fleet, active rides and dispatch visibility.</p>
          </div>
          <button onClick={refresh} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold flex items-center gap-2"><RefreshCw size={14}/> Refresh</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            ['Online drivers', data?.kpis?.onlineDrivers ?? 0, Users],
            ['Busy / on ride', data?.kpis?.busyDrivers ?? 0, CarFront],
            ['Active rides', data?.kpis?.activeRides ?? 0, Activity],
            ['Searching', data?.kpis?.searchingRides ?? 0, CircleDot],
          ].map(([label, value, Icon]: any) => <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-3"><div className="flex items-center gap-2 text-gray-400"><Icon size={14}/><span className="text-[10px] uppercase font-black tracking-wide">{label}</span></div><p className="text-2xl font-black text-gray-900 mt-1">{value}</p></div>)}
        </div>

        <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_360px] gap-3">
          <div className="relative bg-gray-200 rounded-2xl overflow-hidden border border-gray-200">
            <div ref={mapRef} className="absolute inset-0" />
            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-xl px-3 py-2 text-[11px] font-semibold shadow-sm"><span className="text-zana-primary">●</span> Online &nbsp; <span className="text-amber-500">●</span> Busy &nbsp; <span className="text-gray-500">R</span> Active ride</div>
            {error && <div className="absolute bottom-3 left-3 right-3 bg-red-50 text-red-700 rounded-xl p-3 text-xs">{error}</div>}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <p className="font-black text-gray-900">Active ride traffic</p>
              <p className="text-[11px] text-gray-500">Select a ride to inspect live movement.</p>
              <div className="mt-3 relative"><Search size={14} className="absolute left-3 top-2.5 text-gray-400"/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search ride, driver, passenger…" className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-xs"/></div>
            </div>
            <div className="flex-1 overflow-auto">
              {rides.length === 0 && <p className="p-5 text-xs text-gray-400">No active rides right now.</p>}
              {rides.map((r: any) => <button key={r.id} onClick={()=>setSelected({kind:'ride',...r})} className="w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50">
                <div className="flex justify-between gap-2"><span className="font-mono text-xs font-black text-zana-primary">ZN-{r.id.slice(0,8).toUpperCase()}</span><span className="text-[10px] font-bold text-gray-500">{r.status.replaceAll('_',' ')}</span></div>
                <p className="text-xs font-bold text-gray-800 mt-1">{r.customer?.firstName ?? 'Passenger'} · {r.serviceType}</p>
                <p className="text-[11px] text-gray-500 mt-1 truncate">{r.pickupAddress} → {r.destinationAddress}</p>
                <p className="text-xs font-black mt-2">{Number(r.fare ?? 0).toLocaleString()} RWF</p>
              </button>)}
            </div>
            {selected && <div className="border-t border-gray-100 p-4 bg-gray-50">
              <div className="flex justify-between"><p className="font-black text-sm">{selected.kind === 'ride' ? 'Ride inspection' : 'Driver inspection'}</p><button onClick={()=>setSelected(null)} className="text-xs text-gray-400">Close</button></div>
              <p className="text-xs text-gray-600 mt-2">{selected.kind === 'ride' ? `${selected.customer?.firstName ?? 'Passenger'} · ${selected.driver?.name ?? 'Searching'}` : selected.name}</p>
              {selected.driver?.plate && <p className="text-[11px] text-gray-500 mt-1">Plate {selected.driver.plate}</p>}
              {selected.driver?.lat != null && <p className="text-[11px] text-gray-500 mt-1">GPS {selected.driver.lat.toFixed(5)}, {selected.driver.lng.toFixed(5)}</p>}
              {selected.pickupAddress && <p className="text-[11px] text-gray-500 mt-1">{selected.pickupAddress} → {selected.destinationAddress}</p>}
            </div>}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
