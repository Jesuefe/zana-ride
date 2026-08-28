'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MapPin, Loader2, Minus, Plus, Users, Move } from 'lucide-react';
import { getStoredPickup, setStoredPickup } from '../../lib/location';
import { reverseGeocode } from '../../lib/geocode';
import { searchPlaces, getPlaceCoordinates, PlaceSuggestion } from '../../lib/places-api';
import { createRide, createRideGroup, fetchNearbyDrivers, NearbyDriver } from '../../lib/api/trips';
import { ApiError } from '../../lib/api/client';
import BrandedMap from '../../components/BrandedMap';

function SearchContent() {
  const router = useRouter();
  const params = useSearchParams();
  const preselectedService = params.get('service');
  const isMoto = preselectedService === 'BIKE';
  const vehicleType = isMoto ? 'BIKE' : 'ECONOMY';

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickup, setPickup] = useState(getStoredPickup());
  const [pickupAddress, setPickupAddress] = useState('Locating…');
  const [nearby, setNearby] = useState<NearbyDriver[]>([]);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motoCount, setMotoCount] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the pickup point to a human-readable address whenever it moves
  // (either from GPS or because the passenger dragged the pin).
  useEffect(() => {
    reverseGeocode(pickup.lat, pickup.lng).then((address) => {
      setPickupAddress(address ?? 'Current location');
    });
  }, [pickup.lat, pickup.lng]);

  // Poll for real available drivers around the pickup point so the map
  // reflects actual supply, not decoration.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchNearbyDrivers(pickup.lat, pickup.lng, vehicleType)
        .then((drivers) => {
          if (!cancelled) setNearby(drivers);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pickup.lat, pickup.lng, vehicleType]);

  // Debounced Places autocomplete — waits for a pause in typing so we don't
  // fire a billed request on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(query);
      setSuggestions(results);
      setSearching(false);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handlePickupDrag = (coords: { lat: number; lng: number }) => {
    setPickup(coords);
    setStoredPickup(coords);
  };

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    const place = await getPlaceCoordinates(suggestion.placeId);
    if (!place) {
      setError("Couldn't load that location. Try another.");
      return;
    }

    // Moto has no vehicle choice to make — skip straight to booking.
    if (isMoto) {
      setBooking(true);
      setError(null);
      const tripData = {
        serviceType: 'BIKE' as const,
        pickupAddress,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destinationAddress: place.address,
        destinationLat: place.lat,
        destinationLng: place.lng,
      };
      try {
        if (motoCount > 1) {
          const trips = await createRideGroup(tripData, motoCount);
          router.push(`/tracking?groupId=${trips[0]?.groupId}`);
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
      name: suggestion.primaryText,
      address: place.address,
      lat: String(place.lat),
      lng: String(place.lng),
      pickupLat: String(pickup.lat),
      pickupLng: String(pickup.lng),
      pickupAddress,
    });
    if (preselectedService) urlParams.set('service', preselectedService);
    router.push(`/ride-options?${urlParams.toString()}`);
  };

  return (
    <div className="animate-fade-in">
      <div className="relative">
        <BrandedMap
          origin={pickup}
          nearbyDrivers={nearby}
          vehicleType={vehicleType}
          draggablePickup
          onPickupChange={handlePickupDrag}
          height={200}
        />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/95 px-3 py-1 rounded-full text-[11px] text-zana-muted shadow">
          <Move size={11} />
          Drag the green pin to adjust pickup
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
              <span className="truncate">{pickupAddress}</span>
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

        {nearby.length > 0 && !query && (
          <p className="text-xs text-zana-muted mb-3">
            {nearby.length} {isMoto ? 'moto' : 'car'}
            {nearby.length === 1 ? '' : 's'} available nearby
          </p>
        )}

        {searching && <p className="text-xs text-zana-muted px-1 py-2">Searching…</p>}

        <div className="space-y-1">
          {suggestions.map((s, i) => (
            <button
              key={s.placeId}
              onClick={() => handleSelect(s)}
              disabled={booking}
              className={`animate-fade-slide-up stagger-${Math.min(i + 1, 6)} w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50`}
            >
              <div className="w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center shrink-0">
                <MapPin size={15} className="text-zana-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-900 truncate">{s.primaryText}</p>
                <p className="text-xs text-zana-muted truncate">{s.secondaryText}</p>
              </div>
            </button>
          ))}
          {query && !searching && suggestions.length === 0 && (
            <p className="text-sm text-zana-muted px-2 py-4">No matching places.</p>
          )}
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
