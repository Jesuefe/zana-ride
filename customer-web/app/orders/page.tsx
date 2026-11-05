'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronRight, Gift, MapPin, Package, RefreshCw, Search, ShoppingBag, Store, Utensils, X } from 'lucide-react';
import DeliveryTracker from '../../components/DeliveryTracker';
import ReviewSheet from '../../components/ReviewSheet';
import { useLang } from '../../lib/LangContext';
import { fetchMyDeliveries, Delivery } from '../../lib/api/deliveries';
import { fetchMyOrders } from '../../lib/api/trips';
import { cancelOrder } from '../../lib/api/orders';
import ZanaLoading from '../../components/ZanaLoading';

type OrderCategory = 'DELIVERY' | 'FOOD' | 'SHOP' | 'GIFTS';
type View = 'ACTIVE' | 'HISTORY';
type Entry = { kind: 'delivery' | 'market'; id: string; status: string; date: string; raw: any; category: OrderCategory; title: string; subtitle: string; amount: number };

const DELIVERY_ACTIVE = new Set(['REQUESTED', 'COURIER_ASSIGNED', 'PICKED_UP']);
const MARKET_ACTIVE = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY']);
const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Finding courier', COURIER_ASSIGNED: 'Courier assigned',
  PICKED_UP: 'Courier picked up your package', DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled', PENDING: 'Order placed', CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing your order', READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'On the way', REFUNDED: 'Refunded',
};

function money(value: unknown) { return `${Number(value ?? 0).toLocaleString()} RWF`; }
function dateOf(value: unknown) {
  const d = value ? new Date(String(value)) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
function dateGroup(value: string) {
  const d = dateOf(value), now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((start.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff >= 2 && diff < 7) return 'This week';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function statusTone(status: string) {
  if (status === 'DELIVERED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-600';
  if (status === 'REFUNDED') return 'bg-amber-50 text-amber-700';
  return 'bg-teal-50 text-teal-800';
}
function getCategory(order: any): OrderCategory {
  const value = String(order.merchant?.category ?? order.category ?? order.items?.[0]?.product?.category ?? '').toLowerCase();
  if (value.includes('gift')) return 'GIFTS';
  if (value.includes('food') || value.includes('restaurant') || value.includes('meal')) return 'FOOD';
  return 'SHOP';
}
function iconFor(category: OrderCategory) {
  if (category === 'DELIVERY') return Package;
  if (category === 'FOOD') return Utensils;
  if (category === 'GIFTS') return Gift;
  return Store;
}

function OrdersContent() {
  const { t } = useLang();
  const params = useSearchParams();
  const highlightId = params.get('highlight');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>('HISTORY');
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [selected, setSelected] = useState<Entry | null>(null);
  const [review, setReview] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setRefreshing(quiet);
    const results = await Promise.allSettled([fetchMyDeliveries(), fetchMyOrders()]);
    let failures = 0;
    if (results[0].status === 'fulfilled') setDeliveries(Array.isArray(results[0].value) ? results[0].value : []); else failures++;
    if (results[1].status === 'fulfilled') setOrders(Array.isArray(results[1].value) ? results[1].value : []); else failures++;
    setOffline(failures === 2);
    if (failures < 2) setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (loading) return;
    const hasActive = deliveries.some(d => DELIVERY_ACTIVE.has(d.status)) || orders.some(o => MARKET_ACTIVE.has(o.status));
    setView(hasActive ? 'ACTIVE' : 'HISTORY');
  }, [loading]); // Choose the initial tab once data has loaded.

  useEffect(() => {
    const id = window.setInterval(() => { load(true); }, 10000);
    return () => window.clearInterval(id);
  }, [load]);

  const entries = useMemo<Entry[]>(() => {
    const rows: Entry[] = [];
    deliveries.forEach(d => rows.push({
      kind: 'delivery', id: d.id, status: d.status, date: d.createdAt, raw: d,
      category: 'DELIVERY', title: d.itemDescription || 'Package delivery',
      subtitle: `${d.pickupAddress} → ${d.dropoffAddress}`, amount: Number(d.fee ?? 0),
    }));
    orders.forEach(o => rows.push({
      kind: 'market', id: o.id, status: o.status, date: o.createdAt ?? o.updatedAt, raw: o,
      category: getCategory(o), title: o.merchant?.businessName ?? 'ZANA Market',
      subtitle: (o.items ?? []).map((i: any) => `${i.product?.name ?? 'Item'} ×${i.quantity}`).join(', ') || o.dropoffAddress || 'Marketplace order',
      amount: Number(o.total ?? 0),
    }));
    return rows.sort((a, b) => dateOf(b.date).getTime() - dateOf(a.date).getTime());
  }, [deliveries, orders]);

  const isActive = (entry: Entry) => entry.kind === 'delivery'
    ? DELIVERY_ACTIVE.has(entry.status) : MARKET_ACTIVE.has(entry.status);

  const filtered = useMemo(() => entries.filter(e => {
    if (view === 'ACTIVE' && !isActive(e)) return false;
    if (view === 'HISTORY' && isActive(e)) return false;
    if (query.trim()) {
      const haystack = `${e.title} ${e.subtitle} ${e.status} ${e.id}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    if (dateFilter !== 'ALL') {
      const d = dateOf(e.date), now = new Date();
      const age = (now.getTime() - d.getTime()) / 86400000;
      if (dateFilter === '7D' && age > 7) return false;
      if (dateFilter === '30D' && age > 30) return false;
      if (dateFilter === 'MONTH' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
    }
    return true;
  }), [entries, view, query, dateFilter]);

  const groups = useMemo(() => {
    const result: { title: string; rows: Entry[] }[] = [];
    filtered.forEach(entry => {
      const title = dateGroup(entry.date);
      const group = result.find(g => g.title === title);
      if (group) group.rows.push(entry); else result.push({ title, rows: [entry] });
    });
    return result;
  }, [filtered]);

  const renderProgress = (entry: Entry) => {
    const labels = entry.kind === 'delivery'
      ? ['Order received', 'Courier assigned', 'Picked up', 'Delivered']
      : ['Confirmed', 'Preparing', 'On the way', 'Delivered'];
    const step = entry.kind === 'delivery'
      ? ({ REQUESTED: 0, COURIER_ASSIGNED: 1, PICKED_UP: 2, DELIVERED: 3 } as Record<string, number>)[entry.status] ?? 0
      : ({ PENDING: 0, CONFIRMED: 0, PREPARING: 1, READY_FOR_PICKUP: 2, OUT_FOR_DELIVERY: 2, DELIVERED: 3 } as Record<string, number>)[entry.status] ?? 0;
    return <div className="mt-4 grid grid-cols-4 gap-1" aria-label={t('Order progress')}>{labels.map((label, i) => <div key={label}><div className={`h-1.5 rounded-full ${i <= step ? 'bg-[#00A082]' : 'bg-gray-100'}`} /><span className={`mt-1 block text-[9px] ${i <= step ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>{t(label)}</span></div>)}</div>;
  };

  const renderEntry = (entry: Entry) => {
    const Icon = iconFor(entry.category);
    const active = isActive(entry);
    const delivery = entry.kind === 'delivery' ? entry.raw as any : null;
    const hasMap = delivery?.pickupLat != null && delivery?.pickupLng != null && delivery?.dropoffLat != null && delivery?.dropoffLng != null;
    const statusText = t(STATUS_LABEL[entry.status] ?? entry.status);
    return <article key={entry.id} className={`overflow-hidden rounded-[22px] border border-gray-100 bg-white shadow-[0_5px_24px_rgba(15,35,28,.045)] ${entry.id === highlightId ? 'ring-2 ring-[#00A082]' : ''}`}>
      {active && entry.kind === 'delivery' && hasMap && <div className="p-2 pb-0"><DeliveryTracker deliveryId={entry.id} pickup={{lat:Number(delivery.pickupLat),lng:Number(delivery.pickupLng)}} dropoff={{lat:Number(delivery.dropoffLat),lng:Number(delivery.dropoffLng)}} status={entry.status} onStatusUpdate={(id,status)=>setDeliveries(current=>current.map(d=>d.id===id?{...d,status}:d))}/></div>}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--zana-primary-light)] text-[#00866F]"><Icon size={20}/></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[.12em] text-gray-400">{t(entry.category === 'DELIVERY' ? 'Delivery' : entry.category === 'FOOD' ? 'Food order' : entry.category === 'GIFTS' ? 'Gift order' : 'Shopping order')}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(entry.status)}`}>{statusText}</span>
            </div>
            <h3 className="mt-1 truncate text-[15px] font-extrabold text-gray-900">{entry.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{entry.subtitle}</p>
          </div>
        </div>
        {active && <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--zana-primary-light)] px-3 py-2 text-xs font-bold text-[#007D68]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#00A082]"/>{statusText}</div>}
        {active && renderProgress(entry)}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <div><p className="text-sm font-black text-gray-900">{money(entry.amount)}</p><p className="mt-0.5 text-[10px] text-gray-400">{dateOf(entry.date).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}</p></div>
          <button onClick={()=>setSelected(entry)} className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700">{t('Details')}<ChevronRight size={14}/></button>
        </div>
      </div>
    </article>;
  };

  if (loading) return <div className="zana-page-enter zana-orders-page min-h-[70vh] bg-[var(--background)] p-4"><div className="h-8 w-36 animate-pulse rounded-lg bg-[#E3EFEB]"/><div className="mt-5 flex gap-2">{[1,2,3].map(i=><div key={i} className="h-9 w-20 animate-pulse rounded-full bg-[#E3EFEB]"/>)}</div>{[1,2].map(i=><div key={i} className="mt-4 h-52 animate-pulse rounded-3xl bg-white shadow-sm"/>)}</div>;

  return <main className="zana-page-enter zana-orders-page min-h-screen bg-[var(--background)] px-4 pb-28 pt-5 text-gray-900">
    <header className="mb-5 flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#00A082]">ZANA · KIGALI</p><h1 className="mt-1 text-[28px] font-black tracking-tight">{t('Orders')}</h1><p className="mt-1 text-xs text-gray-500">{t('Track your deliveries, food and shopping orders.')}</p></div>
      <button onClick={()=>load(true)} disabled={refreshing} className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-gray-600" aria-label={t('Refresh orders')}><RefreshCw size={17} className={refreshing?'animate-spin':''}/></button>
    </header>
    {offline && <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{t('You are offline. Showing the last available orders.')}{lastUpdated&&<span className="mt-1 block">{t('Last updated')}: {lastUpdated.toLocaleTimeString()}</span>}</div>}

    <div className="mb-4 grid grid-cols-2 rounded-2xl bg-[var(--zana-primary-light)] p-1" role="tablist">
      {(['ACTIVE','HISTORY'] as View[]).map(value=><button key={value} role="tab" aria-selected={view===value} onClick={()=>setView(value)} className={`rounded-xl py-2.5 text-sm font-bold ${view===value?'bg-white text-[#007D68] shadow-sm':'text-gray-500'}`}>{t(value==='ACTIVE'?'Active':'History')}<span className="ml-1 text-[10px]">{entries.filter(e=>value==='ACTIVE'?isActive(e):!isActive(e)).length}</span></button>)}
    </div>
    {view==='HISTORY' && <div className="mb-4 flex gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3"><Search size={15} className="shrink-0 text-gray-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Search orders or addresses')} className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none" aria-label={t('Search order history')}/></label>
      <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} aria-label={t('Filter by date')} className="max-w-[124px] rounded-xl border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-600"><option value="ALL">{t('Any time')}</option><option value="7D">{t('Last 7 days')}</option><option value="30D">{t('Last 30 days')}</option><option value="MONTH">{t('This month')}</option></select>
    </div>}
    {view==='ACTIVE' && filtered.length===0 && <div className="rounded-3xl border border-dashed border-[#C9DDD6] bg-white px-6 py-12 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#E8F5F1] text-[#00A082]"><Package size={28}/></div><h2 className="mt-4 text-lg font-black">{t('No active deliveries or orders')}</h2><p className="mx-auto mt-2 max-w-[260px] text-sm text-gray-500">{t('Your active deliveries, food and shopping orders will appear here.')}</p></div>}
    {view==='HISTORY' && filtered.length===0 && <div className="rounded-3xl bg-white px-6 py-12 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8F5F1] text-[#00A082]"><ShoppingBag size={24}/></div><h2 className="mt-4 text-base font-black">{t('No orders found')}</h2><p className="mt-1 text-sm text-gray-500">{t('Try changing your filters or search.')}</p><button onClick={()=>{setQuery('');setDateFilter('ALL')}} className="mt-4 text-sm font-bold text-[#00866F]">{t('Clear filters')}</button></div>}
    <div className="space-y-5">{groups.map(group=><section key={group.title}><h2 className="mb-3 text-xs font-extrabold uppercase tracking-[.12em] text-gray-400">{t(group.title)}</h2><div className="space-y-3">{group.rows.map(renderEntry)}</div></section>)}</div>
    <p className="mt-6 text-center text-[10px] text-gray-400">{t('Tap refresh to check for updates.')}</p>

    {selected && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]" onClick={()=>setSelected(null)}><section role="dialog" aria-modal="true" aria-label={t('Order details')} className="max-h-[min(82vh,720px)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#00A082]">{t('Order details')}</p><h2 className="mt-1 text-lg font-black">{selected.title}</h2></div><button onClick={()=>setSelected(null)} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100" aria-label={t('Close details')}><X size={18}/></button></div>
      {selected.kind==='delivery' && <><div className="space-y-3 rounded-2xl bg-gray-50 p-4"><p className="text-sm font-semibold">{selected.raw.itemDescription}</p><p className="text-xs text-gray-500">{t('Pickup')}: {selected.raw.pickupAddress}</p><p className="text-xs text-gray-500">{t('Drop-off')}: {selected.raw.dropoffAddress}</p><p className="text-xs text-gray-500">{dateOf(selected.date).toLocaleString()}</p></div><div className="mt-4 flex justify-between font-black"><span>{t('Delivery fee')}</span><span>{money(selected.amount)}</span></div>{selected.status==='DELIVERED'&&<button onClick={()=>{setReview({target:'DELIVERY',deliveryId:selected.id,title:t('How was this delivery?'),subtitle:selected.raw.itemDescription});setSelected(null)}} className="mt-4 w-full rounded-xl border border-[#00A082] py-3 text-sm font-bold text-[#00866F]">{t('Rate delivery')}</button>}</>}
      {selected.kind==='market' && <><div className="space-y-2">{(selected.raw.items??[]).map((item:any)=><div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.product?.name??t('Item')} ×{item.quantity}</span><span>{money(Number(item.product?.price??0)*Number(item.quantity??0))}</span></div>)}</div><div className="mt-4 rounded-2xl bg-gray-50 p-4"><div className="flex justify-between text-sm"><span className="text-gray-500">{t('Order total')}</span><strong>{money(selected.amount)}</strong></div>{selected.raw.dropoffAddress&&<p className="mt-2 text-xs text-gray-500">{t('Delivery address')}: {selected.raw.dropoffAddress}</p>}<p className="mt-2 text-xs text-gray-500">{dateOf(selected.date).toLocaleString()}</p></div></>}
      {selected.kind==='market' && ['PENDING','CONFIRMED'].includes(selected.status) && <button disabled={cancelling} onClick={async()=>{setCancelling(true);try{await cancelOrder(selected.id);await load(true);setSelected(null)}catch(e:any){window.alert(e?.message??t('Could not cancel this order.'))}finally{setCancelling(false)}}} className="mt-4 w-full rounded-xl border border-red-200 py-3 text-sm font-bold text-red-600 disabled:opacity-50">{cancelling?t('Cancelling…'):t('Cancel order')}</button>}
    </section></div>}
    {review && <ReviewSheet target={review.target} deliveryId={review.deliveryId} merchantId={review.merchantId} orderId={review.orderId} title={review.title} subtitle={review.subtitle} onDone={()=>setReview(null)}/>}
  </main>;
}

export default function OrdersPage() {
  return <Suspense fallback={<ZanaLoading label="Loading your ZANA experience"/>}><OrdersContent/></Suspense>;
}
