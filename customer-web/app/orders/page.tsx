'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, MapPin, Navigation, ShoppingBag, Star, Clock3, ChevronRight, X } from 'lucide-react';
import ReviewSheet from '../../components/ReviewSheet';
import DeliveryTracker from '../../components/DeliveryTracker';
import { fetchMyDeliveries, Delivery } from '../../lib/api/deliveries';
import { fetchMyOrders, fetchReplacementOptions, resolveUnavailableItem } from '../../lib/api/trips';
import { cancelOrder } from '../../lib/api/orders';
import { useLang } from '../../lib/LangContext';

const DELIVERY_STATUS: Record<string, string> = {
  REQUESTED: 'Finding courier',
  COURIER_ASSIGNED: 'Courier assigned',
  PICKED_UP: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const ORDER_STATUS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-amber-100 text-amber-700',
  COURIER_ASSIGNED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-blue-100 text-blue-700',
  READY_FOR_PICKUP: 'bg-purple-100 text-purple-700',
  OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const ACTIVE_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];

function orderProgress(order: any) {
  const deliveryStatus = order.delivery?.status;
  if (deliveryStatus === 'PICKED_UP') return 4;
  if (deliveryStatus === 'COURIER_ASSIGNED') return 3;
  if (deliveryStatus === 'DELIVERED' || order.status === 'DELIVERED') return 5;
  if (order.status === 'OUT_FOR_DELIVERY') return 4;
  if (order.status === 'READY_FOR_PICKUP') return 3;
  if (order.status === 'PREPARING') return 2;
  if (order.status === 'CONFIRMED') return 1;
  return 0;
}

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
  const [resolvingItem, setResolvingItem] = useState<string | null>(null);
  const [replacementOptions, setReplacementOptions] = useState<any[]>([]);
  const [replacementItem, setReplacementItem] = useState<{ orderId: string; itemId: string } | null>(null);

  useEffect(() => {
    const load = () => {
      fetchMyDeliveries().then(setDeliveries).catch(() => {});
      fetchMyOrders().then(setOrders).catch(() => {});
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const activeOrders = useMemo(() => orders.filter(o => ACTIVE_ORDER_STATUSES.includes(o.status)), [orders]);

  const resolveItem = async (orderId: string, itemId: string, action: 'REFUND' | 'REPLACE' | 'REMOVE', replacementProductId?: string) => {
    setResolvingItem(itemId);
    try {
      await resolveUnavailableItem(orderId, itemId, action, replacementProductId);
      const fresh = await fetchMyOrders();
      setOrders(fresh);
      setSelectedOrder(fresh.find((x: any) => x.id === orderId) ?? null);
      setReplacementItem(null);
      setReplacementOptions([]);
    } catch (e: any) {
      window.alert(e?.message ?? 'We could not update this item. Please try again.');
    } finally {
      setResolvingItem(null);
    }
  };

  const openReplacement = async (orderId: string, itemId: string) => {
    setResolvingItem(itemId);
    try {
      const options = await fetchReplacementOptions(orderId, itemId);
      setReplacementOptions(options);
      setReplacementItem({ orderId, itemId });
    } catch (e: any) {
      window.alert(e?.message ?? 'Replacement options are no longer available.');
    } finally {
      setResolvingItem(null);
    }
  };
  const historyOrders = useMemo(() => orders.filter(o => !ACTIVE_ORDER_STATUSES.includes(o.status)), [orders]);

  const renderOrder = (o: any, active: boolean) => {
    const delivery = o.delivery;
    const progress = orderProgress(o);
    const hasMap = !!delivery &&
      ['COURIER_ASSIGNED', 'PICKED_UP'].includes(delivery.status) &&
      Number.isFinite(Number(delivery.pickupLat)) &&
      Number.isFinite(Number(delivery.pickupLng)) &&
      Number.isFinite(Number(delivery.dropoffLat)) &&
      Number.isFinite(Number(delivery.dropoffLng));

    return (
      <div
        key={o.id}
        className={`overflow-hidden rounded-2xl bg-white shadow-sm ${o.id === highlightId ? 'ring-2 ring-zana-primary' : ''}`}
      >
        {active && hasMap && (
          <div className="p-2 pb-0">
            <DeliveryTracker
              deliveryId={delivery.id}
              pickup={{ lat: Number(delivery.pickupLat), lng: Number(delivery.pickupLng) }}
              dropoff={{ lat: Number(delivery.dropoffLat), lng: Number(delivery.dropoffLng) }}
              status={delivery.status}
              onStatusUpdate={(id, newStatus) => {
                setOrders(prev => prev.map(x => x.delivery?.id === id ? {
                  ...x,
                  delivery: { ...x.delivery, status: newStatus },
                } : x));
              }}
            />
          </div>
        )}

        <button type="button" onClick={() => setSelectedOrder(o)} className="w-full text-left p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zana-muted">
                {active ? t('Active order') : t('Order')}
              </p>
              <p className="mt-0.5 font-black text-gray-900 truncate">{o.merchant?.businessName ?? t('ZANA Market')}</p>
              <p className="text-xs text-zana-muted mt-1 line-clamp-1">
                {o.items?.map((i: any) => `${i.product?.name} ×${i.quantity}`).join(', ')}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${STATUS_STYLE[delivery?.status] ?? STATUS_STYLE[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {t(DELIVERY_STATUS[delivery?.status] ?? ORDER_STATUS[o.status]) ?? delivery?.status ?? o.status}
            </span>
          </div>

          {(o.items || []).filter((i: any) => i.status === 'UNAVAILABLE_PENDING').map((i: any) => (
            <div key={i.id} className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-black text-gray-900">{i.product?.name ?? 'Item'} is currently unavailable</p>
              <p className="text-xs text-gray-600 mt-1">What would you like us to do?</p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <button disabled={resolvingItem === i.id} onClick={() => resolveItem(o.id, i.id, 'REFUND')} className="rounded-xl bg-zana-primary text-white py-2 text-[11px] font-black disabled:opacity-50">Refund this item</button>
                <button disabled={resolvingItem === i.id} onClick={() => openReplacement(o.id, i.id)} className="rounded-xl bg-white border border-gray-200 text-gray-800 py-2 text-[11px] font-black disabled:opacity-50">Replace item</button>
                <button disabled={resolvingItem === i.id} onClick={() => resolveItem(o.id, i.id, 'REMOVE')} className="rounded-xl bg-white border border-gray-200 text-gray-800 py-2 text-[11px] font-black disabled:opacity-50">Remove item</button>
              </div>
            </div>
          ))}

          {active && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] font-semibold text-zana-muted mb-2">
                <span>{t('Order placed')}</span>
                <span>{delivery?.status === 'PICKED_UP' ? t('Rider on the way') : t(ORDER_STATUS[o.status])}</span>
              </div>
              <div className="flex items-center gap-1">
                {['Order', 'Confirmed', 'Preparing', 'Picked up', 'Delivered'].map((label, index) => (
                  <div key={label} className="flex-1">
                    <div className={`h-1.5 rounded-full ${index <= progress ? 'bg-zana-primary' : 'bg-gray-100'}`} />
                    <p className={`mt-1 text-[9px] ${index <= progress ? 'font-bold text-gray-700' : 'text-gray-400'}`}>{t(label)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-zana-primary">{Number(o.total ?? 0).toLocaleString()} RWF</p>
              {o.trackingCode && <p className="text-[10px] text-zana-muted mt-0.5">{t('Tracking')} · {o.trackingCode}</p>}
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-zana-primary">
              {active ? t('Track order') : t('View details')} <ChevronRight size={15} />
            </span>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 pb-8">
      <div className="mb-4">
        <h1 className="text-xl font-black text-gray-900">{t('My Orders')}</h1>
        <p className="text-xs text-zana-muted mt-1">{t('Track your orders and deliveries in one place.')}</p>
      </div>

      <div className="flex gap-2 mb-5">
        {(['orders', 'deliveries'] as const).map(tabName => (
          <button
            key={tabName}
            onClick={() => setTab(tabName)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold ${tab === tabName ? 'bg-zana-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            {tabName === 'orders' ? `${t('Orders')} (${orders.length})` : `${t('Deliveries')} (${deliveries.length})`}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="space-y-5">
          {activeOrders.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-zana-primary animate-pulse" />
                <h2 className="text-sm font-black text-gray-900">{t('Active')}</h2>
                <span className="text-xs text-zana-muted">{activeOrders.length}</span>
              </div>
              <div className="space-y-3">{activeOrders.map(o => renderOrder(o, true))}</div>
            </section>
          )}

          {historyOrders.length > 0 && (
            <section>
              <h2 className="text-sm font-black text-gray-900 mb-2">{t('Order history')}</h2>
              <div className="space-y-3">{historyOrders.map(o => renderOrder(o, false))}</div>
            </section>
          )}

          {orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-zana-primary-light flex items-center justify-center mb-3">
                <ShoppingBag size={22} className="text-zana-primary" />
              </div>
              <p className="text-sm text-zana-muted">{t('No orders yet. Try Food or Gifts!')}</p>
            </div>
          )}
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
                  : <div className="w-14 h-14 rounded-xl bg-zana-primary-light flex items-center justify-center shrink-0"><Package size={20} className="text-zana-primary" /></div>}
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
                      onClick={() => setReview({ target: 'DELIVERY', deliveryId: d.id, title: t('How was this delivery?'), subtitle: d.itemDescription })}
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

              {['COURIER_ASSIGNED', 'PICKED_UP'].includes(d.status) && (
                <div className="mt-3">
                  <DeliveryTracker
                    deliveryId={d.id}
                    pickup={{ lat: (d as any).pickupLat, lng: (d as any).pickupLng }}
                    dropoff={{ lat: (d as any).dropoffLat, lng: (d as any).dropoffLng }}
                    status={d.status}
                    onStatusUpdate={(id, newStatus) => setDeliveries(prev => prev.map(x => x.id === id ? { ...x, status: newStatus as any } : x))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setSelectedOrder(null)}>
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-zana-muted">{t('Order details')}</p>
                <p className="font-black text-lg">{selectedOrder.merchant?.businessName ?? t('ZANA Market')}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={18} /></button>
            </div>

            {selectedOrder.delivery && ['COURIER_ASSIGNED', 'PICKED_UP'].includes(selectedOrder.delivery.status) &&
              Number.isFinite(Number(selectedOrder.delivery.pickupLat)) &&
              Number.isFinite(Number(selectedOrder.delivery.dropoffLat)) && (
              <div className="mb-4">
                <DeliveryTracker
                  deliveryId={selectedOrder.delivery.id}
                  pickup={{ lat: Number(selectedOrder.delivery.pickupLat), lng: Number(selectedOrder.delivery.pickupLng) }}
                  dropoff={{ lat: Number(selectedOrder.delivery.dropoffLat), lng: Number(selectedOrder.delivery.dropoffLng) }}
                  status={selectedOrder.delivery.status}
                  onStatusUpdate={(id, newStatus) => setSelectedOrder((prev: any) => prev?.delivery?.id === id ? { ...prev, delivery: { ...prev.delivery, status: newStatus } } : prev)}
                />
              </div>
            )}

            <div className="rounded-xl bg-zana-primary-light p-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-zana-primary"><Clock3 size={14} /> {t(DELIVERY_STATUS[selectedOrder.delivery?.status] ?? ORDER_STATUS[selectedOrder.status])}</div>
              {selectedOrder.trackingCode && <p className="text-[11px] text-zana-muted mt-1">{t('Tracking code')}: {selectedOrder.trackingCode}</p>}
            </div>

            <div className="space-y-2 mb-4">
              {selectedOrder.items?.map((i: any) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span>{i.product?.name} ×{i.quantity}</span>
                  <span className="font-semibold">{((i.product?.price ?? 0) * i.quantity).toLocaleString()} RWF</span>
                </div>
              ))}
            </div>

            {(() => {
              const itemsTotal = (selectedOrder.items ?? []).reduce((sum: number, item: any) => sum + (item.product?.price ?? 0) * (item.quantity ?? 0), 0);
              const grandTotal = Number(selectedOrder.total ?? itemsTotal);
              const deliveryFee = Math.max(0, grandTotal - itemsTotal);
              return (
                <div className="rounded-2xl bg-gray-50 p-4 mb-4">
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 mb-2">{t('Order summary')}</p>
                  <div className="flex justify-between text-sm py-1"><span className="text-gray-600">{t('Items')}</span><span className="font-semibold text-gray-900">{itemsTotal.toLocaleString()} RWF</span></div>
                  <div className="flex justify-between text-sm py-1"><span className="text-gray-600">{t('Delivery')}</span><span className="font-semibold text-gray-900">{deliveryFee.toLocaleString()} RWF</span></div>
                  <div className="border-t border-gray-200 mt-2 pt-3 flex justify-between"><span className="font-black text-gray-900">{t('Total')}</span><span className="font-black text-lg text-zana-primary">{grandTotal.toLocaleString()} RWF</span></div>
                </div>
              );
            })()}

            <div className="rounded-xl bg-gray-50 p-3 mb-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{t('Delivery recipient')}</p>
              <p className="text-sm font-bold text-gray-900">{selectedOrder.receiverName || t('Myself')}</p>
              {selectedOrder.receiverPhone && <p className="text-xs text-gray-600">{selectedOrder.receiverPhone}</p>}
              {selectedOrder.dropoffAddress && <p className="text-xs text-gray-600 flex items-start gap-1"><MapPin size={12} className="text-zana-primary mt-0.5 shrink-0" />{selectedOrder.dropoffAddress}</p>}
              {selectedOrder.note && <p className="text-xs text-gray-500">{t('Note:')} {selectedOrder.note}</p>}
            </div>

            {selectedOrder.status === 'PENDING' && (
              <button
                type="button"
                disabled={cancelling === selectedOrder.id}
                onClick={async () => {
                  setCancelling(selectedOrder.id);
                  try {
                    await cancelOrder(selectedOrder.id);
                    const fresh = await fetchMyOrders();
                    setOrders(fresh);
                    setSelectedOrder(fresh.find((x: any) => x.id === selectedOrder.id) ?? { ...selectedOrder, status: 'CANCELLED' });
                  } finally { setCancelling(null); }
                }}
                className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-bold disabled:opacity-50"
              >
                {cancelling === selectedOrder.id ? t('Cancelling…') : t('Cancel order')}
              </button>
            )}
          </div>
        </div>
      )}

      {replacementItem && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50" onClick={() => { setReplacementItem(null); setReplacementOptions([]); }}>
          <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-zana-muted">Replace item</p><p className="font-black text-lg">Choose an available item</p></div>
              <button onClick={() => { setReplacementItem(null); setReplacementOptions([]); }} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={18}/></button>
            </div>
            <div className="space-y-2">
              {replacementOptions.map((p: any) => (
                <button key={p.id} disabled={resolvingItem === replacementItem.itemId} onClick={() => resolveItem(replacementItem.orderId, replacementItem.itemId, 'REPLACE', p.id)} className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-200 text-left disabled:opacity-50">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover"/> : <div className="w-12 h-12 rounded-xl bg-zana-primary-light"/>}
                  <span className="flex-1"><span className="block text-sm font-bold">{p.name}</span><span className="block text-xs text-zana-muted">{Number(p.price).toLocaleString()} RWF</span></span>
                  <ChevronRight size={16} className="text-zana-muted"/>
                </button>
              ))}
              {replacementOptions.length === 0 && <p className="text-sm text-zana-muted text-center py-8">No replacement items are currently available.</p>}
            </div>
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
