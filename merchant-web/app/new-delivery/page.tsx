'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, Navigation, Package, X, Loader2, Check } from 'lucide-react';
import { compressImage } from '../../lib/image';
import { searchPlaces, getPlaceCoordinates, PlaceSuggestion } from '../../lib/places-api';
import {
  WEIGHT_OPTIONS,
  PackageWeight,
  createDelivery,
  quoteDelivery,
  resolveLocationCode,
} from '../../lib/api/merchant';
import { ApiError } from '../../lib/api/client';

type Point = { lat: number; lng: number; address: string } | null;

export default function NewDeliveryPage() {
  const [itemDescription, setItemDescription] = useState('');
  const [weight, setWeight] = useState<PackageWeight>('UNDER_1KG');
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [pickup, setPickup] = useState<Point>(null);
  const [pickupQuery, setPickupQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>([]);

  const [dropoff, setDropoff] = useState<Point>(null);
  const [destQuery, setDestQuery] = useState('');
  const [destSuggestions, setDestSuggestions] = useState<PlaceSuggestion[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resolvingCode, setResolvingCode] = useState(false);

  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  const [quote, setQuote] = useState<{ fee: number; distanceKm: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pickupDebounce.current) clearTimeout(pickupDebounce.current);
    if (!pickupQuery.trim()) {
      setPickupSuggestions([]);
      return;
    }
    pickupDebounce.current = setTimeout(async () => {
      setPickupSuggestions(await searchPlaces(pickupQuery));
    }, 350);
  }, [pickupQuery]);

  useEffect(() => {
    if (destDebounce.current) clearTimeout(destDebounce.current);
    if (!destQuery.trim()) {
      setDestSuggestions([]);
      return;
    }
    destDebounce.current = setTimeout(async () => {
      setDestSuggestions(await searchPlaces(destQuery));
    }, 350);
  }, [destQuery]);

  useEffect(() => {
    if (!pickup || !dropoff) {
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
  }, [pickup, dropoff, weight]);

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
      setDestSuggestions([]);
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : 'Could not check that code.');
    } finally {
      setResolvingCode(false);
    }
  };

  const pickPlace = async (s: PlaceSuggestion, target: 'pickup' | 'dropoff') => {
    const place = await getPlaceCoordinates(s.placeId);
    if (!place) return;
    const point = { lat: place.lat, lng: place.lng, address: place.address };
    if (target === 'pickup') {
      setPickup(point);
      setPickupQuery('');
      setPickupSuggestions([]);
    } else {
      setDropoff(point);
      setDestQuery('');
      setDestSuggestions([]);
      setCodeInput('');
    }
  };

  const canSubmit =
    itemDescription.trim().length > 1 &&
    pickup !== null &&
    dropoff !== null &&
    receiverPhone.replace(/\D/g, '').length >= 9;

  const handleSubmit = async () => {
    if (!pickup || !dropoff) return;
    setSubmitting(true);
    setError(null);
    try {
      await createDelivery({
        itemDescription: itemDescription.trim(),
        weight,
        imageBase64: imageBase64 ?? undefined,
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        locationCode: codeInput.trim() || undefined,
        receiverName: receiverName.trim() || undefined,
        receiverPhone: `+250${receiverPhone.replace(/\D/g, '')}`,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the delivery.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setItemDescription('');
    setWeight('UNDER_1KG');
    setImageBase64(null);
    setDropoff(null);
    setCodeInput('');
    setReceiverName('');
    setReceiverPhone('');
    setQuote(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Delivery requested</h2>
        <p className="text-sm text-gray-500 mt-1">
          A Zana courier will be assigned shortly. You can track it on the Deliveries page.
        </p>
        <button
          onClick={resetForm}
          className="mt-6 bg-zana-primary text-white font-semibold px-6 py-2.5 rounded-lg text-sm"
        >
          Create another delivery
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">New delivery</h1>
        <p className="text-sm text-gray-500 mt-0.5">Send a package to your customer.</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-900 block mb-1.5">What are you sending?</label>
        <input
          value={itemDescription}
          onChange={(e) => setItemDescription(e.target.value)}
          placeholder="Documents, food, clothes, electronics…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-900 block mb-1.5">Approximate weight</label>
        <div className="grid grid-cols-3 gap-2">
          {WEIGHT_OPTIONS.map((w) => (
            <button
              key={w.value}
              onClick={() => setWeight(w.value)}
              className={`py-2 rounded-lg text-[11px] font-semibold border ${
                weight === w.value ? 'border-zana-primary bg-zana-primary/10 text-zana-primary' : 'border-gray-200 text-gray-600'
              }`}
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
          <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl py-7 cursor-pointer">
            <Camera size={22} className="text-gray-400" />
            <span className="text-xs text-gray-500">Upload a photo</span>
            <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
          </label>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-900 block mb-1.5">Pickup location</label>
        {pickup ? (
          <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
            <MapPin size={15} className="text-zana-primary mt-0.5 shrink-0" />
            <p className="text-sm text-gray-900 flex-1">{pickup.address}</p>
            <button onClick={() => setPickup(null)}>
              <X size={14} className="text-gray-400" />
            </button>
          </div>
        ) : (
          <>
            <input
              value={pickupQuery}
              onChange={(e) => setPickupQuery(e.target.value)}
              placeholder="Search for your pickup address"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
            {pickupSuggestions.map((s) => (
              <button
                key={s.placeId}
                onClick={() => pickPlace(s, 'pickup')}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 text-left mt-0.5"
              >
                <MapPin size={13} className="text-zana-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-900 truncate">{s.primaryText}</p>
                  <p className="text-[11px] text-gray-500 truncate">{s.secondaryText}</p>
                </div>
              </button>
            ))}
          </>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-900 block mb-1.5">Delivery location</label>
        {dropoff ? (
          <div className="flex items-start gap-2 bg-zana-primary/10 rounded-lg px-3 py-2.5">
            <Navigation size={15} className="text-zana-secondary-dark mt-0.5 shrink-0" />
            <p className="text-sm text-gray-900 flex-1">{dropoff.address}</p>
            <button onClick={() => setDropoff(null)}>
              <X size={14} className="text-gray-400" />
            </button>
          </div>
        ) : (
          <>
            <input
              value={destQuery}
              onChange={(e) => setDestQuery(e.target.value)}
              placeholder="Search for the customer's address"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
            {destSuggestions.map((s) => (
              <button
                key={s.placeId}
                onClick={() => pickPlace(s, 'dropoff')}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 text-left mt-0.5"
              >
                <MapPin size={13} className="text-zana-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-900 truncate">{s.primaryText}</p>
                  <p className="text-[11px] text-gray-500 truncate">{s.secondaryText}</p>
                </div>
              </button>
            ))}

            <div className="mt-3 bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-500 mb-2">
                Customer can&apos;t explain their address? Ask them to send their Zana location code.
              </p>
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="ZANA-8XK29"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                />
                <button
                  onClick={handleResolveCode}
                  disabled={!codeInput.trim() || resolvingCode}
                  className="bg-zana-primary text-white text-xs font-semibold px-4 rounded-lg disabled:opacity-40"
                >
                  {resolvingCode ? <Loader2 size={14} className="animate-spin" /> : 'Use code'}
                </button>
              </div>
              {codeError && <p className="text-[11px] text-red-600 mt-1.5">{codeError}</p>}
            </div>
          </>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-900 block mb-1.5">Receiver</label>
        <input
          value={receiverName}
          onChange={(e) => setReceiverName(e.target.value)}
          placeholder="Customer's name (optional)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
        />
        <div className="flex gap-2">
          <div className="border border-gray-200 rounded-lg px-3 flex items-center text-sm">+250</div>
          <input
            value={receiverPhone}
            onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="788 123 456"
            inputMode="numeric"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
          />
        </div>
      </div>

      {quote && (
        <div className="flex items-center justify-between bg-zana-primary rounded-xl px-4 py-3 text-white">
          <div>
            <p className="text-[11px] text-white/70">Delivery fee</p>
            <p className="text-lg font-bold">{quote.fee.toLocaleString()} RWF</p>
          </div>
          <p className="text-xs text-white/70">{quote.distanceKm} km</p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full bg-zana-primary text-white font-semibold py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
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
  );
}
