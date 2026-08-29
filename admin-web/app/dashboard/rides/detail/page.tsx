'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Navigation, MessageCircle, Clock, DollarSign } from 'lucide-react';
import AdminShell from '../../../../components/AdminShell';
import { api } from '../../../../lib/api/client';

function TripDetail() {
  const params = useSearchParams();
  const id = params.get('id');
  const router = useRouter();
  const [trip, setTrip] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    api.get<any>(`/admin/trips/${id}/detail`).then(setTrip).catch(() => {});
  }, [id]);

  if (!id) return <p className="text-sm text-gray-500 p-4">No trip ID provided.</p>;
  if (!trip) return <p className="text-sm text-gray-500 p-4">Loading trip…</p>;

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 mb-5 hover:text-gray-900">
        <ArrowLeft size={15} /> Back to Rides
      </button>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trip Detail</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{trip.id}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${trip.status === 'RIDE_COMPLETED' ? 'bg-green-100 text-green-700' : trip.status?.includes('CANCELLED') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{trip.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-2">Customer</p>
          <p className="font-semibold text-gray-900">{trip.customer?.firstName} {trip.customer?.lastName}</p>
          <p className="text-sm text-gray-500">{trip.customer?.phone}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-2">Driver</p>
          <p className="font-semibold text-gray-900">{trip.driver?.user?.firstName} {trip.driver?.user?.lastName}</p>
          <p className="text-sm text-gray-500">{trip.driver?.user?.phone ?? 'No driver assigned'}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">Route</p>
        <div className="flex items-start gap-2 mb-2">
          <MapPin size={14} className="text-zana-primary mt-0.5 shrink-0" />
          <div><p className="text-[10px] text-gray-400">Pickup</p><p className="text-sm text-gray-900">{trip.pickupAddress}</p></div>
        </div>
        <div className="flex items-start gap-2">
          <Navigation size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div><p className="text-[10px] text-gray-400">Destination</p><p className="text-sm text-gray-900">{trip.destinationAddress}</p></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <DollarSign size={16} className="text-zana-primary mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{(trip.finalFare ?? trip.estimatedFare)?.toLocaleString()}</p>
          <p className="text-xs text-gray-400">RWF</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <Clock size={16} className="text-blue-500 mx-auto mb-1" />
          <p className="text-sm font-semibold text-gray-900">{trip.requestedAt ? new Date(trip.requestedAt).toLocaleDateString() : '—'}</p>
          <p className="text-xs text-gray-400">Date</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <MessageCircle size={16} className="text-purple-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{trip.messages?.length ?? 0}</p>
          <p className="text-xs text-gray-400">Messages</p>
        </div>
      </div>
      {trip.messages?.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3">Chat History (admin view — preserved permanently)</p>
          <div className="space-y-3">
            {trip.messages.map((m: any) => (
              <div key={m.id} className={`flex ${m.sender?.role === 'DRIVER' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[70%] rounded-xl px-3 py-2 ${m.sender?.role === 'DRIVER' ? 'bg-gray-100' : 'bg-zana-primary-light'}`}>
                  <p className="text-[10px] font-semibold text-gray-500 mb-0.5">{m.sender?.firstName} ({m.sender?.role})</p>
                  <p className="text-sm text-gray-900">{m.content}</p>
                  {m.translatedEn && m.originalLang !== 'en' && <p className="text-[10px] text-gray-400 mt-0.5 italic">EN: {m.translatedEn}</p>}
                  <p className="text-[9px] text-gray-400 mt-1">{new Date(m.createdAt).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TripDetailPage() {
  return <AdminShell><Suspense fallback={null}><TripDetail /></Suspense></AdminShell>;
}
