'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CarFront, Navigation, Radio } from 'lucide-react';
import { api } from '../../../lib/api/client';

type Market = { name?: string; address?: string; lat?: number; lng?: number };
type RideEstimate = { fare?: number; estimatedFare?: number; distanceKm?: number };

export default function AgentRidePage() {
  const [market, setMarket] = useState<Market | null>(null);
  const [destination, setDestination] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [serviceType, setServiceType] = useState<'BIKE'|'ECONOMY'|'COMFORT'>('BIKE');
  const [estimate, setEstimate] = useState<RideEstimate | null>(null);
  const [trip, setTrip] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.get<any>('/agent/me').then(r => setMarket(r.market ?? null)).catch(e => setNotice(e?.message ?? 'Could not load market'));
  }, []);

  const useLocation = () => {
    if (!navigator.geolocation) return setNotice('Location is not available on this device.');
    navigator.geolocation.getCurrentPosition(
      p => { setLat(String(p.coords.latitude)); setLng(String(p.coords.longitude)); setNotice('Current location captured.'); },
      () => setNotice('Could not read your location.')
    );
  };

  const quote = async () => {
    if (!market?.lat || !market?.lng || !lat || !lng || !destination.trim()) return setNotice('Enter the destination and coordinates first.');
    try {
      const q = await api.post<RideEstimate>('/rides/estimate', {
        serviceType, pickup: { lat: market.lat, lng: market.lng }, destination: { lat: Number(lat), lng: Number(lng) },
      });
      setEstimate(q);
      setNotice('');
    } catch (e:any) { setNotice(e?.message ?? 'Quote failed'); }
  };

  const book = async () => {
    if (!market?.lat || !market?.lng || !lat || !lng || !destination.trim()) return setNotice('Complete the trip details first.');
    setBusy(true); setNotice('');
    try {
      const result = await api.post<any>('/rides', {
        serviceType,
        pickupAddress: market.address || market.name || 'ZANA market',
        pickupLat: market.lat, pickupLng: market.lng,
        destinationAddress: destination.trim(),
        destinationLat: Number(lat), destinationLng: Number(lng),
        paymentMethod: 'CASH',
      });
      setTrip(result);
      setEstimate(result?.estimatedFare ? { fare: result.estimatedFare } : estimate);
    } catch (e:any) { setNotice(e?.message ?? 'Could not request ride'); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-10">
      <div className="max-w-xl mx-auto">
        <button onClick={() => history.back()} className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-5"><ArrowLeft size={17}/> Back</button>
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-zana-primary-light flex items-center justify-center"><CarFront size={20} className="text-zana-primary"/></div>
            <div><h1 className="text-xl font-black text-gray-900">Book a ZANA ride</h1><p className="text-xs text-gray-500">Agent booking · driver dispatch works exactly like a customer ride.</p></div>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4 mb-4">
            <p className="text-[10px] uppercase font-black tracking-wide text-gray-400">Pickup</p>
            <p className="font-bold text-gray-900 mt-1">{market?.name ?? 'Loading market…'}</p>
            <p className="text-xs text-gray-500">{market?.address ?? '—'}</p>
          </div>
          <label className="text-xs font-bold text-gray-600">Ride class</label>
          <div className="grid grid-cols-3 gap-2 mt-2 mb-4">
            {([['BIKE','Moto'],['ECONOMY','Economy'],['COMFORT','Premium']] as const).map(([v,l]) => <button key={v} onClick={()=>setServiceType(v)} className={`py-3 rounded-xl text-xs font-black border-2 ${serviceType===v?'border-zana-primary bg-zana-primary-light text-zana-primary':'border-gray-100 bg-white text-gray-600'}`}>{l}</button>)}
          </div>
          <label className="text-xs font-bold text-gray-600">Destination address</label>
          <input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Where is the passenger going?" className="w-full mt-2 border border-gray-200 rounded-xl px-3 py-3 text-sm mb-3"/>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] font-bold text-gray-500">Destination latitude</label><input value={lat} onChange={e=>setLat(e.target.value)} inputMode="decimal" placeholder="-1.95" className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/></div>
            <div><label className="text-[10px] font-bold text-gray-500">Destination longitude</label><input value={lng} onChange={e=>setLng(e.target.value)} inputMode="decimal" placeholder="30.06" className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/></div>
          </div>
          <button onClick={useLocation} className="w-full mt-3 border border-gray-200 rounded-xl py-2.5 text-xs font-bold text-gray-600 flex items-center justify-center gap-2"><Navigation size={14}/> Use my current location as destination</button>
          {estimate && <div className="mt-4 rounded-2xl bg-zana-primary-light p-4 flex justify-between items-center"><div><p className="text-[10px] uppercase font-black text-zana-primary">Estimated fare</p><p className="text-2xl font-black text-gray-900">{Number(estimate.fare ?? estimate.estimatedFare ?? 0).toLocaleString()} RWF</p></div><p className="text-xs text-gray-500">{estimate.distanceKm ? estimate.distanceKm + ' km' : ''}</p></div>}
          {notice && <p className="mt-3 text-xs font-semibold text-red-600">{notice}</p>}
          {!trip ? <div className="grid grid-cols-2 gap-2 mt-4"><button onClick={quote} disabled={busy} className="border border-zana-primary text-zana-primary font-bold py-3 rounded-xl text-sm">Get fare</button><button onClick={book} disabled={busy} className="bg-zana-primary text-white font-black py-3 rounded-xl text-sm">{busy?'Requesting…':'Request ride'}</button></div> :
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4"><div className="flex items-center gap-2 text-green-700"><Radio size={16}/><p className="font-black text-sm">Ride request is live</p></div><p className="text-xs text-green-700 mt-1">Trip ID: {trip.id}</p><p className="text-xs text-green-700 mt-1">The dispatch engine has sent the request to eligible online drivers.</p></div>}
        </div>
      </div>
    </div>
  );
}