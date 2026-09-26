'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';
import { loadGoogleMaps } from '../../../lib/mapsLoader';
import AdminShell from '../../../components/AdminShell';
import { getMarkets, createMarket, updateMarket } from '../../../lib/api/admin';

export default function MarketsPage() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', address: '', pickupContactName: '', pickupPhone: '', lat: '', lng: '' });
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const [saving, setSaving] = useState(false);

  const load = () => getMarkets().then(setMarkets).catch(() => {});
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showForm) return;
    loadGoogleMaps().then(() => {
      if (!mapRef.current) return;
      const G = (window as any).google.maps;
      const center = { lat: -1.9536, lng: 30.0605 };
      map.current = new G.Map(mapRef.current, { center, zoom: 12.5, streetViewControl: false, mapTypeControl: false, fullscreenControl: true });
      const place = (lat: number, lng: number) => {
        if (marker.current) marker.current.setMap(null);
        marker.current = new G.Marker({ map: map.current, position: { lat, lng }, draggable: true });
        setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
        marker.current.addListener('dragend', (e: any) => setForm(f => ({ ...f, lat: e.latLng.lat().toFixed(6), lng: e.latLng.lng().toFixed(6) })));
      };
      map.current.addListener('click', (e: any) => place(e.latLng.lat(), e.latLng.lng()));
    }).catch(() => {});
    return () => { if (marker.current) marker.current.setMap(null); marker.current = null; map.current = null; };
  }, [showForm]);

  const handleCreate = async () => {
    setSaving(true);
    await createMarket({ ...form, lat: Number(form.lat), lng: Number(form.lng) });
    setShowForm(false);
    setForm({ name: '', description: '', address: '', pickupContactName: '', pickupPhone: '', lat: '', lng: '' });
    load();
    setSaving(false);
  };

  return (
    <AdminShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Markets</h1>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm"><Plus size={15} /> Add Market</button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
            <h2 className="font-semibold text-gray-900 mb-3">New Market</h2>
            <div className="grid grid-cols-2 gap-3">
              {[['name','Market name'],['description','Description'],['address','Address'],['pickupContactName','Pickup contact name'],['pickupPhone','Pickup phone']].map(([k,p]) => (
                <input key={k} value={(form as any)[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} placeholder={p} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              ))}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2"><p className="text-xs font-bold text-gray-700">Pickup location</p><span className="text-[10px] text-gray-400">{form.lat && form.lng ? form.lat + ', ' + form.lng : 'Click map to place pin'}</span></div>
              <div ref={mapRef} className="h-64 rounded-xl border border-gray-200 overflow-hidden bg-gray-100" />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreate} disabled={saving || !form.name || !form.address || !form.pickupPhone || !form.lat || !form.lng} className="bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-40">Save</button>
              <button onClick={() => setShowForm(false)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {markets.map(m => (
            <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin size={11} />{m.address}</p>
                  {m.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                  <p className="text-xs text-gray-500 mt-2">{m.agents?.length ?? 0} agent{m.agents?.length !== 1 ? 's' : ''} assigned</p>
                </div>
                <button onClick={() => updateMarket(m.id, { active: !m.active }).then(load)} className={`${m.active ? 'text-green-600' : 'text-gray-400'}`}>
                  {m.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
