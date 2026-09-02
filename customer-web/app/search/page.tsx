'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MapPin, Loader2, Minus, Plus, Users, Move } from 'lucide-react';
import { getStoredPickup, setStoredPickup } from '../../lib/location';
import { reverseGeocode } from '../../lib/geocode';
import { searchPlaces, getPlaceCoordinates, PlaceSuggestion } from '../../lib/places-api';
import { createRide, createRideGroup, fetchNearbyDrivers, NearbyDriver, estimateRide } from '../../lib/api/trips';
import { fetchWallet } from '../../lib/api/trips';

const MOTO_PAYMENT_OPTIONS = [
  { id: 'WALLET' as const, label: 'Zana Wallet', icon: '💳' },
  { id: 'MOBILE_MONEY' as const, label: 'Mobile Money', icon: '📱' },
  { id: 'CASH' as const, label: 'Cash', icon: '💵' },
];
import { resolveLocationCode } from '../../lib/api/deliveries';
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
  const [isZanaCode, setIsZanaCode] = useState(false);
  const [pickup, setPickup] = useState(getStoredPickup());
  const [pickupAddress, setPickupAddress] = useState('Locating…');
  const [nearby, setNearby] = useState<NearbyDriver[]>([]);
  const [booking, setBooking] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'WALLET' | 'MOBILE_MONEY'>('WALLET');
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<{address:string;lat:number;lng:number}|null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [fetchingFare, setFetchingFare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resolvingCode, setResolvingCode] = useState(false);
  const [motoCount, setMotoCount] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the pickup point to a human-readable address whenever it moves
  // (either from GPS or because the passenger dragged the pin).
  useEffect(() => {
    fetchWallet().then((w: any) => setWalletBalance(w.balance)).catch(() => {});
  }, []);

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

  const handleResolveCode = async () => {
    setResolvingCode(true);
    setCodeError(null);
    try {
      const resolved = await resolveLocationCode(codeInput);
      // Use the resolved location as the destination
      const urlParams = new URLSearchParams({
        name: resolved.address ?? resolved.code,
        address: resolved.address ?? `Shared location (${resolved.code})`,
        lat: String(resolved.lat),
        lng: String(resolved.lng),
        pickupLat: String(pickup.lat),
        pickupLng: String(pickup.lng),
        pickupAddress,
        locationCode: codeInput,
      });
      if (preselectedService) urlParams.set('service', preselectedService);
      router.push(`/ride-options?${urlParams.toString()}`);
    } catch {
      setCodeError('That code was not found or has expired.');
    } finally {
      setResolvingCode(false);
    }
  };

  const handlePickupDrag = (coords: { lat: number; lng: number }) => {
    setPickup(coords);
    setStoredPickup(coords);
  };

  const bookMoto = async () => {
    if (!pendingPlace) return;
    setShowPaymentPicker(false);
    setBooking(true);
    setError(null);
    const tripData = {
      serviceType: 'BIKE' as const,
      pickupAddress,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      destinationAddress: pendingPlace.address,
      destinationLat: pendingPlace.lat,
      destinationLng: pendingPlace.lng,
      paymentMethod,
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
  };

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    const place = await getPlaceCoordinates(suggestion.placeId);
    if (!place) {
      setError("Couldn't load that location. Try another.");
      return;
    }

    // Moto — fetch fare estimate then show payment picker
    if (isMoto) {
      const pending = { address: place.address, lat: place.lat, lng: place.lng };
      setPendingPlace(pending);
      setFetchingFare(true);
      try {
        const estimate = await estimateRide(
          { lat: pickup.lat, lng: pickup.lng },
          { lat: place.lat, lng: place.lng },
          'BIKE'
        );
        setEstimatedFare((estimate as any).BIKE ?? (estimate as any).fare ?? (estimate as any).estimatedFare ?? null);
      } catch { setEstimatedFare(null); }
      finally { setFetchingFare(false); }
      setShowPaymentPicker(true);
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

        {!query && suggestions.length === 0 && (
          <div className="bg-gray-50 rounded-xl p-3 mt-2">
            <p className="text-[11px] text-zana-muted mb-2">
              Receiver shared a Zana location code? Enter it as your destination.
            </p>
            <div className="flex gap-2">
              <input
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                placeholder="ZANA-8XK29"
                className="flex-1 border border-zana-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
              />
              <button
                onClick={handleResolveCode}
                disabled={!codeInput.trim() || resolvingCode}
                className="bg-zana-primary text-white text-xs font-semibold px-4 rounded-lg disabled:opacity-40"
              >
                {resolvingCode ? '…' : 'Use'}
              </button>
            </div>
            {codeError && <p className="text-[11px] text-zana-error mt-1.5">{codeError}</p>}
          </div>
        )}

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

      {/* Moto payment picker modal */}
      {showPaymentPicker && (() => {
        const totalFare = estimatedFare ? estimatedFare * motoCount : null;
        const walletInsufficient = paymentMethod === 'WALLET' && walletBalance !== null && totalFare !== null && walletBalance < totalFare;
        return (
          <div className="fixed inset-0 z-50 flex items-end bg-black/50">
            <div className="w-full bg-white rounded-t-3xl p-5">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

              {/* Header with fare */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-black text-lg text-gray-900">How will you pay?</h2>
                  <p className="text-xs text-gray-400">
                    {motoCount > 1 ? `${motoCount} seats` : '1 seat'} · Moto ride
                  </p>
                </div>
                <div className="text-right bg-zana-primary-light rounded-2xl px-4 py-2">
                  {fetchingFare ? (
                    <div className="w-4 h-4 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
                  ) : totalFare ? (
                    <>
                      <p className="text-xl font-black text-zana-primary">{totalFare.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-500">RWF total</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">Calculating...</p>
                  )}
                </div>
              </div>

              {/* Insufficient wallet warning */}
              {walletInsufficient && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
                  <span className="text-red-500 shrink-0">⚠️</span>
                  <p className="text-xs text-red-700">
                    <strong>Insufficient balance.</strong> Your wallet has {walletBalance?.toLocaleString()} RWF but this ride costs {totalFare?.toLocaleString()} RWF. Choose another payment method or top up.
                  </p>
                </div>
              )}

              {/* Payment options */}
              <div className="space-y-2 mb-5">
                {MOTO_PAYMENT_OPTIONS.map(({ id, label, icon }) => {
                  const isWallet = id === 'WALLET';
                  const insufficient = isWallet && walletInsufficient;
                  return (
                    <button key={id} onClick={() => setPaymentMethod(id)}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all ${
                        paymentMethod === id
                          ? insufficient ? 'border-red-400 bg-red-50' : 'border-zana-primary bg-zana-primary-light'
                          : 'border-gray-100 bg-white'
                      }`}>
                      <span className="text-2xl">{icon}</span>
                      <div className="flex-1 text-left">
                        <p className={`font-semibold text-sm ${paymentMethod === id ? insufficient ? 'text-red-600' : 'text-zana-primary' : 'text-gray-800'}`}>
                          {label}
                        </p>
                        {isWallet && walletBalance !== null && (
                          <p className={`text-xs ${insufficient ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                            Balance: {walletBalance.toLocaleString()} RWF
                            {insufficient && totalFare ? ` · need ${(totalFare - walletBalance).toLocaleString()} more` : ''}
                          </p>
                        )}
                      </div>
                      {paymentMethod === id && !insufficient && (
                        <div className="w-5 h-5 rounded-full bg-zana-primary flex items-center justify-center shrink-0">
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button onClick={bookMoto} disabled={booking || walletInsufficient || fetchingFare}
                className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50">
                {booking
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : `Confirm & Book${totalFare ? ` · ${totalFare.toLocaleString()} RWF` : ''}`}
              </button>
              <button onClick={() => { setShowPaymentPicker(false); setEstimatedFare(null); }}
                className="w-full text-center text-sm text-gray-400 mt-3 py-1">
                Cancel
              </button>
            </div>
          </div>
        );
      })()}
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
