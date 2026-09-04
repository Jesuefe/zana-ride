'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, Briefcase, MapPin, Plus, Trash2, Loader2, Navigation } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { loadGoogleMaps } from '../../../lib/mapsLoader';
import { GOOGLE_MAPS_EMBED_KEY } from '../../../lib/config';

type SavedPlace = { id: string; label: string; address: string; lat: number; lng: number };
const QUICK_LABELS = ['Home', 'Work', 'Gym', 'School', 'Other'];
const LABEL_ICONS: Record<string, any> = { Home, Work: Briefcase };

export default function SavedPlacesPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('Home');
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    api.get<SavedPlace[]>('/users/saved-places').then(setPlaces).catch(() => {});
  }, []);

  useEffect(() => {
    if (!adding) return;
    loadGoogleMaps().then(() => {
      if (!inputRef.current) return;
      const G = (window as any).google.maps.places;
      autocompleteRef.current = new G.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'rw' },
        fields: ['formatted_address', 'geometry'],
      });
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place?.geometry?.location) {
          setSelectedPlace({
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    });
  }, [adding]);

  const handleAdd = async () => {
    if (!selectedPlace) return;
    setSaving(true);
    try {
      const newPlace = await api.post<SavedPlace>('/users/saved-places', { label, ...selectedPlace });
      setPlaces(p => [...p, newPlace]);
      setAdding(false);
      setSelectedPlace(null);
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

  // Fill the address straight from where the customer is standing, so
  // saving Home or Work needs no typing at all.
  const useCurrentLocation = () => {
    setLocating(true);
    setLocateError('');
    if (!navigator.geolocation) {
      setLocateError('Location is not available on this device.');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const G = (window as any).google?.maps;

        if (!G) {
          setSelectedPlace({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
          setLocating(false);
          return;
        }

        new G.Geocoder().geocode(
          { location: { lat, lng } },
          (results: any, status: any) => {
            const address =
              status === 'OK' && results?.[0]?.formatted_address
                ? results[0].formatted_address
                : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            setSelectedPlace({ address, lat, lng });
            if (inputRef.current) inputRef.current.value = address;
            setLocating(false);
          },
        );
      },
      () => {
        setLocateError('Could not read your location. Allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
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
          <p className="text-sm text-gray-400 text-center py-6">No saved places yet.</p>
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
          <div className="flex gap-2 flex-wrap">
            {QUICK_LABELS.map(l => (
              <button key={l} onClick={() => setLabel(l)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${label === l ? 'bg-zana-primary text-white border-zana-primary' : 'border-gray-200 text-gray-600'}`}>
                {l}
              </button>
            ))}
          </div>
          {/* No typing needed — pull the address from GPS */}
          <button
            onClick={useCurrentLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 border-2 border-zana-primary text-zana-primary font-bold text-sm py-3 rounded-xl disabled:opacity-50"
          >
            {locating ? (
              <>
                <span className="w-4 h-4 border-2 border-zana-primary/30 border-t-zana-primary rounded-full animate-spin" />
                Finding you…
              </>
            ) : (
              <>
                <Navigation size={14} />
                Use my current location
              </>
            )}
          </button>

          {locateError && <p className="text-xs text-red-600">{locateError}</p>}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Search address</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-zana-primary/30">
              <MapPin size={14} className="text-gray-400 shrink-0" />
              <input ref={inputRef} placeholder="Type an address..." 
                className="flex-1 text-sm outline-none" />
            </div>
            {selectedPlace && (
              <p className="text-xs text-zana-primary mt-1.5 flex items-center gap-1">
                <MapPin size={10} /> {selectedPlace.address}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setSelectedPlace(null); }} 
              className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !selectedPlace}
              className="flex-1 bg-zana-primary text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
