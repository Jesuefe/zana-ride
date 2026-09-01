'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, Briefcase, MapPin, Plus, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api/client';

type SavedPlace = { id: string; label: string; address: string; lat: number; lng: number };

const QUICK_LABELS = ['Home', 'Work', 'Gym', 'School', 'Other'];
const LABEL_ICONS: Record<string, any> = { Home, Work: Briefcase };

export default function SavedPlacesPage() {
  const router = useRouter();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    api.get<SavedPlace[]>('/users/saved-places').then(setPlaces).catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!address.trim()) return;
    setSaving(true);
    try {
      // Geocode the address using Google Maps
      const geo = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyD4o-fXIpmGozrClaP1niC407cgRCrzSTI`
      ).then(r => r.json());
      const loc = geo.results[0]?.geometry?.location;
      const newPlace = await api.post<SavedPlace>('/users/saved-places', {
        label, address: geo.results[0]?.formatted_address ?? address,
        lat: loc?.lat ?? 0, lng: loc?.lng ?? 0,
      });
      setPlaces(p => [...p, newPlace]);
      setAdding(false);
      setAddress('');
    } catch (e: any) {
      alert(e.message ?? 'Could not save place');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/users/saved-places/${id}`);
      setPlaces(p => p.filter(pl => pl.id !== id));
    } catch {} finally { setDeleting(null); }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Saved Places</h1>
      </div>

      <div className="space-y-2 mb-4">
        {places.length === 0 && !adding && (
          <p className="text-sm text-gray-400 text-center py-6">No saved places yet. Add your home or work address.</p>
        )}
        {places.map(place => {
          const Icon = LABEL_ICONS[place.label] ?? MapPin;
          return (
            <div key={place.id} className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-zana-primary-light flex items-center justify-center shrink-0">
                <Icon size={16} className="text-zana-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900">{place.label}</p>
                <p className="text-xs text-gray-500 truncate">{place.address}</p>
              </div>
              <button onClick={() => handleDelete(place.id)} disabled={deleting === place.id}
                className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                {deleting === place.id ? <Loader2 size={13} className="animate-spin text-red-400" /> : <Trash2 size={13} className="text-red-400" />}
              </button>
            </div>
          );
        })}
      </div>

      {places.length < 5 && !adding && (
        <button onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-500 py-3.5 rounded-xl text-sm font-semibold">
          <Plus size={16} /> Add a place
        </button>
      )}

      {adding && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="font-semibold text-sm text-gray-900">New saved place</p>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Label</label>
            <div className="flex gap-2 flex-wrap">
              {QUICK_LABELS.map(l => (
                <button key={l} onClick={() => setLabel(l)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${label === l ? 'bg-zana-primary text-white border-zana-primary' : 'border-gray-200 text-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Enter address or place name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !address.trim()}
              className="flex-1 bg-zana-primary text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
