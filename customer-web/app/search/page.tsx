'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MapPin, Loader2, Minus, Plus, Users } from 'lucide-react';
import { landmarks, Place } from '../../lib/places';
import { getStoredPickup } from '../../lib/location';
import { reverseGeocode } from '../../lib/geocode';
import { createRide, createRideGroup } from '../../lib/api/trips';
import { ApiError } from '../../lib/api/client';
import BrandedMap from '../../components/BrandedMap';

function SearchContent() {
  const router = useRouter();
  const params = useSearchParams();
  const preselectedService = params.get('service');
  const isMoto = preselectedService === 'BIKE';

  const [query, setQuery] = useState('');
  const [currentAddress, setCurrentAddress] = useState('Current Location');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motoCount, setMotoCount] = useState(1);
  const pickup = getStoredPickup();

  useEffect(() => {
    reverseGeocode(pickup.lat, pickup.lng).then((address) => {
      if (address) setCurrentAddress(address);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return landmarks;
    return landmarks.filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.address.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query]);

  const handleSelect = async (place: Place) => {
    // Moto has no vehicle choice to make — skip straight to booking.
    if (isMoto) {
      setBooking(true);
      setError(null);
      const tripData = {
        serviceType: 'BIKE' as const,
        pickupAddress: currentAddress,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destinationAddress: place.address,
        destinationLat: place.lat,
        destinationLng: place.lng,
      };
      try {
        if (motoCount > 1) {
          const trips = await createRideGroup(tripData, motoCount);
          const groupId = trips[0]?.groupId;
          router.push(`/tracking?groupId=${groupId}`);
        } else {
          const trip = await createRide(tripData);
          router.push(`/tracking?tripId=${trip.id}`);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
        setBooking(false);
      }
      return;
    }

    const urlParams = new URLSearchParams({
      name: place.name,
      address: place.address,
      lat: String(place.lat),
      lng: String(place.lng),
    });
    if (preselectedService) urlParams.set('service', preselectedService);
    router.push(`/ride-options?${urlParams.toString()}`);
  };

  return (
    <div className="animate-fade-in">
      <div className="relative">
        <BrandedMap
          origin={pickup}
          showNearbyCars
          vehicleType={preselectedService === 'BIKE' ? 'BIKE' : 'ECONOMY'}
          height={160}
        />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/95 px-3 py-1 rounded-full text-[11px] text-zana-muted shadow">
          Drivers nearby, ready to pick you up
        </div>
      </div>

      <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 bg-gray-100 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-zana-muted pb-1.5 border-b border-gray-200">
            <span className="w-2 h-2 rounded-full bg-zana-primary shrink-0" />
            <span className="truncate">{currentAddress}</span>
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

      {isMoto && (
        <div className="flex items-center justify-between bg-zana-primary-light rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-zana-primary" />
            <span className="text-sm text-gray-900">How many motos?</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMotoCount((c) => Math.max(1, c - 1))}
              disabled={motoCount <= 1}
              className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm disabled:opacity-40"
            >
              <Minus size={13} />
            </button>
            <span className="text-sm font-semibold text-gray-900 w-4 text-center">{motoCount}</span>
            <button
              onClick={() => setMotoCount((c) => Math.min(8, c + 1))}
              disabled={motoCount >= 8}
              className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm disabled:opacity-40"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}

      {booking && (
        <div className="flex items-center gap-2 text-sm text-zana-muted mb-4">
          <Loader2 size={16} className="animate-spin" />
          {motoCount > 1 ? `Booking ${motoCount} motos…` : 'Booking your moto…'}
        </div>
      )}
      {error && <p className="text-xs text-zana-error mb-4">{error}</p>}

      <p className="text-[11px] uppercase tracking-wide text-zana-muted mb-2 px-1">Popular in Kigali</p>
      <div className="space-y-1">
        {results.map((p, i) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p)}
            disabled={booking}
            className={`animate-fade-slide-up stagger-${Math.min(i + 1, 6)} w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50`}
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
