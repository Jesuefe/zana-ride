'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, MapPin, Navigation, ShoppingBag, Star } from 'lucide-react';
import ReviewSheet from '../../components/ReviewSheet';
import DeliveryTracker from '../../components/DeliveryTracker';
import { fetchMyDeliveries, Delivery } from '../../lib/api/deliveries';
import { fetchMyOrders } from '../../lib/api/trips';
import { cancelOrder } from '../../lib/api/orders';
import { useLang } from '../../lib/LangContext';

const DELIVERY_STATUS: Record<string, string> = {
  REQUESTED: 'Finding courier', COURIER_ASSIGNED: 'Courier assigned',
  PICKED_UP: 'On the way', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};  // translated at each render site via t()

const ORDER_STATUS: Record<string, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup', OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-700', PENDING: 'bg-amber-100 text-amber-700',
  COURIER_ASSIGNED: 'bg-blue-100 text-blue-700', CONFIRMED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-blue-100 text-blue-700', PREPARING: 'bg-blue-100 text-blue-700',
  READY_FOR_PICKUP: 'bg-purple-100 text-purple-700',
  OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700', CANCELLED: 'bg-gray-100 text-gray-600',
};

function OrdersContent() {
  const { t } = useLang();
  const [review, setReview] = useState<any>(null);
  const params = useSearchParams();
  const highlightId = params.get('highlight');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<'orders' | 'deliveries'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      fetchMyDeliveries().then(setDeliveries).catch(() => {});
      fetchMyOrders().then(setOrders).catch(() => {});
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-900 mb-4">{t('My Activity')}</h1>

      <div className="flex gap-2 mb-4">
        {(['orders', 'deliveries'] as const).map(tabName => (
          <button key={tabName} onClick={() => setTab(tabName)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === tabName ? 'bg-zana-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {tabName === 'orders' ? `${t('Orders')} (${orders.length})` : `${t('Deliveries')} (${deliveries.length})`}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-zana-primary-light flex items-center justify-center mb-3">
                <ShoppingBag size={22} className="text-zana-primary" />
              </div>
              <p className="text-sm text-zana-muted">{t('No orders yet. Try Food or Gifts!')}</p>
            </div>
          )}
          {orders.map((o: any) => (
            <button type="button" onClick={() => setSelectedOrder(o)} key={o.id} className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm ${o.id === highlightId ? 'ring-2 ring-zana-primary' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{o.merchant?.businessName}</p>
                  <p className="text-xs text-zana-muted mt-0.5">{o.items?.map((i: any) => `${i.product?.name} ×${i.quantity}`).join(', ')}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[o.status] ?? ''}`}>
                  {t(ORDER_STATUS[o.status]) ?? o.status}
                </span>
              </div>
              <p className="text-sm font-bold text-zana-primary">{o.total?.toLocaleString()} RWF</p>
              <p className="text-[11px] text-zana-muted mt-2">Tap to view order details</p>
            </button>
          ))}
        </div>
      )}

      {tab === 'deliveries' && (
        <div className="space-y-3">
          {deliveries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-zana-primary-light flex items-center justify-center mb-3">
                <Package size={22} className="text-zana-primary" />
              </div>
              <p className="text-sm text-zana-muted">{t('Your deliveries will show up here.')}</p>
            </div>
          )}
          {deliveries.map(d => (
            <div key={d.id} className={`bg-white rounded-2xl p-4 shadow-sm ${d.id === highlightId ? 'ring-2 ring-zana-primary animate-fade-slide-up' : ''}`}>
              <div className="flex items-start gap-3">
                {d.imageUrl
                  ? <img src={d.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  : <div className="w-14 h-14 rounded-xl bg-zana-primary-light flex items-center justify-center shrink-0"><Package size={20} className="text-zana-primary" /></div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.itemDescription}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[d.status] ?? ''}`}>
                      {t(DELIVERY_STATUS[d.status]) ?? d.status}
                    </span>
                  </div>
                  <p className="text-xs text-zana-muted mt-1">{d.fee.toLocaleString()} RWF · {d.distanceKm} km</p>
                  {d.status === 'DELIVERED' && (
                    <button
                      onClick={() => setReview({
                        target: 'DELIVERY',
                        deliveryId: d.id,
                        title: t('How was this delivery?'),
                        subtitle: d.itemDescription,
                      })}
                      className="mt-2 flex items-center gap-1 text-[11px] font-bold text-zana-primary"
                    >
                      <Star size={11} /> {t('Rate this delivery')}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1.5 pl-1">
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-zana-primary mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gray-700 truncate">{d.pickupAddress}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Navigation size={12} className="text-zana-secondary-dark mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gray-700 truncate">{d.dropoffAddress}</p>
                </div>
              </div>

              {/* Follow the parcel while it is in flight */}
              {['COURIER_ASSIGNED', 'PICKED_UP'].includes(d.status) && (
                <div className="mt-3">
                  <DeliveryTracker
                    deliveryId={d.id}
                    pickup={{ lat: (d as any).pickupLat, lng: (d as any).pickupLng }}
                    dropoff={{ lat: (d as any).dropoffLat, lng: (d as any).dropoffLng }}
                    status={d.status}
                    onStatusUpdate={(id, newStatus) => {
                      setDeliveries(prev => prev.map(x => x.id === id ? { ...x, status: newStatus as any } : x));
                    }}
                  />
                </div>
              )}
              <div className="hidden">
              </div>
            </div>
          ))}
        </div>
      )}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setSelectedOrder(null)}>
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className="font-black text-lg">{selectedOrder.merchant?.businessName ?? 'Order details'}</p><button type="button" onClick={() => setSelectedOrder(null)} className="w-9 h-9 rounded-full bg-gray-100">×</button></div>
            <div className="space-y-2 mb-4">{selectedOrder.items?.map((i: any) => <div key={i.id} className="flex justify-between text-sm"><span>{i.product?.name} ×{i.quantity}</span><span className="font-semibold">{((i.product?.price ?? 0) * i.quantity).toLocaleString()} RWF</span></div>)}</div>
            <div className="border-t pt-2 flex justify-between font-black mb-4"><span>Total</span><span className="text-zana-primary">{selectedOrder.total?.toLocaleString()} RWF</span></div>
            <div className="rounded-xl bg-gray-50 p-3 mb-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Delivery recipient</p>
              <p className="text-sm font-bold text-gray-900">{selectedOrder.receiverName || 'Myself'}</p>
              {selectedOrder.receiverPhone && <p className="text-xs text-gray-600">{selectedOrder.receiverPhone}</p>}
              {selectedOrder.dropoffAddress && <p className="text-xs text-gray-600 flex items-start gap-1"><MapPin size={12} className="text-zana-primary mt-0.5 shrink-0" />{selectedOrder.dropoffAddress}</p>}
              {selectedOrder.note && <p className="text-xs text-gray-500">Note: {selectedOrder.note}</p>}
            </div>
            {selectedOrder.status === 'PENDING' && <button type="button" disabled={cancelling === selectedOrder.id} onClick={async () => { setCancelling(selectedOrder.id); try { await cancelOrder(selectedOrder.id); const fresh = await fetchMyOrders(); setOrders(fresh); setSelectedOrder(fresh.find((x:any) => x.id === selectedOrder.id) ?? {...selectedOrder,status:'CANCELLED'}); } finally { setCancelling(null); } }} className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-bold disabled:opacity-50">{cancelling === selectedOrder.id ? 'Cancelling…' : 'Cancel order'}</button>}
          </div>
        </div>
      )}

      {review && (
        <ReviewSheet
          target={review.target}
          deliveryId={review.deliveryId}
          merchantId={review.merchantId}
          orderId={review.orderId}
          title={review.title}
          subtitle={review.subtitle}
          onDone={() => setReview(null)}
        />
      )}
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense fallback={null}><OrdersContent /></Suspense>;
}
