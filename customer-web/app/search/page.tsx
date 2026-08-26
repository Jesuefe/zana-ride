'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { landmarks, Place } from '../../lib/places';

function SearchContent() {
  const router = useRouter();
  const params = useSearchParams();
  const preselectedService = params.get('service');
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return landmarks;
    return landmarks.filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.address.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query]);

  const handleSelect = (place: Place) => {
    const params = new URLSearchParams({
      name: place.name,
      address: place.address,
      lat: String(place.lat),
      lng: String(place.lng),
    });
    if (preselectedService) params.set('service', preselectedService);
    router.push(`/ride-options?${params.toString()}`);
  };

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 bg-gray-100 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-zana-muted pb-1.5 border-b border-gray-200">
            <span className="w-2 h-2 rounded-full bg-zana-primary" /> Current Location
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Where are you going?"
            className="w-full bg-transparent pt-1.5 text-sm focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      <p className="text-[11px] uppercase tracking-wide text-zana-muted mb-2 px-1">Popular in Kigali</p>
      <div className="space-y-1">
        {results.map((p, i) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p)}
            className={`animate-fade-slide-up stagger-${Math.min(i + 1, 6)} w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors`}
          >
            <div className="w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center shrink-0">
              <MapPin size={15} className="text-zana-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-900 truncate">{p.name}</p>
              <p className="text-xs text-zana-muted truncate">{p.address}</p>
            </div>
          </button>
        ))}
        {results.length === 0 && <p className="text-sm text-zana-muted px-2 py-4">No matching places.</p>}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
