'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api/client';
import { MapPin, Plus, Pencil, Undo2, Save, Power, Layers3, AlertTriangle, LoaderCircle, Check, X } from 'lucide-react';

type Point = [number, number];
type Zone = { id:string; name:string; city:string; boundary:{type:'Polygon';coordinates:number[][][]}; serviceTypes:string[]; nearbyZoneIds:string[]; active:boolean };
declare global { interface Window { L?: any } }

const serviceOptions = [
  { value:'ALL', label:'All services' }, { value:'BIKE', label:'Motorcycle rides' },
  { value:'ECONOMY', label:'Economy rides' }, { value:'COMFORT', label:'Comfort rides' },
  { value:'DELIVERIES', label:'Deliveries' },
];

function leaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-zana-map]')) {
      const css = document.createElement('link'); css.rel='stylesheet';
      css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; css.dataset.zanaMap='1'; document.head.appendChild(css);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-zana-map]');
    if (existing) { existing.addEventListener('load', () => resolve(window.L)); existing.addEventListener('error', reject); return; }
    const script=document.createElement('script'); script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async=true; script.dataset.zanaMap='1'; script.onload=() => window.L ? resolve(window.L) : reject(new Error('Map library unavailable'));
    script.onerror=() => reject(new Error('Could not load the map. Check your internet connection.'));
    document.body.appendChild(script);
  });
}

export default function ServiceZonesPage() {
  const mapNode=useRef<HTMLDivElement>(null), mapRef=useRef<any>(null), zonesLayer=useRef<any>(null), draftLayer=useRef<any>(null);
  const pointsRef=useRef<Point[]>([]), drawingRef=useRef(false);
  const [zones,setZones]=useState<Zone[]>([]), [city,setCity]=useState('Kigali'), [name,setName]=useState('');
  const [services,setServices]=useState<string[]>(['ALL']), [nearby,setNearby]=useState<string[]>([]), [active,setActive]=useState(true);
  const [selected,setSelected]=useState<string|null>(null), [points,setPoints]=useState<Point[]>([]), [drawing,setDrawing]=useState(false);
  const [ready,setReady]=useState(false), [loading,setLoading]=useState(true), [saving,setSaving]=useState(false);
  const [error,setError]=useState(''), [message,setMessage]=useState('');
  const current=zones.find(z=>z.id===selected) || null;

  const refresh=useCallback(async () => {
    setLoading(true);
    try { const result=await api.get<Zone[]>('/admin/service-zones?city='+encodeURIComponent(city)); setZones(Array.isArray(result)?result:[]); setError(''); }
    catch(e:any) { setError(e.message || 'Could not load service zones.'); }
    finally { setLoading(false); }
  },[city]);
  useEffect(()=>{refresh();},[refresh]);

  const clearDraft=useCallback(()=>{
    pointsRef.current=[]; setPoints([]); drawingRef.current=false; setDrawing(false);
    if(draftLayer.current) draftLayer.current.clearLayers();
  },[]);
  const paintDraft=useCallback((items:Point[])=>{
    const L=window.L; if(!L || !draftLayer.current) return;
    draftLayer.current.clearLayers();
    items.forEach(p=>L.circleMarker(p,{radius:5,color:'#008f72',fillColor:'#fff',fillOpacity:1,weight:2}).addTo(draftLayer.current));
    if(items.length>1) L.polyline(items,{color:'#00a082',weight:3,dashArray:'7 6'}).addTo(draftLayer.current);
    if(items.length>2) L.polygon(items,{color:'#00a082',fillColor:'#00a082',fillOpacity:.12,weight:2,dashArray:'6 5'}).addTo(draftLayer.current);
  },[]);

  useEffect(()=>{
    let cancelled=false;
    leaflet().then(L=>{
      if(cancelled || !mapNode.current || mapRef.current) return;
      const map=L.map(mapNode.current,{doubleClickZoom:false}).setView([-1.9441,30.0619],12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
      zonesLayer.current=L.featureGroup().addTo(map); draftLayer.current=L.featureGroup().addTo(map); mapRef.current=map;
      map.on('click',(event:any)=>{
        if(!drawingRef.current) return;
        const next=pointsRef.current.concat([[event.latlng.lat,event.latlng.lng] as Point]);
        pointsRef.current=next; setPoints(next); paintDraft(next);
      });
      setReady(true); window.setTimeout(()=>map.invalidateSize(),180);
    }).catch((e:any)=>setError(e.message || 'Unable to initialise map.'));
    return ()=>{cancelled=true;if(mapRef.current){mapRef.current.remove();mapRef.current=null;zonesLayer.current=null;draftLayer.current=null;}};
  },[paintDraft]);

  const selectZone=(zone:Zone)=>{
    clearDraft(); setSelected(zone.id); setName(zone.name); setCity(zone.city);
    setServices(zone.serviceTypes?.length?zone.serviceTypes:['ALL']); setNearby(zone.nearbyZoneIds||[]);
    setActive(zone.active); setMessage(''); setError('');
  };

  useEffect(()=>{
    const L=window.L; if(!L || !zonesLayer.current || !mapRef.current) return;
    zonesLayer.current.clearLayers();
    const bounds:any[]=[];
    zones.forEach(zone=>{
      const layer=L.geoJSON(zone.boundary,{style:{
        color:zone.id===selected?'#006b55':zone.active?'#00a082':'#8b9290',
        weight:zone.id===selected?4:2,fillColor:zone.active?'#00a082':'#9ca3af',
        fillOpacity:zone.id===selected?.28:.13,dashArray:zone.active?undefined:'5 5'
      }});
      layer.on('click',()=>{if(!drawingRef.current) selectZone(zone);}); layer.bindTooltip(zone.name+' · '+(zone.active?'Active':'Inactive')); layer.addTo(zonesLayer.current);
      if(layer.getBounds().isValid()) bounds.push(layer.getBounds());
    });
    if(bounds.length && !selected){const b=bounds.reduce((a,b)=>a.extend(b));mapRef.current.fitBounds(b,{padding:[24,24],maxZoom:14});}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[zones,selected,ready]);

  const newZone=()=>{clearDraft();setSelected(null);setName('');setServices(['ALL']);setNearby([]);setActive(true);setMessage('Draw a boundary on the map, then save your zone.');setError('');};
  const beginDraw=()=>{clearDraft();drawingRef.current=true;setDrawing(true);setMessage('Tap the map to add boundary points. Add at least 3 points, then finish.');};
  const finish=()=>{if(pointsRef.current.length<3){setError('Add at least 3 boundary points.');return;}drawingRef.current=false;setDrawing(false);setMessage('Boundary ready. Save your zone when the outline looks right.');};
  const undo=()=>{const next=pointsRef.current.slice(0,-1);pointsRef.current=next;setPoints(next);paintDraft(next);};
  const toggleService=(value:string)=>{
    if(value==='ALL'){setServices(['ALL']);return;}
    const without=services.filter(v=>v!=='ALL');
    const next=without.includes(value)?without.filter(v=>v!==value):without.concat(value);
    setServices(next.length?next:['ALL']);
  };

  const save=async()=>{
    if(!name.trim()||!city.trim()){setError('Enter a zone name and city.');return;}
    if(!selected && pointsRef.current.length<3){setError('Draw a boundary with at least 3 points first.');return;}
    if(drawing) finish();
    const ring=pointsRef.current.map(p=>[p[1],p[0]]);
    if(ring.length) ring.push(ring[0].slice());
    const payload:any={name:name.trim(),city:city.trim(),serviceTypes:services,nearbyZoneIds:nearby,active:active};
    if(ring.length>=4) payload.boundary={type:'Polygon',coordinates:[ring]};
    setSaving(true);setError('');setMessage('');
    try{
      if(selected) await api.patch('/admin/service-zones/'+selected,payload);
      else await api.post('/admin/service-zones',payload);
      setMessage(selected?'Service zone updated.':'Service zone created.'); clearDraft(); await refresh();
    }catch(e:any){setError(e.message || 'Could not save zone.');}
    finally{setSaving(false);}
  };

  const toggleZone=async(zone:Zone)=>{
    try{await api.patch('/admin/service-zones/'+zone.id,{active:!zone.active});setMessage(zone.name+' is now '+(!zone.active?'active':'inactive')+'.');await refresh();}
    catch(e:any){setError(e.message || 'Could not change zone status.');}
  };

  return <AdminShell><div className="mx-auto max-w-[1600px] space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="flex items-center gap-2 text-sm font-semibold text-zana-primary"><Layers3 size={16}/> ZANA OPERATIONS</div>
        <h1 className="mt-1 text-2xl font-bold text-gray-950">Service zones</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Draw the areas where Zana operates and connect neighbouring zones for driver matching.</p></div>
      <button onClick={newZone} className="inline-flex items-center justify-center gap-2 rounded-xl bg-zana-primary px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17}/> New zone</button>
    </div>
    {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17}/>{error}</div>}
    {message && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={17}/>{message}</div>}
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,.85fr)]">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div><p className="text-sm font-semibold text-gray-900">Zone boundary map</p><p className="text-xs text-gray-500">Kigali · Tap to add polygon points</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={beginDraw} className="rounded-lg border border-zana-primary px-3 py-2 text-xs font-semibold text-zana-primary">{drawing?'Drawing…':'Draw / redraw boundary'}</button>
            {drawing && <><button onClick={undo} disabled={!points.length} className="rounded-lg border p-2 text-gray-600 disabled:opacity-40" title="Undo"><Undo2 size={15}/></button><button onClick={finish} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white">Finish</button></>}
            {points.length>0 && !drawing && <button onClick={clearDraft} className="rounded-lg border p-2 text-gray-600" title="Clear draft"><X size={15}/></button>}
          </div>
        </div>
        <div ref={mapNode} className="z-0 h-[430px] w-full bg-gray-100 sm:h-[560px]"/>
        <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-3 text-[11px] text-gray-500">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#00a082]"/>Active zone</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-gray-400"/>Inactive zone</span>
          <span className="ml-auto">{ready?'Map ready':'Loading map…'} · {zones.length} zones</span>
        </div>
      </section>
      <div className="space-y-5">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-gray-900">{current?'Edit service zone':'Create service zone'}</p><p className="text-xs text-gray-500">Coverage, services and neighbouring areas</p></div>{current&&<span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold">EDITING</span>}</div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Zone name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Remera" className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-zana-primary"/>
          <label className="mb-1 block text-xs font-semibold text-gray-600">City</label><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Kigali" className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-zana-primary"/>
          <p className="mb-2 text-xs font-semibold text-gray-600">Available services</p>
          <div className="mb-4 grid grid-cols-2 gap-2">{serviceOptions.map(o=><label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-2 py-2 text-xs text-gray-700"><input type="checkbox" checked={services.includes(o.value)} onChange={()=>toggleService(o.value)} className="accent-[#00a082]"/>{o.label}</label>)}</div>
          <p className="mb-1 text-xs font-semibold text-gray-600">Connected neighbouring zones</p><p className="mb-2 text-[10px] text-gray-400">Requests may be matched across linked areas.</p>
          <div className="mb-4 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
            {zones.filter(z=>z.id!==selected).length===0?<p className="p-2 text-xs text-gray-400">Create another zone to connect areas.</p>:zones.filter(z=>z.id!==selected).map(z=><label key={z.id} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs"><input type="checkbox" checked={nearby.includes(z.id)} onChange={e=>setNearby(v=>e.target.checked?v.concat(z.id):v.filter(id=>id!==z.id))} className="accent-[#00a082]"/><span className="flex-1">{z.name}</span><span className="text-gray-400">{z.city}</span></label>)}
          </div>
          <button onClick={()=>setActive(v=>!v)} className={'mb-4 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm '+(active?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-gray-200 bg-gray-50 text-gray-500')}><span className="flex items-center gap-2"><Power size={15}/>Zone {active?'active':'inactive'}</span><b>{active?'ON':'OFF'}</b></button>
          {points.length>0&&<p className="mb-3 text-xs text-gray-500">{points.length} boundary points {points.length>=3?'· ready to save':'· add more points'}</p>}
          <button onClick={save} disabled={saving||!name.trim()||!city.trim()||(!selected&&points.length<3)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-zana-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{saving?<LoaderCircle size={16} className="animate-spin"/>:<Save size={16}/ >}{saving?'Saving…':current?'Save changes':'Create zone'}</button>
          {current&&<button onClick={newZone} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600">Cancel editing</button>}
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-gray-900">Operating zones</p><p className="text-xs text-gray-500">Choose a zone to edit it.</p></div><button onClick={refresh} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600">Refresh</button></div>
          {loading?<div className="flex items-center gap-2 py-5 text-xs text-gray-400"><LoaderCircle size={15} className="animate-spin"/>Loading zones…</div>:zones.length===0?<div className="rounded-xl bg-gray-50 p-4 text-center"><MapPin size={22} className="mx-auto mb-2 text-gray-300"/><p className="text-sm font-semibold text-gray-700">No zones created yet</p><p className="mt-1 text-xs text-gray-400">Draw your first service area.</p></div>:<div className="space-y-2">{zones.map(z=><div key={z.id} className={'flex items-center gap-2 rounded-xl border p-3 '+(selected===z.id?'border-zana-primary bg-emerald-50/50':'border-gray-100')}>
            <button onClick={()=>selectZone(z)} className="min-w-0 flex-1 text-left"><b className="block truncate text-sm text-gray-800">{z.name}</b><span className="mt-0.5 block text-[10px] text-gray-500">{z.city} · {z.serviceTypes.includes('ALL')?'All services':z.serviceTypes.join(', ')}</span></button>
            <span className={'rounded-full px-2 py-1 text-[9px] font-bold '+(z.active?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-500')}>{z.active?'ACTIVE':'OFF'}</span>
            <button onClick={()=>toggleZone(z)} title="Toggle zone" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Power size={14}/></button><button onClick={()=>selectZone(z)} title="Edit zone" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Pencil size={14}/></button>
          </div>)}</div>}
        </section>
      </div>
    </div>
    <p className="text-[11px] text-gray-400">Map data © OpenStreetMap contributors. Boundaries are stored as GeoJSON. Existing driver matching remains unchanged until active zones are configured.</p>
  </div></AdminShell>;
}

// Production admin route: polygon-based service-zone management.
