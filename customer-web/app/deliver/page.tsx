'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  UserRound,
  Camera,
  MapPin,
  Navigation,
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
import { stampPhoto } from '../../lib/photoCapture';
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
import InAppCamera from '../../components/InAppCamera';

type Dropoff = { lat: number; lng: number; address: string } | null;

export default function DeliverPage() {
  const { t } = useLang();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [selectedPackageType, setSelectedPackageType] = useState('');
  const [itemDetails, setItemDetails] = useState('');
  const [weight, setWeight] = useState<PackageWeight>('UNDER_1KG');

  const PACKAGE_TYPES = [
    ['Food', Utensils],
    ['Clothes', Shirt],
    ['Documents', FileText],
    ['Package', Package],
    ['Medicine', Pill],
    ['Groceries', ShoppingCart],
    ['Gift', Gift],
    ['Electronics', Smartphone],
    ['Shoes', Footprints],
    ['Books', BookOpen],
    ['Cosmetics', Sparkles],
    ['Household', House],
    ['Other', Plus],
  ] as const;
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

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
  const [quoteLoading, setQuoteLoading] = useState(false);
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
      setQuoteLoading(false);
      return;
    }
    setQuoteLoading(true);
    quoteDelivery({
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      weight,
    })
      .then((q) => setQuote({ fee: q.fee, distanceKm: q.distanceKm }))
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false));
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

  const handleCapture = () => {
    setError('');
    setCameraOpen(true);
  };

  const handleCapturedPhoto = async (base64: string) => {
    setCapturing(true);
    try {
      const me = await fetchMe().catch(() => null);
      const name = me?.firstName ? `${me.firstName}` : 'Zana customer';
      const stamped = await stampPhoto(base64, name);
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
          ? `${t(selectedPackageType)}: ${itemDetails.trim()}`
          : t(selectedPackageType).trim(),
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

  const canContinue = step === 1
    ? selectedPackageType.trim().length > 1
    : step === 2
      ? dropoff !== null
      : step === 3
        ? receiverPhone.replace(/\D/g, '').length >= 9
        : canSubmit;

  const stepTitles = [t('Your item'), t('Route'), t('Recipient'), t('Payment')];
  const stepDescriptions = [
    t('Tell us what needs to get there.'),
    t('Choose where the package starts and where it is going.'),
    t('Who should receive the package?'),
    t('Review the delivery and choose how to pay.'),
  ];

  const continueStep = () => {
    if (!canContinue) return;
    if (step < 4) setStep((current) => Math.min(4, current + 1));
    else handleSubmit();
  };

  return (
    <div className="animate-fade-in zana-page-enter zana-delivery-page pb-8">
      {cameraOpen && <InAppCamera onCapture={handleCapturedPhoto} onClose={() => setCameraOpen(false)} />}

      <div className="px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => step > 1 ? setStep((current) => current - 1) : router.back()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zana-border bg-[var(--zana-surface)] text-gray-700" aria-label={t('Go back')}>
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-zana-primary">ZANA DELIVERY</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-gray-900">{t('Send a package')}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-zana-primary-light px-3 py-1.5 text-[11px] font-bold text-zana-primary">{t('Step')} {step} / 4</span>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1.5" aria-label={t('Delivery steps')}>
          {[1, 2, 3, 4].map((number) => (
            <div key={number} className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className={"h-full rounded-full transition-all duration-300 " + (number <= step ? "w-full bg-zana-primary" : "w-0")} />
            </div>
          ))}
        </div>
        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-zana-primary">{t('Step')} {step}</p>
          <h2 className="mt-1 text-[25px] font-black leading-tight tracking-tight text-gray-900">{stepTitles[step - 1]}</h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">{stepDescriptions[step - 1]}</p>
        </div>
      </div>

      <div className="px-4 pt-5">
        {step === 1 && (
          <section className="zana-delivery-step animate-fade-slide-up space-y-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900">{t('What are you sending?')}</h3>
                <span className="text-[10px] font-medium text-gray-400">{t('Choose one')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {PACKAGE_TYPES.map(([label, Icon]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSelectedPackageType(label)}
                    aria-pressed={selectedPackageType === label}
                    className={"flex min-h-[94px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-all active:scale-[.97] " + (selectedPackageType === label
                      ? "border-zana-primary bg-zana-primary-light text-zana-primary shadow-[0_6px_18px_rgba(0,160,130,.10)]"
                      : "border-zana-border bg-[var(--zana-surface)] text-gray-600 hover:border-zana-primary/40")}
                  >
                    <span className={"grid h-10 w-10 place-items-center rounded-xl " + (selectedPackageType === label ? "bg-white/70" : "bg-gray-50")}>
                      <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-bold leading-tight">{t(label)}</span>
                    {selectedPackageType === label && <Check size={13} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zana-border bg-[var(--zana-surface)] p-4">
              <label className="mb-2 block text-sm font-bold text-gray-900">{t('Approximate weight')}</label>
              <div className="grid grid-cols-3 gap-2">
                {WEIGHT_OPTIONS.map((w) => (
                  <button key={w.value} type="button" onClick={() => setWeight(w.value)} aria-pressed={weight === w.value}
                    className={"rounded-xl border px-2 py-3 text-[11px] font-bold transition-colors " + (weight === w.value
                      ? "border-zana-primary bg-zana-primary-light text-zana-primary"
                      : "border-zana-border bg-[var(--zana-surface)] text-gray-600")}>
                    {t(w.label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-zana-border bg-[var(--zana-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{t('Add a package photo')}</h3>
                  <p className="mt-1 text-xs text-gray-500">{t('Optional, but it helps the courier identify your item.')}</p>
                </div>
                <Camera size={22} className="text-zana-primary" />
              </div>
              {imageBase64 ? (
                <div className="relative mt-3 h-36 overflow-hidden rounded-xl bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageBase64} alt={t('Package photo')} className="h-full w-full object-cover" />
                  <button onClick={() => setImageBase64(null)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white" aria-label={t('Remove photo')}>
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={handleCapture} disabled={capturing} className="flex items-center justify-center gap-2 rounded-xl bg-zana-primary px-3 py-3 text-xs font-bold text-white disabled:opacity-60">
                    {capturing ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                    {capturing ? t('Opening camera…') : t('Take a photo')}
                  </button>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zana-border px-3 py-3 text-xs font-bold text-gray-700">
                    <Plus size={15} /> {t('Choose from gallery')}
                    <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-zana-border bg-[var(--zana-surface)] p-4">
              <label className="mb-2 block text-sm font-bold text-gray-900">{t('Anything we should know?')} <span className="font-normal text-gray-400">({t('optional')})</span></label>
              <textarea value={itemDetails} onChange={(e) => setItemDetails(e.target.value)} placeholder={t('e.g. 2 plates of food and 1 bottle of juice')} rows={2}
                className="w-full resize-none rounded-xl border border-zana-border bg-transparent px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-zana-primary focus:ring-2 focus:ring-zana-primary/20" />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="zana-delivery-step animate-fade-slide-up space-y-4">
            <div className="overflow-hidden rounded-2xl border border-zana-border bg-[var(--zana-surface)]">
              <BrandedMap origin={pickup} destination={dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : undefined} draggablePickup
                onPickupChange={(c) => { setPickup(c); setStoredPickup(c); }} height={220} />
              <div className="space-y-3 p-4">
                <div className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zana-primary-light text-zana-primary"><MapPin size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t('Pickup location')}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{pickupAddress}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{t('Drag the green pin on the map to adjust.')}</p>
                  </div>
                </div>
                <div className="h-px bg-zana-border" />
                <div className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600"><Navigation size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t('Delivery location')}</p>
                    {dropoff ? (
                      <div className="mt-1 flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold text-gray-900">{dropoff.address}</p>
                        <button onClick={() => setDropoff(null)} className="text-xs font-bold text-zana-primary">{t('Change')}</button>
                      </div>
                    ) : (
                      <>
                        <input value={destQuery} onChange={(e) => setDestQuery(e.target.value)} placeholder={t('Search for the delivery address')}
                          className="mt-2 w-full rounded-xl border border-zana-border bg-[var(--zana-surface)] px-3 py-3 text-sm text-gray-900 outline-none focus:border-zana-primary focus:ring-2 focus:ring-zana-primary/20" />
                        {suggestions.length > 0 && (
                          <div className="mt-2 overflow-hidden rounded-xl border border-zana-border bg-[var(--zana-surface)]">
                            {suggestions.map((s) => (
                              <button key={s.placeId} onClick={() => handlePickSuggestion(s)} className="flex w-full items-center gap-3 border-b border-zana-border px-3 py-3 text-left last:border-0 hover:bg-gray-50">
                                <MapPin size={16} className="shrink-0 text-zana-primary" />
                                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{s.primaryText}</span><span className="mt-0.5 block truncate text-xs text-gray-500">{s.secondaryText}</span></span>
                                <ChevronRight size={15} className="text-gray-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!dropoff && (
              <div className="rounded-2xl border border-zana-border bg-[var(--zana-surface)] p-4">
                <div className="mb-2 flex items-center gap-2"><Package size={17} className="text-zana-primary" /><h3 className="text-sm font-bold text-gray-900">{t('Use a Zana location code')}</h3></div>
                <p className="mb-3 text-xs leading-5 text-gray-500">{t("Receiver can't explain their address? Ask them to send you their Zana location code.")}</p>
                <div className="flex gap-2">
                  <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="ZANA-8XK29"
                    className="min-w-0 flex-1 rounded-xl border border-zana-border bg-[var(--zana-surface)] px-3 py-3 text-sm text-gray-900 outline-none focus:border-zana-primary focus:ring-2 focus:ring-zana-primary/20" />
                  <button onClick={handleResolveCode} disabled={!codeInput.trim() || resolvingCode} className="rounded-xl bg-zana-primary px-4 text-xs font-bold text-white disabled:opacity-40">
                    {resolvingCode ? <Loader2 size={15} className="animate-spin" /> : t('Use code')}
                  </button>
                </div>
                {codeError && <p className="mt-2 text-xs text-zana-error">{codeError}</p>}
              </div>
            )}
            {quoteLoading && <p className="text-xs font-medium text-gray-500">{t('Calculating delivery price…')}</p>}
            {quote && <div className="flex items-center justify-between rounded-2xl bg-zana-primary-dark px-4 py-4 text-white">
              <div><p className="text-[11px] text-white/70">{t('Estimated delivery fee')}</p><p className="mt-1 text-xl font-black">{quote.fee.toLocaleString()} RWF</p></div>
              <p className="text-xs text-white/70">{quote.distanceKm} km</p>
            </div>}
          </section>
        )}

        {step === 3 && (
          <section className="zana-delivery-step animate-fade-slide-up space-y-4">
            <div className="rounded-2xl border border-zana-border bg-[var(--zana-surface)] p-5">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-zana-primary-light text-zana-primary"><UserRound size={23} /></div>
              <h3 className="text-base font-extrabold text-gray-900">{t('Recipient details')}</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">{t('We will contact the recipient when the courier is close.')}</p>
              <label className="mb-1.5 mt-5 block text-xs font-bold text-gray-700">{t('Recipient name')} <span className="font-normal text-gray-400">({t('optional')})</span></label>
              <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder={t("Receiver's name (optional)")}
                className="w-full rounded-xl border border-zana-border bg-[var(--zana-surface)] px-3 py-3 text-sm text-gray-900 outline-none focus:border-zana-primary focus:ring-2 focus:ring-zana-primary/20" />
              <label className="mb-1.5 mt-4 block text-xs font-bold text-gray-700">{t('Recipient phone number')}</label>
              <div className="flex gap-2">
                <div className="flex items-center rounded-xl border border-zana-border bg-gray-50 px-4 text-sm font-bold text-gray-700">+250</div>
                <input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="788 123 456" inputMode="numeric"
                  className="min-w-0 flex-1 rounded-xl border border-zana-border bg-[var(--zana-surface)] px-3 py-3 text-sm text-gray-900 outline-none focus:border-zana-primary focus:ring-2 focus:ring-zana-primary/20" />
              </div>
              <p className="mt-2 text-[11px] text-gray-500">{t('Enter a Rwanda mobile number with 9 digits.')}</p>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-zana-primary-light px-3 py-3 text-xs leading-5 text-zana-primary">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" /><p>{t('The recipient only receives the package. You place and pay for this delivery.')}</p>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="zana-delivery-step animate-fade-slide-up space-y-4">
            <div className="overflow-hidden rounded-2xl border border-zana-border bg-[var(--zana-surface)]">
              <div className="bg-zana-primary-dark p-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">{t('Delivery estimate')}</p>
                {quote ? <p className="mt-1 text-3xl font-black">{quote.fee.toLocaleString()} <span className="text-sm font-bold">RWF</span></p> : <p className="mt-1 text-sm font-semibold">{quoteLoading ? t('Calculating delivery price…') : t('Price unavailable. Go back and try again.')}</p>}
                {quote && <p className="mt-1 text-xs text-white/70">{quote.distanceKm} km · {t('Estimated distance')}</p>}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <Package size={17} className="mt-0.5 text-zana-primary" />
                  <div className="min-w-0"><p className="text-[10px] font-bold uppercase text-gray-400">{t('Your item')}</p><p className="mt-0.5 text-sm font-bold text-gray-900">{t(selectedPackageType)}{itemDetails.trim() ? ' · ' + itemDetails.trim() : ''}</p><p className="text-xs text-gray-500">{t(WEIGHT_OPTIONS.find((w) => w.value === weight)?.label ?? 'Under 1 kg')}</p></div>
                </div>
                <div className="h-px bg-zana-border" />
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[10px] font-bold uppercase text-gray-400">{t('Pickup')}</p><p className="mt-1 text-xs font-semibold leading-5 text-gray-800">{pickupAddress}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-gray-400">{t('Drop-off')}</p><p className="mt-1 text-xs font-semibold leading-5 text-gray-800">{dropoff?.address}</p></div>
                </div>
                <div className="h-px bg-zana-border" />
                <div><p className="text-[10px] font-bold uppercase text-gray-400">{t('Recipient')}</p><p className="mt-1 text-sm font-bold text-gray-900">{receiverName.trim() || t('Recipient')}</p><p className="text-xs text-gray-500">+250 {receiverPhone}</p></div>
              </div>
            </div>

            <div className="rounded-2xl border border-zana-border bg-[var(--zana-surface)] p-4">
              <h3 className="mb-3 text-sm font-extrabold text-gray-900">{t('Choose payment method')}</h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['WALLET', 'Wallet', CreditCard],
                  ['MOBILE_MONEY', 'MoMo', Smartphone],
                  ['CASH', 'Cash', Banknote],
                ] as const).map(([id, label, Icon]) => {
                  const short = id === 'WALLET' && walletBalance !== null && quote !== null && walletBalance < quote.fee;
                  return (
                    <button key={id} type="button" onClick={() => setPaymentMethod(id)} aria-pressed={paymentMethod === id}
                      className={"flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all " + (paymentMethod === id
                        ? short ? "border-red-300 bg-red-50 text-red-600" : "border-zana-primary bg-zana-primary-light text-zana-primary"
                        : "border-zana-border bg-[var(--zana-surface)] text-gray-600")}>
                      <Icon size={20} /><span className="text-[11px] font-bold">{t(label)}</span>
                      {paymentMethod === id && <Check size={13} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
              {paymentMethod === 'WALLET' && walletBalance !== null && quote && (
                <p className={"mt-3 text-xs font-semibold " + (walletBalance < quote.fee ? "text-red-500" : "text-gray-500")}>
                  {t('Wallet balance')}: {walletBalance.toLocaleString()} RWF
                  {walletBalance < quote.fee ? ' · ' + (quote.fee - walletBalance).toLocaleString() + ' RWF ' + t('short') : ''}
                </p>
              )}
              {paymentMethod === 'CASH' && <p className="mt-3 text-xs leading-5 text-gray-500">{t('Pay the courier when they collect the package.')}</p>}
              {paymentMethod === 'MOBILE_MONEY' && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-gray-500">{t("We'll send a payment prompt to this number:")}</p>
                  <div className="flex gap-2">
                    <span className="flex items-center rounded-xl border border-zana-border bg-gray-50 px-4 text-sm font-bold text-gray-700">+250</span>
                    <input value={momoPhone} onChange={(e) => setMomoPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="788 123 456" inputMode="numeric"
                      className="min-w-0 flex-1 rounded-xl border border-zana-border bg-[var(--zana-surface)] px-3 py-3 text-sm text-gray-900 outline-none focus:border-zana-primary focus:ring-2 focus:ring-zana-primary/20" />
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-[11px] leading-5 text-amber-900">{t('The rider inspects every package before pickup to meet Zana security compliance.')}</p>
              </div>
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-3 text-xs font-semibold text-red-700">{error}</p>}
          </section>
        )}

        {error && step !== 4 && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-3 text-xs font-semibold text-red-700">{error}</p>}

        <div className="sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-20 mt-6 flex items-center gap-2 rounded-2xl border border-zana-border bg-[var(--zana-surface)] p-2 shadow-[0_12px_36px_rgba(15,35,28,.12)]">
          {step > 1 && <button type="button" onClick={() => { setError(null); setStep((current) => current - 1); }} className="flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold text-gray-600">{t('Back')}</button>}
          <button type="button" onClick={continueStep} disabled={!canContinue || submitting || awaitingMomo || (step === 4 && (!quote || quoteLoading))}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-zana-primary px-5 text-sm font-extrabold text-white transition hover:brightness-95 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40">
            {awaitingMomo ? <><Loader2 size={17} className="animate-spin" />{t('Approve the MoMo prompt on your phone…')}</>
              : submitting ? <><Loader2 size={17} className="animate-spin" />{t('Requesting…')}</>
              : step === 4 ? <><Package size={17} />{t('Confirm delivery')}</>
              : <>{t('Continue')} <ArrowRight size={17} /></>}
          </button>
        </div>
      </div>

      <FastLoadingPopup visible={submitting && !awaitingMomo} messages={[t('Finding the best route…'), t('Calculating your fare…'), t('Confirming with Zana…')]} />
    </div>
  );
}
