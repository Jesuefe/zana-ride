'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Car, Clock } from 'lucide-react';
import { estimateRide, createRide, ServiceType } from '../../lib/api/trips';
import { ApiError } from '../../lib/api/client';
import DirectionsMap from '../../components/DirectionsMap';
import { getStoredPickup, requestLiveLocation } from '../../lib/location';

const options: { service: ServiceType; label: string; icon: typeof Car; comingSoon?: boolean; recommended?: boolean }[] = [
  { service: 'ECONOMY', label: 'Basic', icon: Car, recommended: true },
  { service: 'COMFORT', label: 'Premium', icon: Car },
];

function RideOptionsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const destName = params.get('name') ?? '';
  const destAddress = params.get('address') ?? '';
  const destLat = Number(params.get('lat'));
  const destLng = Number(params.get('lng'));

  const preselected = params.get('service') as ServiceType | null;
  const [pickup, setPickup] = useState(getStoredPickup());
  const [fares, setFares] = useState<Record<ServiceType, number>>({ BIKE: 0, ECONOMY: 0, COMFORT: 0 });
  const [selected, setSelected] = useState<ServiceType>(preselected === 'COMFORT' ? 'COMFORT' : 'ECONOMY');
  const [loadingFares, setLoadingFares] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Refresh with a live GPS read in case the user's moved since the Home
    // screen first requested location (or if it wasn't granted yet then).
    requestLiveLocation().then(setPickup);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [economy, comfort] = await Promise.all([
          estimateRide(pickup, { lat: destLat, lng: destLng }, 'ECONOMY'),
          estimateRide(pickup, { lat: destLat, lng: destLng }, 'COMFORT'),
        ]);
        setFares({ BIKE: 0, ECONOMY: economy.fare, COMFORT: comfort.fare });
      } catch {
        // leave fares at 0 if estimate fails — booking will still work
      } finally {
        setLoadingFares(false);
      }
    })();
  }, [destLat, destLng, pickup]);

  const handleBook = async () => {
    setBooking(true);
    setError(null);
    try {
      const trip = await createRide({
        serviceType: selected,
        pickupAddress: 'Current Location',
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destinationAddress: destAddress,
        destinationLat: destLat,
        destinationLng: destLng,
      });
      router.push(`/tracking?tripId=${trip.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setBooking(false);
    }
  };

  const selectedOption = options.find((o) => o.service === selected)!;

  return (
    <div className="animate-fade-in">
      <div className="relative">
        <DirectionsMap origin={pickup} destination={{ lat: destLat, lng: destLng }} height={200} />
        <button
          onClick={() => router.back()}
          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center"
        >
          <ArrowLeft size={16} />
        </button>
      </div>
      <div className="p-4 flex items-center gap-3 -mt-1">
        <div>
          <p className="text-sm font-medium text-gray-900">{destName}</p>
          <p className="text-xs text-zana-muted">{destAddress}</p>
        </div>
      </div>

      <div className="px-4">
        <h2 className="font-semibold text-gray-900 mb-3">Choose a ride</h2>
        <div className="space-y-2">
          {options.map((opt, i) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.service;
            return (
              <button
                key={opt.service}
                onClick={() => {
                  if (opt.comingSoon) {
                    alert(`${opt.label} — Coming soon to Zana.`);
                    return;
                  }
                  setSelected(opt.service);
                }}
                className={`animate-fade-slide-up stagger-${i + 1} w-full flex items-center gap-3 p-3 rounded-xl border-1.5 text-left transition-all ${
                  isSelected ? 'border-zana-primary bg-zana-primary-light scale-[1.01]' : 'border-zana-border'
                } ${opt.comingSoon ? 'opacity-50' : ''}`}
                style={{ borderWidth: 1.5 }}
              >
                <Icon size={24} className="text-zana-primary" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                    {opt.recommended && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zana-muted">
                    {opt.comingSoon ? 'Launching soon' : loadingFares ? 'Calculating…' : `${fares[opt.service].toLocaleString()} RWF`}
                  </span>
                </div>
                {opt.comingSoon && (
                  <span className="flex items-center gap-1 text-[10px] bg-gray-100 px-2 py-1 rounded-full text-zana-muted">
                    <Clock size={10} /> Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs text-zana-error mt-4">{error}</p>}

        <button
          onClick={handleBook}
          disabled={booking || loadingFares}
          className="w-full mt-6 bg-zana-primary text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition-transform active:scale-[0.98]"
        >
          {booking ? 'Booking…' : `Book ${selectedOption.label} · ${fares[selected].toLocaleString()} RWF`}
        </button>
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
