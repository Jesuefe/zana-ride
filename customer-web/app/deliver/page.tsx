'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Camera, MapPin, Navigation, Phone, Package, X, Loader2, Check } from 'lucide-react';
import { getStoredPickup, setStoredPickup } from '../../lib/location';
import { reverseGeocode } from '../../lib/geocode';
import { searchPlaces, getPlaceCoordinates, PlaceSuggestion } from '../../lib/places-api';
import { compressImage } from '../../lib/image';
import {
  WEIGHT_OPTIONS,
  PackageWeight,
  resolveLocationCode,
  quoteDelivery,
  createDelivery,
} from '../../lib/api/deliveries';
import { ApiError } from '../../lib/api/client';
import BrandedMap from '../../components/BrandedMap';

type Dropoff = { lat: number; lng: number; address: string } | null;

export default function DeliverPage() {
  const router = useRouter();

  const [itemDescription, setItemDescription] = useState('');
  const [weight, setWeight] = useState<PackageWeight>('UNDER_1KG');
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [pickup, setPickup] = useState(getStoredPickup());
  const [pickupAddress, setPickupAddress] = useState('Locating…');

  const [dropoff, setDropoff] = useState<Dropoff>(null);
  const [destQuery, setDestQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resolvingCode, setResolvingCode] = useState(false);

  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  const [quote, setQuote] = useState<{ fee: number; distanceKm: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    reverseGeocode(pickup.lat, pickup.lng).then((a) => setPickupAddress(a ?? 'Current location'));
  }, [pickup.lat, pickup.lng]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!destQuery.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSuggestions(await searchPlaces(destQuery));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [destQuery]);

  // Re-price whenever the route or weight changes.
  useEffect(() => {
    if (!dropoff) {
      setQuote(null);
      return;
    }
    quoteDelivery({
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      weight,
    })
      .then((q) => setQuote({ fee: q.fee, distanceKm: q.distanceKm }))
      .catch(() => setQuote(null));
  }, [dropoff, weight, pickup.lat, pickup.lng]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImageBase64(await compressImage(file));
    } catch {
      setError('Could not process that image.');
    }
  };

  const handleResolveCode = async () => {
    setResolvingCode(true);
    setCodeError(null);
    try {
      const resolved = await resolveLocationCode(codeInput);
      setDropoff({
        lat: resolved.lat,
        lng: resolved.lng,
        address: resolved.address ?? `Shared location (${resolved.code})`,
      });
      setDestQuery('');
      setSuggestions([]);
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : 'Could not check that code.');
    } finally {
      setResolvingCode(false);
    }
  };

  const handlePickSuggestion = async (s: PlaceSuggestion) => {
    const place = await getPlaceCoordinates(s.placeId);
    if (!place) return;
    setDropoff({ lat: place.lat, lng: place.lng, address: place.address });
    setDestQuery('');
    setSuggestions([]);
    setCodeInput('');
  };

  const canSubmit =
    itemDescription.trim().length > 1 && dropoff !== null && receiverPhone.replace(/\D/g, '').length >= 9;

  const handleSubmit = async () => {
    if (!dropoff) return;
    setSubmitting(true);
    setError(null);
    try {
      const delivery = await createDelivery({
        itemDescription: itemDescription.trim(),
        weight,
        imageBase64: imageBase64 ?? undefined,
        pickupAddress,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        locationCode: codeInput.trim() || undefined,
        receiverName: receiverName.trim() || undefined,
        receiverPhone: `+250${receiverPhone.replace(/\D/g, '')}`,
      });
      router.push(`/orders?highlight=${delivery.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the delivery.');
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in pb-6">
      <BrandedMap
        origin={pickup}
        destination={dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : undefined}
        draggablePickup
        onPickupChange={(c) => {
          setPickup(c);
          setStoredPickup(c);
        }}
        height={180}
      />

      <div className="p-4 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Send a package</h1>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">What are you sending?</label>
          <input
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="Documents, food, clothes, electronics…"
            className="w-full border border-zana-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">Approximate weight</label>
          <div className="grid grid-cols-3 gap-2">
            {WEIGHT_OPTIONS.map((w) => (
              <button
                key={w.value}
                onClick={() => setWeight(w.value)}
                className={`py-2 rounded-lg text-[11px] font-semibold border-1.5 ${
                  weight === w.value
                    ? 'border-zana-primary bg-zana-primary-light text-zana-primary'
                    : 'border-zana-border text-gray-600'
                }`}
                style={{ borderWidth: 1.5 }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">Photo of the item</label>
          {imageBase64 ? (
            <div className="relative w-full h-40 rounded-xl overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageBase64} alt="Package" className="w-full h-full object-cover" />
              <button
                onClick={() => setImageBase64(null)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-zana-border rounded-xl py-7 cursor-pointer">
              <Camera size={22} className="text-zana-muted" />
              <span className="text-xs text-zana-muted">Take or upload a photo</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleImage} className="hidden" />
            </label>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">Pickup location</label>
          <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
            <MapPin size={15} className="text-zana-primary mt-0.5 shrink-0" />
            <p className="text-sm text-gray-900">{pickupAddress}</p>
          </div>
          <p className="text-[11px] text-zana-muted mt-1">Drag the green pin on the map to adjust.</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">Delivery location</label>

          {dropoff ? (
            <div className="flex items-start gap-2 bg-zana-primary-light rounded-lg px-3 py-2.5">
              <Navigation size={15} className="text-zana-secondary-dark mt-0.5 shrink-0" />
              <p className="text-sm text-gray-900 flex-1">{dropoff.address}</p>
              <button onClick={() => setDropoff(null)} className="shrink-0">
                <X size={14} className="text-zana-muted" />
              </button>
            </div>
          ) : (
            <>
              <input
                value={destQuery}
                onChange={(e) => setDestQuery(e.target.value)}
                placeholder="Search for the delivery address"
                className="w-full border border-zana-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
              />
              {suggestions.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {suggestions.map((s) => (
                    <button
                      key={s.placeId}
                      onClick={() => handlePickSuggestion(s)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <MapPin size={13} className="text-zana-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-900 truncate">{s.primaryText}</p>
                        <p className="text-[11px] text-zana-muted truncate">{s.secondaryText}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3 bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-zana-muted mb-2">
                  Receiver can&apos;t explain their address? Ask them to send you their Zana location code.
                </p>
                <div className="flex gap-2">
                  <input
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="ZANA-8XK29"
                    className="flex-1 border border-zana-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                  />
                  <button
                    onClick={handleResolveCode}
                    disabled={!codeInput.trim() || resolvingCode}
                    className="bg-zana-primary text-white text-xs font-semibold px-4 rounded-lg disabled:opacity-40"
                  >
                    {resolvingCode ? <Loader2 size={14} className="animate-spin" /> : 'Use code'}
                  </button>
                </div>
                {codeError && <p className="text-[11px] text-zana-error mt-1.5">{codeError}</p>}
              </div>
            </>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">Receiver</label>
          <input
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            placeholder="Receiver's name (optional)"
            className="w-full border border-zana-border rounded-lg px-3 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
          />
          <div className="flex gap-2">
            <div className="border border-zana-border rounded-lg px-3 flex items-center text-sm">+250</div>
            <input
              value={receiverPhone}
              onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="788 123 456"
              inputMode="numeric"
              className="flex-1 border border-zana-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>
        </div>

        {quote && (
          <div className="flex items-center justify-between bg-zana-primary-dark rounded-xl px-4 py-3 text-white">
            <div>
              <p className="text-[11px] text-white/70">Delivery fee</p>
              <p className="text-lg font-bold">{quote.fee.toLocaleString()} RWF</p>
            </div>
            <p className="text-xs text-white/70">{quote.distanceKm} km</p>
          </div>
        )}

        {error && <p className="text-xs text-zana-error">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-zana-primary text-white font-semibold py-3.5 rounded-xl disabled:opacity-40 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Requesting…
            </>
          ) : (
            <>
              <Package size={16} /> Request Delivery
            </>
          )}
        </button>
      </div>
    </div>
  );
}
