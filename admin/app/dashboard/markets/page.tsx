'use client';
import { useEffect, useState } from 'react';
import { Plus, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getMarkets, createMarket, updateMarket } from '../../../lib/api/admin';

export default function MarketsPage() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', address: '', lat: '', lng: '' });
  const [saving, setSaving] = useState(false);

  const load = () => getMarkets().then(setMarkets).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    await createMarket({ ...form, lat: Number(form.lat), lng: Number(form.lng) });
    setShowForm(false);
    setForm({ name: '', description: '', address: '', lat: '', lng: '' });
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
              {[['name','Market name'],['description','Description'],['address','Address'],['lat','Latitude'],['lng','Longitude']].map(([k,p]) => (
                <input key={k} value={(form as any)[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} placeholder={p} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreate} disabled={saving || !form.name || !form.address} className="bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-40">Save</button>
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
