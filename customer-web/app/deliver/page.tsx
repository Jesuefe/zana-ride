'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Camera,
  MapPin,
  Navigation,
  Phone,
  Package,
  X,
  Loader2,
  Check,
  Utensils,
  Shirt,
  FileText,
  Pill,
  ShoppingCart,
  Gift,
  Smartphone,
  Footprints,
  BookOpen,
  Sparkles,
  House,
  Plus,
  CreditCard,
  Banknote,
  ShieldCheck,
} from 'lucide-react';
import { getStoredPickup, setStoredPickup } from '../../lib/location';
import { useLang } from '../../lib/LangContext';
import { reverseGeocode } from '../../lib/geocode';
import { searchPlaces, getPlaceCoordinates, PlaceSuggestion } from '../../lib/places-api';
import { compressImage } from '../../lib/image';
import { capturePhoto, stampPhoto } from '../../lib/photoCapture';
import { fetchMe } from '../../lib/api/auth';
import FastLoadingPopup from '../../components/FastLoadingPopup';
import {
  WEIGHT_OPTIONS,
  PackageWeight,
  resolveLocationCode,
  quoteDelivery,
  createDelivery,
  checkDeliveryPaymentStatus,
} from '../../lib/api/deliveries';
import { ApiError } from '../../lib/api/client';
import BrandedMap from '../../components/BrandedMap';

type Dropoff = { lat: number; lng: number; address: string } | null;

export default function DeliverPage() {
  const { t } = useLang();
  const router = useRouter();

  const [selectedPackageType, setSelectedPackageType] = useState('');
  const [itemDetails, setItemDetails] = useState('');
  const [weight, setWeight] = useState<PackageWeight>('UNDER_1KG');

  const PACKAGE_TYPES = [
    [t('Food'), Utensils],
    [t('Clothes'), Shirt],
    [t('Documents'), FileText],
    [t('Package'), Package],
    [t('Medicine'), Pill],
    [t('Groceries'), ShoppingCart],
    [t('Gift'), Gift],
    [t('Electronics'), Smartphone],
    [t('Shoes'), Footprints],
    [t('Books'), BookOpen],
    [t('Cosmetics'), Sparkles],
    [t('Household'), House],
    [t('Other'), Plus],
  ] as const;
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

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
  const [awaitingMomo, setAwaitingMomo] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'MOBILE_MONEY' | 'CASH'>('WALLET');
  const [momoPhone, setMomoPhone] = useState('');
  useEffect(() => {
    fetchMe().then((me) => { if (me?.phone) setMomoPhone(me.phone.replace(/^\+250/, '')); }).catch(() => {});
  }, []);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    import('../../lib/api/trips').then(({ fetchWallet }) => {
      fetchWallet().then((w: any) => setWalletBalance(w.balance)).catch(() => {});
    });
  }, []);

  useEffect(() => {
    reverseGeocode(pickup.lat, pickup.lng).then((a) => setPickupAddress(a ?? t('Current location')));
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
      setError(t('Could not process that image.'));
    }
  };

  const handleCapture = async () => {
    setCapturing(true);
    setError('');
    try {
      const shot = await capturePhoto();
      if (!shot) { setCapturing(false); return; }

      const me = await fetchMe().catch(() => null);
      const name = me?.firstName ? `${me.firstName}` : 'Zana customer';
      const stamped = await stampPhoto(shot.base64, name, shot.lat != null && shot.lng != null
        ? { lat: shot.lat, lng: shot.lng } : undefined);

      setImageBase64(stamped);
    } catch {
      setError(t('Could not take that photo. Try again.'));
    } finally {
      setCapturing(false);
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
        address: resolved.address ?? `${t('Shared location')} (${resolved.code})`,
      });
      setDestQuery('');
      setSuggestions([]);
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : t('Could not check that code.'));
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
    selectedPackageType.trim().length > 1 && dropoff !== null && receiverPhone.replace(/\D/g, '').length >= 9 &&
    (paymentMethod !== 'MOBILE_MONEY' || momoPhone.replace(/\D/g, '').length >= 9);

  const handleSubmit = async () => {
    if (!dropoff) return;
    setSubmitting(true);
    setError(null);
    try {
      const delivery = await createDelivery({
        itemDescription: itemDetails.trim()
          ? `${selectedPackageType}: ${itemDetails.trim()}`
          : selectedPackageType.trim(),
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
        paymentMethod,
        momoPhone: paymentMethod === 'MOBILE_MONEY' ? `+250${momoPhone.replace(/\D/g, '')}` : undefined,
      });

      if (paymentMethod === 'MOBILE_MONEY') {
        setAwaitingMomo(true);
        const confirmed = await new Promise<boolean>((resolve) => {
          const interval = setInterval(async () => {
            try {
              const { status } = await checkDeliveryPaymentStatus(delivery.id);
              if (status === 'confirmed') { clearInterval(interval); resolve(true); }
              if (status === 'failed') { clearInterval(interval); resolve(false); }
            } catch { /* keep polling */ }
          }, 3000);
          setTimeout(() => { clearInterval(interval); resolve(false); }, 90_000);
        });
        setAwaitingMomo(false);
        if (!confirmed) {
          setError(t('Payment was not confirmed. The delivery was cancelled — you can try again.'));
          setSubmitting(false);
          return;
        }
      }

      router.push(`/orders?highlight=${delivery.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '';
      if (msg.includes('INSUFFICIENT_WALLET_BALANCE')) {
        const p = msg.split(':');
        setError(
          t('Not enough in your wallet. Balance {{balance}} RWF, delivery costs {{cost}} RWF.').replace('{{balance}}', Number(p[1] ?? 0).toLocaleString()).replace('{{cost}}', Number(p[2] ?? 0).toLocaleString())
        );
      } else if (msg.includes('MOMO_CHARGE_FAILED')) {
        setError(t('Could not reach Mobile Money. Check the number and try again.'));
      } else {
        setError(msg || t('Could not create the delivery.'));
      }
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
          <h1 className="text-lg font-bold text-gray-900">{t('Send a package')}</h1>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">{t('What are you sending?')}</label>
          <div className="grid grid-cols-4 gap-2">
            {PACKAGE_TYPES.map(([label, Icon]) => (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedPackageType(label)}
                className={`flex flex-col items-center justify-center gap-1.5 min-h-20 rounded-xl border-1.5 px-1.5 py-2 transition-all active:scale-95 ${
                  selectedPackageType === label
                    ? 'border-zana-primary bg-zana-primary-light text-zana-primary'
                    : 'border-zana-border bg-white text-gray-700'
                }`}
                style={{ borderWidth: 1.5 }}
              >
                <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                <span className="text-[10px] font-bold text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-3">
            <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">
              {t('Additional details')} <span className="font-normal text-gray-400">({t('optional')})</span>
            </label>
            <textarea
              value={itemDetails}
              onChange={(e) => setItemDetails(e.target.value)}
              placeholder={t('e.g. 2 plates of food and 1 bottle of juice')}
              rows={2}
              className="w-full border border-zana-border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">{t('Approximate weight')}</label>
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
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">{t('Photo of the item')}</label>
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
            <>
              <button
                type="button"
                onClick={handleCapture}
                disabled={capturing}
                className="w-full flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-zana-border rounded-xl py-7 disabled:opacity-60"
              >
                <Camera size={22} className="text-zana-muted" />
                <span className="text-xs text-zana-muted">
                  {capturing ? t('Opening camera…') : t('Take a photo')}
                </span>
              </button>
              <label className="block text-center text-[11px] text-zana-primary font-semibold mt-2 cursor-pointer">
                {t('or choose from your gallery')}
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
            </>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">{t('Pickup location')}</label>
          <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
            <MapPin size={15} className="text-zana-primary mt-0.5 shrink-0" />
            <p className="text-sm text-gray-900">{pickupAddress}</p>
          </div>
          <p className="text-[11px] text-zana-muted mt-1">{t('Drag the green pin on the map to adjust.')}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">{t('Delivery location')}</label>

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
                placeholder={t('Search for the delivery address')}
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
                  {t("Receiver can't explain their address? Ask them to send you their Zana location code.")}
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
                    {resolvingCode ? <Loader2 size={14} className="animate-spin" /> : t('Use code')}
                  </button>
                </div>
                {codeError && <p className="text-[11px] text-zana-error mt-1.5">{codeError}</p>}
              </div>
            </>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-900 block mb-1.5">{t('Receiver')}</label>
          <input
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            placeholder={t("Receiver's name (optional)")}
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
              <p className="text-[11px] text-white/70">{t('Delivery fee')}</p>
              <p className="text-lg font-bold">{quote.fee.toLocaleString()} RWF</p>
            </div>
            <p className="text-xs text-white/70">{quote.distanceKm} km</p>
          </div>
        )}

        {error && <p className="text-xs text-zana-error">{error}</p>}

        {quote && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t('How will you pay?')}</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['WALLET', 'Wallet', CreditCard],
                ['MOBILE_MONEY', 'MoMo', Smartphone],
                ['CASH', 'Cash', Banknote],
              ] as const).map(([id, label, Icon]) => {
                const short =
                  id === 'WALLET' && walletBalance !== null && walletBalance < quote.fee;
                return (
                  <button
                    key={id}
                    onClick={() => setPaymentMethod(id)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all ${
                      paymentMethod === id
                        ? short
                          ? 'border-red-400 bg-red-50'
                          : 'border-zana-primary bg-zana-primary-light'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span className={`text-[11px] font-bold ${
                      paymentMethod === id
                        ? short ? 'text-red-600' : 'text-zana-primary'
                        : 'text-gray-600'
                    }`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {paymentMethod === 'WALLET' && walletBalance !== null && (
              <p className={`text-[11px] mt-2 font-semibold ${
                walletBalance < quote.fee ? 'text-red-500' : 'text-gray-500'
              }`}>
                Wallet balance: {walletBalance.toLocaleString()} RWF
                {walletBalance < quote.fee
                  ? ` · ${(quote.fee - walletBalance).toLocaleString()} RWF short`
                  : ''}
              </p>
            )}

            {paymentMethod === 'CASH' && (
              <p className="text-[11px] text-gray-500 mt-2">
                Pay the rider when they collect the package.
              </p>
            )}

            {paymentMethod === 'MOBILE_MONEY' && (
              <div className="mt-2">
                <p className="text-[11px] text-gray-500 mb-1.5">
                  We'll send a payment prompt to this number:
                </p>
                <div className="flex gap-2">
                  <div className="border border-zana-border rounded-lg px-3 flex items-center text-sm">+250</div>
                  <input
                    value={momoPhone}
                    onChange={(e) => setMomoPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="788 123 456"
                    inputMode="numeric"
                    className="flex-1 border border-zana-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                  />
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mt-3">
              <ShieldCheck size={17} className="text-amber-500 shrink-0 mt-0.5" strokeWidth={1.8} aria-hidden="true" />
              <p className="text-[10px] text-amber-800 leading-relaxed">
                The rider inspects every package before pickup to meet Zana security compliance.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting || awaitingMomo}
          className="w-full bg-zana-primary text-white font-semibold py-3.5 rounded-xl disabled:opacity-40 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {awaitingMomo ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {t('Approve the MoMo prompt on your phone…')}
            </>
          ) : submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {t('Requesting…')}
            </>
          ) : (
            <>
              <Package size={16} /> Request Delivery
            </>
          )}
        </button>

        <FastLoadingPopup
          visible={submitting && !awaitingMomo}
          messages={[t('Finding the best route…'), t('Calculating your fare…'), t('Confirming with Zana…')]}
        />
      </div>
    </div>
  );
}
