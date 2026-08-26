'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bike, Car, Clock } from 'lucide-react';
import { estimateRide, createRide, ServiceType } from '../../lib/api/trips';
import { KIGALI_CENTER } from '../../lib/places';
import { ApiError } from '../../lib/api/client';

const options: { service: ServiceType; label: string; icon: typeof Bike; comingSoon?: boolean; recommended?: boolean }[] = [
  { service: 'BIKE', label: 'Zana Moto', icon: Bike, recommended: true },
  { service: 'ECONOMY', label: 'Zana Car', icon: Car },
  { service: 'COMFORT', label: 'Zana Comfort', icon: Car, comingSoon: true },
];

function RideOptionsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const destName = params.get('name') ?? '';
  const destAddress = params.get('address') ?? '';
  const destLat = Number(params.get('lat'));
  const destLng = Number(params.get('lng'));

  const [fares, setFares] = useState<Record<ServiceType, number>>({ BIKE: 0, ECONOMY: 0, COMFORT: 0 });
  const [selected, setSelected] = useState<ServiceType>('BIKE');
  const [loadingFares, setLoadingFares] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [bike, economy] = await Promise.all([
          estimateRide(KIGALI_CENTER, { lat: destLat, lng: destLng }, 'BIKE'),
          estimateRide(KIGALI_CENTER, { lat: destLat, lng: destLng }, 'ECONOMY'),
        ]);
        setFares({ BIKE: bike.fare, ECONOMY: economy.fare, COMFORT: 0 });
      } catch {
        // leave fares at 0 if estimate fails — booking will still work
      } finally {
        setLoadingFares(false);
      }
    })();
  }, [destLat, destLng]);

  const handleBook = async () => {
    setBooking(true);
    setError(null);
    try {
      const trip = await createRide({
        serviceType: selected,
        pickupAddress: 'Current Location',
        pickupLat: KIGALI_CENTER.lat,
        pickupLng: KIGALI_CENTER.lng,
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
    <div>
      <div className="p-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-sm font-medium text-gray-900">{destName}</p>
          <p className="text-xs text-zana-muted">{destAddress}</p>
        </div>
      </div>

      <div className="px-4">
        <h2 className="font-semibold text-gray-900 mb-3">Choose a ride</h2>
        <div className="space-y-2">
          {options.map((opt) => {
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
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-1.5 text-left ${
                  isSelected ? 'border-zana-primary bg-zana-primary-light' : 'border-zana-border'
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
          className="w-full mt-6 bg-zana-primary text-white font-semibold py-3.5 rounded-xl disabled:opacity-50"
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
