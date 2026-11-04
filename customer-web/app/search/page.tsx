'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Clock3, Home, MapPin, MapPinned, Search, X, Loader2, ChevronRight } from 'lucide-react';
import BrandedMap from '../../components/BrandedMap';
import { getStoredPickup, setStoredPickup } from '../../lib/location';
import { reverseGeocode } from '../../lib/geocode';
import { searchPlaces, getPlaceCoordinates, PlaceSuggestion } from '../../lib/places-api';
import { api } from '../../lib/api/client';
import { haptic } from '../../lib/haptics';
import { useLang } from '../../lib/LangContext';
import ZanaLoading from '../../components/ZanaLoading';
import '../zana-search.css';

type SavedPlace={id:string;label:string;address:string;lat:number;lng:number};
type RecentPlace={id:string;name:string;address:string;lat:number;lng:number};
type Destination={name:string;address:string;lat:number;lng:number};
const POPULAR=[
 {name:'Kigali City Centre',area:'Nyarugenge · Kigali',query:'Kigali City Centre, Rwanda'},
 {name:'Kigali Convention Centre',area:'Kimihurura · Kigali',query:'Kigali Convention Centre, Rwanda'},
 {name:'Kigali International Airport',area:'Kanombe · Kigali',query:'Kigali International Airport, Rwanda'},
 {name:'Nyabugogo Taxi Park',area:'Nyabugogo · Kigali',query:'Nyabugogo Taxi Park, Kigali, Rwanda'},
 {name:'Kimironko Market',area:'Kimironko · Kigali',query:'Kimironko Market, Kigali, Rwanda'},
];
const distance=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>{const r=(v:number)=>v*Math.PI/180,d1=r(b.lat-a.lat),d2=r(b.lng-a.lng),x=Math.sin(d1/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(d2/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
const distanceText=(km:number)=>km<1?`${Math.max(100,Math.round(km*1000/50)*50)} m away`:`${km.toFixed(1)} km away`;
function Highlight({text,query}:{text:string;query:string}){const i=text.toLowerCase().indexOf(query.toLowerCase());if(i<0||!query)return <>{text}</>;return <>{text.slice(0,i)}<strong>{text.slice(i,i+query.length)}</strong>{text.slice(i+query.length)}</>;}

function SearchContent(){
 const {t}=useLang(),router=useRouter(),inputRef=useRef<HTMLInputElement>(null),touch=useRef<{y:number;time:number}|null>(null),debounce=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [pickup,setPickup]=useState(getStoredPickup()),[pickupAddress,setPickupAddress]=useState('Current location'),[pickupEditing,setPickupEditing]=useState(false),[pickupQuery,setPickupQuery]=useState('');
 const [query,setQuery]=useState(''),[suggestions,setSuggestions]=useState<PlaceSuggestion[]>([]);
 const [saved,setSaved]=useState<SavedPlace[]>([]),[recents,setRecents]=useState<RecentPlace[]>([]),[loadingHome,setLoadingHome]=useState(true),[searching,setSearching]=useState(false);
 const [mapPicker,setMapPicker]=useState(false),[mapPoint,setMapPoint]=useState<{lat:number;lng:number}|null>(null),[mapAddress,setMapAddress]=useState(''),[resolvingMap,setResolvingMap]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const id=window.setTimeout(()=>inputRef.current?.focus(),80);return()=>window.clearTimeout(id);},[]);
 useEffect(()=>{let live=true;api.get<SavedPlace[]>('/users/saved-places').then(v=>{if(live)setSaved(Array.isArray(v)?v:[])}).catch(()=>{});
 api.get<any[]>('/rides/history').then(rows=>{if(!live||!Array.isArray(rows))return;const seen=new Set<string>(),out:RecentPlace[]=[];for(const r of rows){const lat=Number(r?.destinationLat),lng=Number(r?.destinationLng),address=r?.destinationAddress;if(!address||!Number.isFinite(lat)||!Number.isFinite(lng))continue;const k=`${lat.toFixed(4)}:${lng.toFixed(4)}`;if(seen.has(k))continue;seen.add(k);out.push({id:String(r.id??k),name:String(r.destinationName??address.split(',')[0]),address,lat,lng});if(out.length===5)break;}setRecents(out);}).catch(()=>{}).finally(()=>{if(live)setLoadingHome(false)});const fallback=window.setTimeout(()=>{if(live)setLoadingHome(false)},1500);return()=>{live=false;window.clearTimeout(fallback)};},[]);
 useEffect(()=>{let live=true;reverseGeocode(pickup.lat,pickup.lng).then(a=>{if(live&&a)setPickupAddress(a)});return()=>{live=false}},[pickup.lat,pickup.lng]);
 useEffect(()=>{if(debounce.current)clearTimeout(debounce.current);const q=query.trim();if(q.length<2){setSuggestions([]);setSearching(false);return;}setSearching(true);debounce.current=setTimeout(async()=>{try{const rows=await searchPlaces(q,pickup);setSuggestions(rows);setSearching(false);}catch{setSearching(false);setSuggestions([])}},300);return()=>{if(debounce.current)clearTimeout(debounce.current)};},[query,pickup.lat,pickup.lng]);
 const home=saved.find(p=>p.label.toLowerCase()==='home'),work=saved.find(p=>p.label.toLowerCase()==='work');
 const matchingSaved=useMemo(()=>query.trim().length>=2?saved.filter(p=>`${p.label} ${p.address}`.toLowerCase().includes(query.toLowerCase())):[],[saved,query]);
 const select=useCallback((p:Destination)=>{haptic('tap');const q=new URLSearchParams({name:p.name,address:p.address,lat:String(p.lat),lng:String(p.lng),pickupLat:String(pickup.lat),pickupLng:String(pickup.lng),pickupAddress});router.push(`/ride-options?${q.toString()}`);},[pickup,pickupAddress,router]);
 const selectSaved=(p:SavedPlace)=>select({name:p.label,address:p.address,lat:p.lat,lng:p.lng});
 const selectRecent=(p:RecentPlace)=>select({name:p.name,address:p.address,lat:p.lat,lng:p.lng});
 const selectPrediction=async(s:PlaceSuggestion)=>{setError('');const p=await getPlaceCoordinates(s.placeId);if(p)select({name:s.primaryText,address:p.address,lat:p.lat,lng:p.lng});else setError(t("Couldn't load that location. Try another result."));};
 const popular=async(p:{name:string;query:string})=>{setSearching(true);try{const rows=await searchPlaces(p.query,pickup),place=rows[0]?await getPlaceCoordinates(rows[0].placeId):null;if(place)select({name:p.name,address:place.address,lat:place.lat,lng:place.lng});else{setQuery(p.name);setSearching(false)}}catch{setSearching(false)}};
 const searchPickup=async()=>{if(pickupQuery.trim().length<2)return;const rows=await searchPlaces(pickupQuery,pickup),p=rows[0]?await getPlaceCoordinates(rows[0].placeId):null;if(!p)return;setPickup({lat:p.lat,lng:p.lng});setStoredPickup({lat:p.lat,lng:p.lng});setPickupAddress(p.address);setPickupEditing(false);setPickupQuery('');inputRef.current?.focus();};
 const pinOnMap=()=>{inputRef.current?.blur();setMapPicker(true);setMapPoint(null);setMapAddress('')};
 useEffect(()=>{let live=true;if(!mapPoint){setMapAddress('');return;}setResolvingMap(true);reverseGeocode(mapPoint.lat,mapPoint.lng).then(a=>{if(live)setMapAddress(a??`${mapPoint.lat.toFixed(5)}, ${mapPoint.lng.toFixed(5)}`)}).finally(()=>{if(live)setResolvingMap(false)});return()=>{live=false}},[mapPoint?.lat,mapPoint?.lng]);
 const confirmPin=()=>{if(mapPoint)select({name:mapAddress||'Pinned location',address:mapAddress||'Pinned location',lat:mapPoint.lat,lng:mapPoint.lng})};
 const onTouchEnd=(y:number)=>{if(!touch.current)return;const d=y-touch.current.y,ms=Date.now()-touch.current.time;touch.current=null;if(d>90||(d>45&&ms<240))router.back();};
 const active=query.trim().length>=2;
 const groups=[{title:t('Saved places'),items:matchingSaved},{title:t('Places & landmarks'),items:suggestions.filter(s=>!(s.types??[]).some(v=>v==='route'||v==='street_address'))},{title:t('Streets & addresses'),items:suggestions.filter(s=>(s.types??[]).some(v=>v==='route'||v==='street_address'))}];
 const style=(i:number)=>({'--row-index':i} as CSSProperties);
 return <main className="zana-search-screen" onTouchStart={e=>{const panel=(e.target as HTMLElement).closest('.zana-search-content') as HTMLElement|null;if(panel&&panel.scrollTop>0)return;touch.current={y:e.touches[0].clientY,time:Date.now()}}} onTouchEnd={e=>onTouchEnd(e.changedTouches[0].clientY)}>
  <div className="zana-search-map" aria-hidden="true"><BrandedMap origin={pickup} height="100%"/></div><div className="zana-search-map-dim" aria-hidden="true"/>
  <section className="zana-search-sheet" aria-label={t('Choose your destination')}>
   <header className="zana-search-header"><button className="zana-search-back" onClick={()=>router.back()} aria-label={t('Back to home')}><ArrowLeft size={21}/></button><div><span className="zana-search-eyebrow">ZANA · KIGALI</span><h1>{t('Where to?')}</h1></div><button className="zana-search-close" onClick={()=>router.back()} aria-label={t('Close destination search')}><X size={18}/></button></header>
   <div className="zana-search-fields"><div className="zana-search-route-rail" aria-hidden="true"><span className="pickup-dot"/><i/><span className="destination-square"/></div><div className="zana-search-field-stack">
    <button className="zana-search-pickup" onClick={()=>{setPickupEditing(v=>!v);setPickupQuery('');}} aria-label={t('Edit pickup location')}><span className="zana-search-field-label">{t('PICKUP')}</span><strong>{pickupAddress}</strong><span className="zana-search-edit">{t('Edit')}</span></button>
    {pickupEditing&&<div className="zana-search-pickup-edit"><input id="zana-pickup-edit" value={pickupQuery} onChange={e=>setPickupQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')searchPickup()}} placeholder={t('Search pickup location')}/><button onClick={searchPickup} aria-label={t('Search pickup')}><Search size={16}/></button></div>}
    <div className="zana-search-destination-row"><div className="zana-search-destination-input"><span className="zana-search-field-label">{t('DESTINATION')}</span><input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Search a landmark, area or address')} aria-label={t('Destination')} autoComplete="off" autoFocus/></div><button className="zana-search-map-button" onClick={pinOnMap}><MapPinned size={15}/><span>{t('Choose on map')}</span></button></div>
   </div></div>
   <div className="zana-search-content" aria-live="polite">
    {active?<>{searching&&<div className="zana-search-skeletons" aria-label={t('Loading places')}><i/><i/><i/><i/></div>}
     {!searching&&matchingSaved.length===0&&suggestions.length===0&&<div className="zana-search-empty"><MapPin size={22}/><strong>{t('No matching places')}</strong><span>{t('Try another spelling, or pin the destination on the map.')}</span><button onClick={pinOnMap}>{t('Pin it on the map')}</button></div>}
     {!searching&&groups.map(g=>g.items.length>0&&<section className="zana-search-result-group" key={g.title}><h2>{g.title}</h2>{g.items.map((p:any,i:number)=>p.placeId?<button key={p.placeId} className="zana-search-result" style={style(i)} onClick={()=>selectPrediction(p)}><span className="zana-search-result-icon"><MapPin size={17}/></span><span className="zana-search-result-copy"><strong><Highlight text={p.primaryText} query={query}/></strong><small>{p.secondaryText||t('Kigali, Rwanda')}</small></span><span className="zana-search-distance">{p.distanceMeters!=null?distanceText(p.distanceMeters/1000):t('Nearby')}</span></button>:<button key={p.id} className="zana-search-result" style={style(i)} onClick={()=>selectSaved(p)}><span className="zana-search-result-icon"><MapPin size={17}/></span><span className="zana-search-result-copy"><strong><Highlight text={p.label} query={query}/></strong><small>{p.address}</small></span><span className="zana-search-distance">{distanceText(distance(pickup,p))}</span></button>)}</section>)}</>
    :<><section className="zana-search-saved"><div className="zana-search-section-heading"><h2>{t('Saved places')}</h2><button onClick={()=>router.push('/profile/places')}>{t('Manage')}</button></div><div className="zana-search-saved-grid">{[{label:'Home',place:home,icon:Home},{label:'Work',place:work,icon:Briefcase}].map(v=>{const Icon=v.icon;return <button key={v.label} className="zana-search-saved-card" onClick={()=>v.place?selectSaved(v.place):router.push('/profile/places')}><span><Icon size={18}/></span><strong>{t(v.label)}</strong><small>{v.place?.address??t('Add a place')}</small>{!v.place&&<Plus size={14} className="zana-search-saved-plus"/>}</button>})}</div></section>
    <section className="zana-search-recents"><div className="zana-search-section-heading"><h2>{t('Recent destinations')}</h2><span>{recents.length?t('Last 5'):''}</span></div>{loadingHome?<div className="zana-search-skeletons compact"><i/><i/><i/></div>:recents.length?recents.map((p,i)=><button key={p.id} className="zana-search-result" style={style(i)} onClick={()=>selectRecent(p)}><span className="zana-search-result-icon recent"><Clock3 size={16}/></span><span className="zana-search-result-copy"><strong>{p.name}</strong><small>{p.address}</small></span><span className="zana-search-distance">{distanceText(distance(pickup,p))}</span></button>):<p className="zana-search-subtle-empty">{t('Your recent destinations will appear here.')}</p>}</section>
    <section className="zana-search-popular"><div className="zana-search-section-heading"><h2>{t('Popular in Kigali')}</h2><span>{t('Explore the city')}</span></div>{POPULAR.map((p,i)=><button key={p.name} className="zana-search-popular-row" style={style(i)} onClick={()=>popular(p)}><span className="zana-search-popular-number">0{i+1}</span><span><strong>{t(p.name)}</strong><small>{p.area}</small></span><ChevronRight size={16}/></button>)}</section></>}
    {error&&<p className="zana-search-error" role="alert">{error}</p>}
   </div>
  </section>
  {mapPicker&&<div className="zana-search-map-modal" role="dialog" aria-modal="true" aria-label={t('Choose destination on map')}><div className="zana-search-map-modal-head"><button onClick={()=>setMapPicker(false)} aria-label={t('Back to search')}><ArrowLeft size={19}/></button><div><strong>{t('Choose on map')}</strong><small>{t('Tap the map to pin your destination')}</small></div><button onClick={()=>setMapPicker(false)} aria-label={t('Close map')}><X size={18}/></button></div><div className="zana-search-map-modal-canvas"><BrandedMap origin={pickup} height="100%" onMapClick={setMapPoint}/>{mapPoint&&<div className="zana-search-map-pin"><MapPin size={34} fill="#00A082"/></div>}</div><div className="zana-search-map-modal-footer"><div><strong>{mapAddress||(mapPoint?t('Pinned location'):t('Tap anywhere on the map'))}</strong><small>{mapPoint?t('Destination pin selected'):t('Move the map to choose a location')}</small></div><button onClick={confirmPin} disabled={!mapPoint||resolvingMap}>{resolvingMap?<Loader2 size={16} className="animate-spin"/>:t('Confirm destination')}</button></div></div>}
 </main>;
}
export default function SearchPage(){return <Suspense fallback={<ZanaLoading label="Loading your ZANA experience"/>}><SearchContent/></Suspense>;}
