'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Clock3, Crosshair, MapPin, Navigation, RefreshCw, Search, Users } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { api, getToken } from '../../../lib/api/client';
import { io } from 'socket.io-client';
import { loadGoogleMaps } from '../../../lib/mapsLoader';

type Trip = {
  id: string; status: string; serviceType: string; requestedAt: string;
  pickupAddress: string; pickupLat: number; pickupLng: number;
  destinationAddress: string; destinationLat: number; destinationLng: number;
  estimatedFare?: number; finalFare?: number;
  customer?: { firstName?: string | null; lastName?: string | null; phone?: string | null };
  driver?: { id: string; onlineStatus?: string; lastLat?: number | null; lastLng?: number | null; lastLocationAt?: string | null; user?: { firstName?: string | null; lastName?: string | null; phone?: string | null } } | null;
};
type Driver = {
  id: string; approvalStatus: string; onlineStatus: string; serviceType: string;
  vehicle?: string; plate?: string; lastLat?: number | null; lastLng?: number | null; lastLocationAt?: string | null;
  user?: { firstName?: string | null; lastName?: string | null; phone?: string | null };
};
type RideFilter = 'ALL' | 'SEARCHING_DRIVER' | 'DRIVER_ASSIGNED' | 'DRIVER_EN_ROUTE' | 'DRIVER_ARRIVED' | 'RIDE_IN_PROGRESS';
const ACTIVE = new Set(['SEARCHING_DRIVER','DRIVER_ASSIGNED','DRIVER_EN_ROUTE','DRIVER_ARRIVED','RIDE_IN_PROGRESS']);
const STATUS: Record<string,string> = {
  SEARCHING_DRIVER: 'Searching for driver', DRIVER_ASSIGNED: 'Driver assigned',
  DRIVER_EN_ROUTE: 'Driver en route', DRIVER_ARRIVED: 'Driver arrived',
  RIDE_IN_PROGRESS: 'In progress', RIDE_COMPLETED: 'Completed', RIDE_CANCELLED: 'Cancelled',
};
const fresh = (at?: string | null) => !!at && Date.now() - new Date(at).getTime() < 90_000;
const km = (a:number,b:number,c:number,d:number) => {
  const r=Math.PI/180, x=(c-a)*r, y=(d-b)*r;
  const h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;
  return 6371*2*Math.asin(Math.sqrt(h));
};
const money = (n?:number) => (n ?? 0).toLocaleString('en-RW') + ' RWF';
const name = (u?:{firstName?:string|null;lastName?:string|null}) => [u?.firstName,u?.lastName].filter(Boolean).join(' ') || 'Unknown';

export default function RideMonitorPage() {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string,any>>(new Map());
  const info = useRef<any>(null);
  const [rides,setRides] = useState<Trip[]>([]);
  const [drivers,setDrivers] = useState<Driver[]>([]);
  const [filter,setFilter] = useState<RideFilter>('ALL');
  const [selected,setSelected] = useState<string|null>(null);
  const [query,setQuery] = useState('');
  const [loading,setLoading] = useState(true);
  const [mapReady,setMapReady] = useState(false);
  const [lastSync,setLastSync] = useState<Date|null>(null);
  const [mapError,setMapError] = useState('');

  const load = useCallback(async () => {
    try {
      const [rideData,driverData] = await Promise.all([
        api.get<Trip[]>('/admin/trips'), api.get<Driver[]>('/admin/drivers'),
      ]);
      setRides(Array.isArray(rideData) ? rideData : []);
      setDrivers(Array.isArray(driverData) ? driverData : []);
      setLastSync(new Date());
    } catch {} finally { setLoading(false); }
  },[]);

  useEffect(() => { load(); const timer=setInterval(load,5000); return () => clearInterval(timer); },[load]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket = io('https://zana.ajumalink.com', { auth: { token }, transports: ['websocket'] });
    socket.on('admin:driver-position', (event: { driverId: string; lat: number; lng: number; at: string }) => {
      setDrivers(current => current.map(driver => driver.id === event.driverId
        ? { ...driver, lastLat: event.lat, lastLng: event.lng, lastLocationAt: event.at }
        : driver));
    });
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    let cancelled=false;
    loadGoogleMaps().then(() => {
      if(cancelled || !mapEl.current) return;
      const g=(window as any).google;
      map.current=new g.maps.Map(mapEl.current,{
        center:{lat:-1.9441,lng:30.0619},zoom:13,mapTypeControl:false,streetViewControl:false,
        fullscreenControl:true, clickableIcons:false,
        styles:[{featureType:'poi',elementType:'labels',stylers:[{visibility:'off'}]}],
      });
      info.current=new g.maps.InfoWindow();
      setMapReady(true);
    }).catch(()=>setMapError('Google Maps could not load. Check the Maps API key and network.'));
    return()=>{cancelled=true;};
  },[]);

  const activeRides=useMemo(()=>rides.filter(r=>ACTIVE.has(r.status)),[rides]);
  const available=useMemo(()=>drivers.filter(d=>d.approvalStatus==='APPROVED' && d.onlineStatus==='ONLINE' && d.lastLat!=null && d.lastLng!=null && fresh(d.lastLocationAt)),[drivers]);
  const visible=useMemo(()=>rides.filter(r=>{
    if(filter!=='ALL' && r.status!==filter) return false;
    if(!query.trim()) return true;
    const q=query.toLowerCase();
    return [r.id,r.pickupAddress,r.destinationAddress,name(r.customer),name(r.driver?.user),r.customer?.phone].some(v=>String(v??'').toLowerCase().includes(q));
  }),[rides,filter,query]);
  const closest=(ride:Trip)=>available.filter(d=>d.lastLat!=null&&d.lastLng!=null&&d.onlineStatus==='ONLINE'&&d.serviceType===ride.serviceType).map(d=>({...d,distance:km(ride.pickupLat,ride.pickupLng,d.lastLat!,d.lastLng!)})).sort((a,b)=>a.distance-b.distance)[0];

  useEffect(()=>{
    if(!mapReady || !map.current) return;
    const g=(window as any).google;
    const next=new Set<string>();
    const add=(id:string,position:{lat:number,lng:number},title:string,color:string,detail:string)=>{
      next.add(id);
      let marker=markers.current.get(id);
      if(!marker){
        marker=new g.maps.Marker({map:map.current,position,title,icon:{path:g.maps.SymbolPath.CIRCLE,scale:8,fillColor:color,fillOpacity:1,strokeColor:'#fff',strokeWeight:2}});
        marker.addListener('click',()=>{info.current.setContent(detail);info.current.open({map:map.current,anchor:marker});});
        markers.current.set(id,marker);
      } else { marker.setPosition(position); marker.setTitle(title); }
    };
    drivers.filter(d=>d.onlineStatus==='ONLINE'&&d.lastLat!=null&&d.lastLng!=null&&fresh(d.lastLocationAt)).forEach(d=>{
      add('driver:'+d.id,{lat:d.lastLat!,lng:d.lastLng!},'Driver · '+name(d.user),'#00A082',`<div style="font:13px sans-serif"><b>${name(d.user)}</b><br/>${d.vehicle??'Driver'} · ${d.plate??''}<br/>Online · live location</div>`);
    });
    rides.filter(r=>ACTIVE.has(r.status)).forEach(r=>{
      add('ride:'+r.id,{lat:r.pickupLat,lng:r.pickupLng},'Pickup · '+name(r.customer),'#F59E0B',`<div style="font:13px sans-serif"><b>Ride ${r.id.slice(0,8)}</b><br/>${STATUS[r.status]??r.status}<br/>${r.pickupAddress}</div>`);
      if(r.driver?.lastLat!=null&&r.driver?.lastLng!=null&&fresh(r.driver.lastLocationAt))
        add('assigned:'+r.id,{lat:r.driver.lastLat,lng:r.driver.lastLng},'Assigned · '+name(r.driver.user),'#2563EB',`<div style="font:13px sans-serif"><b>${name(r.driver.user)}</b><br/>Assigned driver · ${STATUS[r.status]??r.status}</div>`);
    });
    markers.current.forEach((m,id)=>{if(!next.has(id)){m.setMap(null);markers.current.delete(id);}});
  },[mapReady,drivers,rides]);

  const focus=(ride:Trip)=>{
    setSelected(ride.id);
    if(map.current){map.current.panTo({lat:ride.pickupLat,lng:ride.pickupLng});map.current.setZoom(16);}
  };
  const filters: {id:RideFilter;label:string}[]=[
    {id:'ALL',label:'All rides'},{id:'SEARCHING_DRIVER',label:'Searching'},
    {id:'DRIVER_ASSIGNED',label:'Assigned'},{id:'DRIVER_EN_ROUTE',label:'En route'},
    {id:'DRIVER_ARRIVED',label:'Arrived'},{id:'RIDE_IN_PROGRESS',label:'In progress'},
  ];

  return <AdminShell>
    <div className="h-[calc(100vh-72px)] min-h-[680px] flex flex-col bg-[#f4f7f8]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-white">
        <div><div className="flex items-center gap-2"><h2 className="text-xl font-black text-slate-900">Ride Monitor</h2><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/> LIVE</span></div><p className="text-xs text-slate-500 mt-1">Live ride requests, driver positions and dispatch proximity · Kigali operations</p></div>
        <div className="flex items-center gap-3 text-xs text-slate-500"><span>Updated {lastSync?lastSync.toLocaleTimeString(): '—'}</span><button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50"><RefreshCw size={14}/> Refresh</button></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {[{label:'Active rides',value:activeRides.length,icon:Activity},{label:'Searching for driver',value:rides.filter(r=>r.status==='SEARCHING_DRIVER').length,icon:Clock3},{label:'Online drivers',value:drivers.filter(d=>d.onlineStatus==='ONLINE').length,icon:Users},{label:'Drivers with fresh GPS',value:available.length,icon:Navigation}].map(s=><div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-3.5"><div className="flex items-center justify-between text-slate-500"><span className="text-[11px] font-semibold">{s.label}</span><s.icon size={15}/></div><p className="mt-1 text-2xl font-black text-slate-900">{s.value}</p></div>)}
      </div>
      <div className="flex flex-1 min-h-0 gap-0 border-t border-slate-200">
        <section className="w-full md:w-[390px] shrink-0 flex flex-col bg-white border-r border-slate-200">
          <div className="p-3 border-b border-slate-100">
            <div className="relative"><Search size={14} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search ride, customer, pickup..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#00A082]"/></div>
            <div className="flex gap-1.5 overflow-x-auto pt-3 pb-1">{filters.map(f=><button key={f.id} onClick={()=>setFilter(f.id)} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${filter===f.id?'bg-[#00A082] text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{f.label}</button>)}</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading&&<p className="p-5 text-xs text-slate-400">Loading rides…</p>}
            {!loading&&visible.length===0&&<div className="p-8 text-center text-xs text-slate-400">No rides match this filter.</div>}
            {visible.map(r=>{
              const near=closest(r); const isActive=ACTIVE.has(r.status);
              return <button key={r.id} onClick={()=>focus(r)} className={`block w-full border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${selected===r.id?'bg-emerald-50/70 border-l-[3px] border-l-[#00A082]':''}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] font-bold text-slate-500">#{r.id.slice(0,8).toUpperCase()}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${isActive?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{STATUS[r.status]??r.status}</span></div>
                <p className="mt-2 text-sm font-bold text-slate-900">{name(r.customer)}</p>
                <p className="mt-1 text-[11px] text-slate-500"><MapPin size={11} className="inline mr-1 text-amber-500"/>{r.pickupAddress}</p>
                <p className="mt-1 text-[11px] text-slate-500"><Navigation size={11} className="inline mr-1 text-slate-400"/>{r.destinationAddress}</p>
                <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-slate-500">{r.serviceType} · {money(r.finalFare??r.estimatedFare)}</span>{r.driver?<span className="text-[10px] font-bold text-blue-700">Driver: {name(r.driver.user)}</span>:near?<span className="text-[10px] font-bold text-emerald-700">Nearest: {name(near.user)} · {near.distance.toFixed(1)} km</span>:<span className="text-[10px] text-amber-700">No fresh available GPS</span>}</div>
              </button>;
            })}
          </div>
        </section>
        <section className="relative hidden md:block flex-1 bg-slate-100">
          <div ref={mapEl} className="absolute inset-0"/>
          {!mapReady&&!mapError&&<div className="absolute inset-0 grid place-items-center text-xs text-slate-500">Loading live map…</div>}
          {mapError&&<div className="absolute left-4 top-4 rounded-xl bg-white p-3 text-xs text-red-600 shadow">{mapError}</div>}
          <div className="absolute bottom-5 left-5 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-[10px] font-semibold shadow-lg backdrop-blur"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#00A082]"/>Online driver</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]"/>Ride pickup</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#2563EB]"/>Assigned driver</span></div>
          <button onClick={()=>{if(map.current){map.current.setCenter({lat:-1.9441,lng:30.0619});map.current.setZoom(13);}}} className="absolute right-5 bottom-5 rounded-xl bg-white p-3 shadow-lg" title="Center on Kigali"><Crosshair size={16}/></button>
        </section>
      </div>
    </div>
  </AdminShell>;
}
