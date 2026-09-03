'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight, Clock, MapPin, Check } from 'lucide-react';
import { estimateRide, createRide, ServiceType, fetchWallet } from '../../lib/api/trips';
import { ApiError } from '../../lib/api/client';
import BrandedMap from '../../components/BrandedMap';
import { getStoredPickup } from '../../lib/location';

type Option = { service: ServiceType; label: string; sub: string; icon: string };

const OPTIONS: Option[] = [
  { service: 'ECONOMY', label: 'Basic Car', sub: 'Comfortable · up to 4', icon: '🚗' },
  { service: 'COMFORT', label: 'Premium Car', sub: 'Top-rated drivers · up to 4', icon: '🚙' },
];

const PAYMENT_OPTIONS = [
  {
    id: 'CASH' as const,
    label: 'Cash',
    sub: 'Pay the driver directly',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    id: 'WALLET' as const,
    label: 'Zana Wallet',
    sub: 'Deducted at trip end',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        <circle cx="17" cy="12" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'MOBILE_MONEY' as const,
    label: 'Mobile Money',
    sub: 'MoMo request at trip end',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="2"/>
        <path d="M9 18h6" strokeLinecap="round"/>
        <circle cx="12" cy="7" r="1" fill="currentColor"/>
      </svg>
    ),
  },
];

function RideOptionsContent() {
  const router = useRouter();
  const params = useSearchParams();

  const destName = params.get('name') ?? '';
  const destAddress = params.get('address') ?? '';
  const destLat = Number(params.get('lat'));
  const destLng = Number(params.get('lng'));
  const preselected = params.get('service') as ServiceType | null;
  const passedPickupLat = Number(params.get('pickupLat'));
  const passedPickupLng = Number(params.get('pickupLng'));
  const passedPickupAddress = params.get('pickupAddress') ?? 'Current Location';

  const [pickup] = useState(
    Number.isFinite(passedPickupLat) && passedPickupLat !== 0
      ? { lat: passedPickupLat, lng: passedPickupLng }
      : getStoredPickup(),
  );

  const [fares, setFares] = useState<Record<ServiceType, number>>({ BIKE: 0, ECONOMY: 0, COMFORT: 0 });
  const [loadingFares, setLoadingFares] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [selected, setSelected] = useState<ServiceType | null>(preselected ?? null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'WALLET' | 'MOBILE_MONEY'>('WALLET');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distanceText: string; durationText: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [economy, comfort] = await Promise.all([
          estimateRide(pickup, { lat: destLat, lng: destLng }, 'ECONOMY'),
          estimateRide(pickup, { lat: destLat, lng: destLng }, 'COMFORT'),
        ]);
        setFares({ BIKE: 0, ECONOMY: economy.fare, COMFORT: comfort.fare });
      } catch {
        setFares({ BIKE: 0, ECONOMY: 1500, COMFORT: 2500 });
      } finally {
        setLoadingFares(false);
      }
    })();
    // Also fetch wallet balance to warn if insufficient
    fetchWallet().then((w: any) => setWalletBalance(w.balance)).catch(() => {});
  }, []);

  const handleSelect = (service: ServiceType) => {
    setSelected(service);
    setStep('confirm');
  };

  const selectedFare = selected ? fares[selected] : 0;
  const walletInsufficient = paymentMethod === 'WALLET' && walletBalance !== null && walletBalance < selectedFare;

  const handleBook = async () => {
    if (!selected) return;
    setBooking(true);
    setError(null);
    try {
      const trip = await createRide({
        serviceType: selected,
        pickupAddress: passedPickupAddress,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destinationAddress: destAddress,
        destinationLat: destLat,
        destinationLng: destLng,
        paymentMethod,
      });
      router.push(`/tracking?tripId=${trip.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
      setBooking(false);
    }
  };

  const selectedOption = OPTIONS.find(o => o.service === selected);

  // ─── STEP 1: Select ride type ───────────────────────────────────────
  if (step === 'select') {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Map */}
        <div className="relative flex-shrink-0" style={{ height: '38%' }}>
          <BrandedMap
            origin={pickup}
            destination={{ lat: destLat, lng: destLng }}
            height="100%"
            onRouteInfo={setRouteInfo}
          />
          <button
            onClick={() => router.back()}
            className="absolute top-10 left-4 z-10 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
        </div>

        {/* Bottom sheet */}
        <div className="flex-1 bg-white rounded-t-3xl -mt-5 overflow-y-auto shadow-2xl">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />

          {/* Route summary */}
          <div className="px-4 pt-3 pb-4 border-b border-gray-100">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-zana-primary" />
                <div className="w-0.5 h-6 bg-gray-200" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm text-gray-700 truncate">{passedPickupAddress}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{destAddress || destName}</p>
              </div>
              {routeInfo && (
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-zana-primary">{routeInfo.durationText}</p>
                  <p className="text-xs text-gray-400">{routeInfo.distanceText}</p>
                </div>
              )}
            </div>
          </div>

          {/* Ride options */}
          <div className="px-4 pt-4 pb-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Choose a ride</p>
            <div className="space-y-3">
              {OPTIONS.map(opt => (
                <button
                  key={opt.service}
                  onClick={() => handleSelect(opt.service)}
                  className="w-full flex items-center gap-4 bg-white border-2 border-gray-100 hover:border-zana-primary rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.98]"
                >
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0 text-3xl">
                    {opt.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                    {routeInfo && (
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={10} className="text-gray-400" />
                        <p className="text-[10px] text-gray-400">{routeInfo.durationText}</p>
                      </div>
                    )}
                  </div>

                  {/* Fare */}
                  <div className="text-right shrink-0">
                    {loadingFares ? (
                      <div className="w-16 h-5 bg-gray-100 rounded animate-pulse" />
                    ) : (
                      <>
                        <p className="text-lg font-black text-gray-900">
                          {fares[opt.service].toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">RWF</p>
                      </>
                    )}
                  </div>

                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>

            {/* Payment method — shown on step 1 so customer sees it before confirming */}
            <div className="mt-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Payment method</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_OPTIONS.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => setPaymentMethod(id)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all ${
                      paymentMethod === id
                        ? 'border-zana-primary bg-zana-primary-light'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className={paymentMethod === id ? 'text-zana-primary' : 'text-gray-400'}>
                      {icon}
                    </div>
                    <p className={`text-[11px] font-bold ${paymentMethod === id ? 'text-zana-primary' : 'text-gray-600'}`}>
                      {label}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 2: Confirm fare + payment ────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Map */}
      <div className="relative flex-shrink-0" style={{ height: '38%' }}>
        <BrandedMap
          origin={pickup}
          destination={{ lat: destLat, lng: destLng }}
          height="100%"
          onRouteInfo={setRouteInfo}
        />
        <button
          onClick={() => setStep('select')}
          className="absolute top-10 left-4 z-10 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"
        >
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
      </div>

      {/* Bottom sheet */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-5 overflow-y-auto shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />

        <div className="px-4 pt-4 pb-6 space-y-4">
          {/* Selected ride + fare */}
          <div className="bg-zana-primary-light rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedOption?.icon}</span>
                <div>
                  <p className="font-bold text-gray-900">{selectedOption?.label}</p>
                  <p className="text-xs text-gray-500">{selectedOption?.sub}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-zana-primary">
                  {selected ? fares[selected].toLocaleString() : '—'}
                </p>
                <p className="text-xs text-gray-400">RWF</p>
              </div>
            </div>

            {/* Route */}
            <div className="mt-3 pt-3 border-t border-zana-primary/10 flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                <div className="w-2 h-2 rounded-full bg-zana-primary" />
                <div className="w-0.5 h-5 bg-gray-300" />
                <div className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs text-gray-600 truncate">{passedPickupAddress}</p>
                <p className="text-xs font-semibold text-gray-800 truncate">{destAddress || destName}</p>
              </div>
              {routeInfo && (
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-zana-primary">{routeInfo.durationText}</p>
                  <p className="text-[10px] text-gray-400">{routeInfo.distanceText}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment method */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">💳 How will you pay?</p>
            <div className="space-y-2">
              {PAYMENT_OPTIONS.map(({ id, label, sub, icon }) => {
                const isWallet = id === 'WALLET';
                const insufficient = isWallet && walletBalance !== null && walletBalance < selectedFare;
                return (
                  <button
                    key={id}
                    onClick={() => setPaymentMethod(id)}
                    className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 border-2 transition-all ${
                      paymentMethod === id
                        ? insufficient ? 'border-red-400 bg-red-50' : 'border-zana-primary bg-zana-primary-light'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className={`shrink-0 ${paymentMethod === id ? insufficient ? 'text-red-500' : 'text-zana-primary' : 'text-gray-400'}`}>
                      {icon}
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-semibold ${paymentMethod === id ? insufficient ? 'text-red-600' : 'text-zana-primary' : 'text-gray-800'}`}>
                        {label}
                      </p>
                      {isWallet && walletBalance !== null ? (
                        <p className={`text-xs ${insufficient ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                          {insufficient
                            ? `Balance: ${walletBalance.toLocaleString()} RWF — need ${(selectedFare - walletBalance).toLocaleString()} more`
                            : `Balance: ${walletBalance.toLocaleString()} RWF`}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">{sub}</p>
                      )}
                    </div>
                    {paymentMethod === id && !insufficient && (
                      <div className="w-6 h-6 rounded-full bg-zana-primary flex items-center justify-center shrink-0">
                        <Check size={13} className="text-white" />
                      </div>
                    )}
                    {insufficient && paymentMethod === id && (
                      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">!</div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Insufficient funds banner */}
            {walletInsufficient && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <span className="text-amber-500 text-base shrink-0">⚠️</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">Insufficient wallet balance</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Your wallet has {walletBalance?.toLocaleString()} RWF but this ride costs {selectedFare.toLocaleString()} RWF.
                    Please choose Mobile Money or Cash, or top up your wallet first.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Fare breakdown note */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-start gap-2">
            <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Fare is calculated by distance and vehicle type.
            </p>
          </div>

          {error && <p className="text-xs text-red-600 text-center">{error}</p>}

          {/* Book button */}
          <button
            onClick={handleBook}
            disabled={booking || loadingFares || walletInsufficient}
            className="w-full bg-zana-primary text-white font-black text-base py-4 rounded-2xl disabled:opacity-40 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {booking ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Finding your driver...
              </>
            ) : (
              `Confirm · ${selected ? fares[selected].toLocaleString() : '—'} RWF`
            )}
          </button>

          <button onClick={() => setStep('select')} className="w-full text-center text-sm text-gray-400 py-1">
            Change ride type
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RideOptionsPage() {
  return (
    <Suspense fallback={null}>
      <RideOptionsContent />
    </Suspense>
  );
}
