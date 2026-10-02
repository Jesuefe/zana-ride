'use client';

// Merchant delivery tracking/reconciliation deployment marker: 2026-10-02

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Package, MapPin, Navigation, Phone, MessageCircle, LogOut, CheckCircle2, CircleDollarSign } from 'lucide-react';
import { fetchDeliveries, fetchWallet, Delivery } from '../../lib/api/merchant';
import { clearToken, getToken } from '../../lib/api/client';
import VoiceCall from '../../components/VoiceCall';
import DeliveryChatPanel from '../../components/DeliveryChatPanel';
import BrandedMap from '../../components/BrandedMap';
import { useLang } from '../../lib/LangContext';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Finding a courier',
  COURIER_ASSIGNED: 'Courier assigned',
  PICKED_UP: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-700',
  COURIER_ASSIGNED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function DeliveriesPage() { const {t}=useLang();
  const [callingDelivery, setCallingDelivery] = useState<Delivery | null>(null);
  const [chatDelivery, setChatDelivery] = useState<Delivery | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [wallet, setWallet] = useState<{ balance: number; transactions: any[] } | null>(null);
  const [livePositions, setLivePositions] = useState<Record<string, { lat: number; lng: number; at: string }>>({});
  const router = useRouter();

  const handleLogout = () => {
    clearToken();
    router.replace('/login');
  };

  useEffect(() => {
    const load = () => fetchDeliveries().then(setDeliveries).catch(() => setDeliveries([]));
    const loadWallet = () => fetchWallet().then(setWallet).catch(() => {});
    load();
    loadWallet();
    const interval = setInterval(load, 10000);
    const walletInterval = setInterval(loadWallet, 15000);
    return () => {
      clearInterval(interval);
      clearInterval(walletInterval);
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com', {
      auth: { token }, transports: ['websocket'],
    });
    socket.on('delivery:position', (data: { deliveryId: string; lat: number; lng: number; at: string }) => {
      if (!data?.deliveryId || typeof data.lat !== 'number' || typeof data.lng !== 'number') return;
      setLivePositions(prev => ({ ...prev, [data.deliveryId]: { lat: data.lat, lng: data.lng, at: data.at ?? new Date().toISOString() } }));
    });
    socket.on('delivery:status', (data: { deliveryId: string; status: string }) => {
      if (!data?.deliveryId) return;
      setDeliveries(prev => prev?.map(d => d.id === data.deliveryId ? { ...d, status: data.status } : d) ?? prev);
    });
    return () => { socket.disconnect(); };
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">{t('Deliveries')}</h1>
          <p className="text-sm text-gray-500">{t("Every package you've sent through Zana.")}</p>
        </div>
        <button
          onClick={handleLogout}
          className="shrink-0 px-3 py-2 rounded-xl bg-white border border-red-100 text-red-600 text-xs font-bold flex items-center gap-2 hover:bg-red-50"
          aria-label={t('Sign out')}
        >
          <LogOut size={14} /> {t('Sign out')}
        </button>
      </div>

      {deliveries === null && <p className="text-sm text-gray-500">{t('Loading…')}</p>}

      {deliveries?.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-xl">
          <Package size={26} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">{t('No deliveries yet.')}</p>
        </div>
      )}

      <div className="space-y-3">
        {deliveries?.map((d) => {
          const live = livePositions[d.id];
          const fallback = d.driver?.lastLat != null && d.driver?.lastLng != null
            ? { lat: d.driver.lastLat, lng: d.driver.lastLng } : null;
          const driverPosition = live ? { lat: live.lat, lng: live.lng } : fallback;
          const active = ['COURIER_ASSIGNED', 'PICKED_UP'].includes(d.status);
          const locationAt = live?.at ? new Date(live.at) : d.driver?.lastLocationAt ? new Date(d.driver.lastLocationAt) : null;
          const locationFresh = locationAt ? Date.now() - locationAt.getTime() < 120000 : false;
          const ledgerTx = wallet?.transactions?.find((x: any) =>
            x.reference === d.id && Number(x.amount) === -Number(d.fee)
          );
          const paymentOk = d.paid && ledgerTx?.status === 'COMPLETED';
          return (
          <div key={d.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {active && (
              <div className="relative">
                <BrandedMap
                  origin={{ lat: d.pickupLat, lng: d.pickupLng }}
                  destination={{ lat: d.dropoffLat, lng: d.dropoffLng }}
                  driverPosition={driverPosition}
                  navigationStart={driverPosition}
                  navigationDestination={d.status === 'COURIER_ASSIGNED'
                    ? { lat: d.pickupLat, lng: d.pickupLng }
                    : { lat: d.dropoffLat, lng: d.dropoffLng }}
                  height={210}
                />
                <div className="absolute top-3 left-3 right-3 flex justify-between gap-2 pointer-events-none">
                  <span className="bg-white/95 rounded-full px-3 py-1.5 text-[10px] font-black text-gray-800 shadow-sm">
                    {d.status === 'COURIER_ASSIGNED' ? t('Heading to pickup') : t('Delivering to customer')}
                  </span>
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-black shadow-sm ${locationFresh ? 'bg-green-600 text-white' : 'bg-white/95 text-gray-600'}`}>
                    {locationFresh ? t('Live location') : t('Location updating…')}
                  </span>
                </div>
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start gap-3">
              {d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Package size={20} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.itemDescription}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {d.receiverName ? `${d.receiverName} · ` : ''}
                      {d.receiverPhone}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[d.status] ?? ''}`}>
                    {t(STATUS_LABEL[d.status] ?? d.status)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {d.fee.toLocaleString()} RWF · {d.distanceKm} km
                </p>
              </div>
              {d.driver && ['COURIER_ASSIGNED', 'PICKED_UP'].includes(d.status) && (
                <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setChatDelivery(d)}
                  className="w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center"
                  aria-label={t('Chat with rider')}
                >
                  <MessageCircle size={16} className="text-zana-primary" />
                </button>
                <button
                  onClick={() => setCallingDelivery(d)}
                  className="w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center shrink-0"
                  aria-label={`Call ${d.driver.user.firstName ?? t('Rider')}`}
                >
                  <Phone size={16} className="text-zana-primary" />
                </button>
                </div>
              )}
            </div>

            <div className="mt-3 space-y-1.5 pl-1 border-t border-gray-100 pt-3">
              <div className="flex items-start gap-2">
                <MapPin size={12} className="text-zana-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-600 truncate">{d.pickupAddress}</p>
              </div>
              <div className="flex items-start gap-2">
                <Navigation size={12} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-600 truncate">{d.dropoffAddress}</p>
              </div>
            </div>
            {d.driver && active && (
              <div className="mt-3 flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-zana-primary-light flex items-center justify-center">
                  <Navigation size={17} className="text-zana-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{d.driver.user.firstName ?? t('Zana rider')}</p>
                  <p className="text-[11px] text-gray-500">{d.driver.vehicle ?? t('Vehicle')} {d.driver.plate ? '· ' + d.driver.plate : ''}</p>
                  <p className="text-[10px] text-zana-primary mt-0.5">{locationFresh ? t('Driver location is live') : t('Waiting for fresh location')}</p>
                </div>
              </div>
            )}
            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CircleDollarSign size={16} className="text-zana-primary" />
                  <div>
                    <p className="text-xs font-bold text-gray-900">{t('Delivery payment')}</p>
                    <p className="text-[10px] text-gray-500">{t('Charged from merchant wallet')}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${paymentOk ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {paymentOk ? t('Paid · Reconciled') : d.paid ? t('Paid · Checking ledger') : t('Payment pending')}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 text-xs">
                <span className="text-gray-500">{t('Fee')}</span>
                <span className="font-black text-gray-900">{d.fee.toLocaleString()} RWF</span>
              </div>
            </div>
            {d.status === 'DELIVERED' && (
              <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-green-800">{t('Delivery completed')}</p>
                  <p className="text-[10px] text-green-700">{d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : t('Completed')}</p>
                </div>
              </div>
            )}
            </div>
          </div>
          );
        })}
      </div>

      {chatDelivery && (
        <DeliveryChatPanel
          deliveryId={chatDelivery.id}
          participantLabel={chatDelivery.driver?.user.firstName ?? t('Zana courier')}
          onClose={() => setChatDelivery(null)}
        />
      )}

      {callingDelivery && (
        <VoiceCall
          context="delivery"
          contextId={callingDelivery.id}
          participantLabel={callingDelivery.driver?.user.firstName ?? 'Rider'}
          onClose={() => setCallingDelivery(null)}
        />
      )}
    </div>
  );
}
