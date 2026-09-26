'use client';

import { useEffect, useRef, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { loadGoogleMaps } from '../../../lib/mapsLoader';
import {
  getDrivers, getLiveOperations, getDriverTestLocations, setDriverTestLocation,
  scatterDriverTestLocations, clearDriverTestLocations, clearAllTestLocations,
} from '../../../lib/api/admin';
import { Pause, Play, RotateCcw, Search, ShieldAlert, Square, Users, Navigation } from 'lucide-react';

const KIGALI = { lat: -1.9536, lng: 30.0605 };
const KIMIRONKO = { lat: -1.9439, lng: 30.1121 };

function distanceM(a:{lat:number,lng:number}, b:{lat:number,lng:number}) {
  const R=6371000, dLat=(b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.asin(Math.sqrt(x));
}
function interpolate(a:any,b:any,t:number){return {lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t};}

export default function TestLocationsPage(){
  const mapRef=useRef<HTMLDivElement>(null), map=useRef<any>(null), marker=useRef<any>(null), routeLine=useRef<any>(null);
  const timer=useRef<ReturnType<typeof setInterval>|null>(null), pathRef=useRef<any[]>([]), seg=useRef(0), progress=useRef(0);
  const [drivers,setDrivers]=useState<any[]>([]),[locations,setLocations]=useState<any[]>([]),[ops,setOps]=useState<any>(null);
  const [selected,setSelected]=useState<any>(null),[search,setSearch]=useState(''),[speed,setSpeed]=useState(30),[moving,setMoving]=useState(false),[paused,setPaused]=useState(false),[status,setStatus]=useState('Ready');

  const refresh=async()=>{try{const [d,l,o]=await Promise.all([getDrivers(),getDriverTestLocations(),getLiveOperations()]);setDrivers(d||[]);setLocations(l||[]);setOps(o||null);}catch(e:any){setStatus(e?.message||'Could not load test data');}};
  useEffect(()=>{refresh();const t=setInterval(refresh,3000);return()=>clearInterval(t);},[]);
  useEffect(()=>{loadGoogleMaps().then(()=>{if(!mapRef.current||map.current)return;const G=(window as any).google.maps;map.current=new G.Map(mapRef.current,{center:KIGALI,zoom:12.5,streetViewControl:false,mapTypeControl:false,fullscreenControl:true});}).catch(()=>setStatus('Google Maps unavailable'));},[]);

  const loc=selected&&locations.find(x=>x.id===selected.id);
  const activeRide=selected&&(ops?.rides||[]).find((r:any)=>r.driver?.id===selected.id);
  const activeDelivery=selected&&(ops?.deliveries||[]).find((d:any)=>d.driver?.id===selected.id);
  const job=activeDelivery||activeRide;
  const target=job?(activeDelivery?(job.status==='PICKED_UP'?job.dropoff:job.pickup):(job.status==='RIDE_IN_PROGRESS'?job.destination:job.pickup)):null;

  async function moveTo(p:any){
    if(!selected)return;
    await setDriverTestLocation(selected.id,p.lat,p.lng);
    setLocations(ls=>ls.map(x=>x.id===selected.id?{...x,testOverrideLat:p.lat,testOverrideLng:p.lng}:x));
  }

  useEffect(()=>{
    if(!map.current||!loc||loc.testOverrideLat==null||loc.testOverrideLng==null)return;
    const G=(window as any).google.maps;
    if(marker.current)marker.current.setMap(null);
    marker.current=new G.Marker({map:map.current,position:{lat:Number(loc.testOverrideLat),lng:Number(loc.testOverrideLng)},draggable:true,title:'Simulated driver'});
    marker.current.addListener('dragend',(e:any)=>moveTo({lat:e.latLng.lat(),lng:e.latLng.lng()}));
    map.current.panTo(marker.current.getPosition());
  },[loc?.testOverrideLat,loc?.testOverrideLng,selected?.id]);

  function addPoint(e:any){
    if(!selected)return;
    pathRef.current=[...pathRef.current,{lat:e.latLng.lat(),lng:e.latLng.lng()}];
    const G=(window as any).google.maps;
    if(routeLine.current)routeLine.current.setMap(null);
    routeLine.current=new G.Polyline({map:map.current,path:pathRef.current,strokeOpacity:.75,strokeWeight:5});
    setStatus(pathRef.current.length+' route points');
  }
  useEffect(()=>{if(!map.current)return;const l=map.current.addListener('click',addPoint);return()=>l.remove();},[selected?.id]);

  function stop(){if(timer.current)clearInterval(timer.current);timer.current=null;setMoving(false);setPaused(false);}
  function reset(){stop();pathRef.current=[];seg.current=0;progress.current=0;if(routeLine.current)routeLine.current.setMap(null);routeLine.current=null;if(selected&&selected.lastLat!=null)moveTo({lat:Number(selected.lastLat),lng:Number(selected.lastLng)}).then(()=>setStatus('Reset to last reported location')).catch(()=>{});}
  function start(){
    if(!selected)return;
    const startPoint=loc?.testOverrideLat!=null?{lat:Number(loc.testOverrideLat),lng:Number(loc.testOverrideLng)}:selected?.lastLat!=null?{lat:Number(selected.lastLat),lng:Number(selected.lastLng)}:KIGALI;
    if(pathRef.current.length<2)pathRef.current=[startPoint,...(target?[target]:[])];
    if(pathRef.current.length<2){setStatus('Click route points or select a job with a target');return;}
    if(timer.current)clearInterval(timer.current);
    seg.current=0;progress.current=0;setMoving(true);setPaused(false);setStatus('Moving through live test GPS override…');
    timer.current=setInterval(async()=>{
      if(paused)return;
      const a=pathRef.current[seg.current],b=pathRef.current[seg.current+1];
      if(!a||!b){stop();setStatus('Route complete');return;}
      const meters=Math.max(1,distanceM(a,b));
      progress.current+=Math.max(.001,Math.min(.15,(speed/3.6)/meters));
      if(progress.current>=1){await moveTo(b);seg.current++;progress.current=0;if(seg.current>=pathRef.current.length-1){stop();setStatus('Route complete');}}
      else await moveTo(interpolate(a,b,progress.current));
    },1000);
  }

  const shown=drivers.filter(d=>{const q=search.toLowerCase().trim();return !q||[d.user?.firstName,d.user?.lastName,d.user?.phone,d.plate].filter(Boolean).join(' ').toLowerCase().includes(q);});
  const name=selected?[selected.user?.firstName,selected.user?.lastName].filter(Boolean).join(' ')||'Driver':'No driver selected';

  return <AdminShell><div className="h-[calc(100vh-40px)] min-h-[720px] flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Navigation size={18} className="text-zana-primary"/><h1 className="text-2xl font-black">Zana Test Lab</h1><span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black">SIMULATION</span></div><p className="text-xs text-gray-500 mt-1">Real backend GPS override · real dispatch/tracking pipeline · no fake-only marker.</p></div><button onClick={()=>clearAllTestLocations().then(refresh)} className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-black flex items-center gap-2"><ShieldAlert size={14}/> Destroy session</button></div>
    <div className="grid lg:grid-cols-[1fr_370px] gap-3 flex-1 min-h-0">
      <div className="relative bg-gray-200 rounded-2xl overflow-hidden border"><div ref={mapRef} className="absolute inset-0"/><div className="absolute top-3 left-3 bg-white/95 rounded-xl p-3 shadow text-[10px]"><b>{name}</b><br/><span className="text-gray-500">Click map to add route points · drag marker for manual GPS</span></div></div>
      <div className="bg-white rounded-2xl border overflow-auto p-4 space-y-4">
        <div><p className="font-black">Select driver</p><div className="relative mt-2"><Search size={13} className="absolute left-3 top-2.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone or plate" className="w-full pl-8 pr-3 py-2 rounded-lg border text-xs"/></div><div className="mt-2 max-h-40 overflow-auto">{shown.map(d=><button key={d.id} onClick={()=>{stop();setSelected(d)}} className={`w-full text-left px-3 py-2 rounded-lg text-xs ${selected?.id===d.id?'bg-zana-primary/10 border border-zana-primary':'hover:bg-gray-50'}`}><b>{[d.user?.firstName,d.user?.lastName].filter(Boolean).join(' ')||'Driver'}</b><span className="block text-[10px] text-gray-500">{d.onlineStatus} · {d.plate}</span></button>)}</div></div>
        {selected&&<><div className="border-t pt-3"><p className="font-black">{name}</p><p className="text-[11px] text-gray-500">{selected.user?.phone}</p><p className="text-[11px]">Live status: <b>{selected.onlineStatus}</b></p><p className="text-[11px]">Override: <b>{loc?'ON':'OFF'}</b></p></div>
        {job&&<div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] uppercase font-black text-gray-400">{activeDelivery?'Delivery':'Ride'} · {job.status}</p><p className="text-xs font-bold mt-1">{activeDelivery?job.itemDescription:(job.customer?.firstName||'Passenger')}</p><p className="text-[11px] text-gray-600 mt-1">{job.pickupAddress||'Pickup'} → {job.dropoffAddress||job.destinationAddress||'Destination'}</p>{activeDelivery&&<><p className="text-[11px] mt-2">Pickup: <b>{job.pickupContactName||'Pickup contact'}</b> · {job.pickupPhone||'—'}</p><p className="text-[11px]">Recipient: <b>{job.recipientName||'Recipient'}</b> · {job.recipientPhone||'—'}</p></>}{activeRide?.customer?.phone&&<p className="text-[11px] mt-2">Passenger: {activeRide.customer.phone}</p>}{target&&<p className="text-[11px] mt-2 font-bold text-zana-primary">Target {target.lat.toFixed(5)}, {target.lng.toFixed(5)}</p>}</div>}
        <div className="grid grid-cols-2 gap-2"><button onClick={start} disabled={moving} className="py-2 rounded-lg bg-zana-primary text-white text-xs font-black flex items-center justify-center gap-1"><Play size={13}/> Start moving</button><button onClick={()=>setPaused(p=>!p)} disabled={!moving} className="py-2 rounded-lg border text-xs font-black flex items-center justify-center gap-1"><Pause size={13}/> {paused?'Resume':'Pause'}</button><button onClick={reset} className="py-2 rounded-lg border text-xs font-black flex items-center justify-center gap-1"><RotateCcw size={13}/> Reset</button><button onClick={stop} className="py-2 rounded-lg border text-xs font-black flex items-center justify-center gap-1"><Square size={13}/> Stop</button></div>
        <label className="block text-xs font-bold">Speed <input type="range" min="5" max="80" value={speed} onChange={e=>setSpeed(Number(e.target.value))} className="w-full"/><span className="text-[10px] text-gray-500">{speed} km/h</span></label>
        <div className="grid grid-cols-2 gap-2"><button onClick={()=>scatterDriverTestLocations(KIMIRONKO.lat,KIMIRONKO.lng,500).then(refresh)} className="py-2 rounded-lg border text-[10px] font-black"><Users size={12} className="inline"/> Scatter Kimironko</button><button onClick={()=>clearDriverTestLocations().then(refresh)} className="py-2 rounded-lg border text-[10px] font-black">Clear drivers</button></div>
        <p className="text-[10px] text-gray-500 border-t pt-3">{status}</p></>}
      </div>
    </div>
  </div></AdminShell>;
}
