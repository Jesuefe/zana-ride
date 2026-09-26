'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Store, Package, ShoppingBag, Wallet, Truck, Clock3, CheckCircle2,
  AlertTriangle, Phone, MapPin, ChevronRight, Plus, Trash2, X, RefreshCw
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { requestAgentPriceChange, fetchAgentEarnings } from '../../lib/api/merchant';
import VoiceCall from '../../components/VoiceCall';
import { getStoredLang, setStoredLang, t, type Lang } from '../../lib/lang';

const money = (n: any) => Number(n || 0).toLocaleString() + ' RWF';
const label = (s: string) => (s || '').replace(/_/g, ' ');
const activeStatuses = ['PENDING','CONFIRMED','PREPARING','READY_FOR_PICKUP'];
const deliveryStatuses = ['COURIER_ASSIGNED','PICKED_UP','DELIVERED'];

export default function AgentPage() {
  const [view, setView] = useState('overview');
  const [market, setMarket] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [call, setCall] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [purchaseFunds, setPurchaseFunds] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [lang, setLang] = useState<Lang>('en');

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editReason, setEditReason] = useState('');

  const setRouteView = (next: string) => {
    setView(next);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '/agent?view=' + next);
  };

  const load = async () => {
    try { const r = await api.get<any>('/agent/me'); setMarket(r.market); } catch (e: any) { setError(e?.message ?? ''); }
    await Promise.all([
      api.get<any[]>('/agent/orders').then(setOrders).catch(() => {}),
      api.get<any[]>('/agent/products').then(setProducts).catch(() => {}),
      api.get<any[]>('/agent/deliveries').then(setDeliveries).catch(() => {}),
      api.get<any>('/agent/wallet').then(setWallet).catch(() => {}),
      api.get<any[]>('/agent/purchase-funds').then(setPurchaseFunds).catch(() => {}),
      fetchAgentEarnings().then(setEarnings).catch(() => {}),
    ]);
  };

  useEffect(() => {
    setLang(getStoredLang());
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('view');
      if (q) setView(q);
    }
    load();
    const t = setInterval(() => {
      api.get<any[]>('/agent/orders').then(setOrders).catch(() => {});
      api.get<any[]>('/agent/deliveries').then(setDeliveries).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const active = useMemo(() => orders.filter(o => activeStatuses.includes(o.status)), [orders]);
  const shopping = active.filter(o => o.status === 'PREPARING');
  const ready = active.filter(o => o.status === 'READY_FOR_PICKUP');
  const pickedUp = deliveries.filter(d => d.status === 'PICKED_UP');
  const deliveredToday = deliveries.filter(d => d.status === 'DELIVERED');
  const todayKey = new Date().toDateString();
  const salesToday = orders.filter(o => new Date(o.createdAt).toDateString() === todayKey).reduce((s, o) => s + Number(o.total || 0), 0);
  const pendingIssues = orders.reduce((n, o) => n + (o.items || []).filter((i: any) => i.status === 'UNAVAILABLE_PENDING').length, 0);

  const openOrder = async (id: string) => {
    setLoadingDetail(true); setError('');
    try { setSelected(await api.get<any>('/agent/orders/' + id)); }
    catch (e: any) { setError(e?.message ?? 'Could not load order'); }
    finally { setLoadingDetail(false); }
  };

  const withdraw = async (id: string) => {
    setBusy('withdraw:' + id); setError('');
    try { await api.post('/agent/purchase-funds/' + id + '/withdraw', {}); await load(); if (selected?.id === id) await openOrder(id); }
    catch (e: any) { setError(e?.message ?? 'Could not withdraw purchasing funds'); }
    finally { setBusy(null); }
  };

  const status = async (id: string, next: string) => {
    setBusy(id); setError('');
    try {
      const o = orders.find(x => x.id === id);
      if (!o) throw new Error('Order not found');

      // Starting shopping first creates the order-scoped purchasing allocation.
      // This is deliberately separate from the agent's normal earnings wallet.
      if (next === 'PREPARING' && ['PENDING', 'CONFIRMED'].includes(o.status)) {
        await api.post('/agent/purchase-funds/' + id + '/accept', {});
        await load();
        if (selected?.id === id) await openOrder(id);
        return;
      }

      const fund = purchaseFunds.find(f => f.orderId === id);
      if (next === 'PREPARING' && fund?.status === 'AVAILABLE') {
        await api.post('/agent/purchase-funds/' + id + '/withdraw', {});
        await load();
        return;
      }

      const actualPrices: Record<string, number> = {};
      if (next === 'READY_FOR_PICKUP') {
        if (!fund || fund.status !== 'WITHDRAWN') throw new Error('Withdraw the order shopping funds before marking it ready.');
        let actualSpend = 0;
        for (const item of o.items || []) {
          if (['REFUNDED','REMOVED','UNAVAILABLE_PENDING'].includes(item.status)) continue;
          const raw = window.prompt('Actual purchase cost for ' + (item.product?.name || 'item') + ' (RWF). Cancel to use the reference cost.');
          const reference = Number(item.referenceCostAtOrder ?? item.price ?? item.product?.price ?? 0);
          const n = raw === null || raw === '' ? reference : Number(raw);
          if (!Number.isInteger(n) || n < 0) throw new Error('Purchase cost must be a whole number.');
          actualPrices[item.id] = n;
          actualSpend += n * Number(item.quantity || 0);
        }
        if (actualSpend > Number(fund.withdrawnAmount)) throw new Error('Actual shopping spend cannot exceed the amount authorized for this order.');
        await api.post('/agent/purchase-funds/' + id + '/reconcile', { actualSpend });
      }

      await api.patch('/agent/orders/' + id + '/status', { status: next, ...(Object.keys(actualPrices).length ? { actualPrices } : {}) });
      await load();
      if (selected?.id === id) await openOrder(id);
    } catch (e: any) { setError(e?.message ?? 'Could not update order'); }
    finally { setBusy(null); }
  };

  const unavailable = async (orderId: string, itemId: string) => {
    if (!window.confirm('Mark this item unavailable? The customer will be notified and can choose Refund this item, Replace item, or Remove item.')) return;
    setBusy(itemId);
    try {
      await api.post('/agent/orders/' + orderId + '/items/' + itemId + '/unavailable', {});
      await load();
      await openOrder(orderId);
    } catch (e: any) { setError(e?.message ?? 'Could not issue refund'); }
    finally { setBusy(null); }
  };

  const addItem = async () => {
    if (!name.trim() || !price) return;
    setBusy('add');
    try {
      await api.post('/agent/products', { name: name.trim(), price: Number(price), referenceCost: Number(price), stock: 99 });
      setName(''); setPrice(''); setAdding(false); await load();
    } catch (e: any) { setError(e?.message ?? 'Could not add item'); }
    finally { setBusy(null); }
  };

  const removeItem = async (id: string) => {
    await api.delete('/agent/products/' + id).catch(() => {});
    setProducts(p => p.filter(x => x.id !== id));
  };

  const requestPrice = async () => {
    if (!editing || !editPrice) return;
    try {
      await requestAgentPriceChange(editing.id, { referenceCost: Number(editPrice), reason: editReason || 'Market price update' });
      setEditing(null); setEditPrice(''); setEditReason(''); await load();
    } catch (e: any) { setError(e?.message ?? 'Could not submit price change'); }
  };

  const statusNext = (s: string) => s === 'PENDING' || s === 'CONFIRMED' ? 'PREPARING' : s === 'PREPARING' ? 'READY_FOR_PICKUP' : null;
  const statusButton = (s: string) => s === 'PENDING' || s === 'CONFIRMED' ? 'Start shopping' : s === 'PREPARING' ? 'Mark ready for pickup' : null;
  const fundFor = (id: string) => purchaseFunds.find(f => f.orderId === id);

  const statCards = [
    [t('Today’s orders',lang), orders.length, ShoppingBag],
    [t('Purchasing funds',lang), purchaseFunds.filter(f=>['AVAILABLE','WITHDRAWN'].includes(f.status)).length, Wallet],
    [t('Orders',lang), active.filter(o => ['PENDING','CONFIRMED'].includes(o.status)).length, Clock3],
    ['Shopping now', shopping.length, Package],
    [t('Ready for rider',lang), ready.length, CheckCircle2],
    [t('Picked up',lang), pickedUp.length, Truck],
    [t('Delivered',lang), deliveredToday.length, CheckCircle2],
  ];

  if (error && !market) return <div className="p-8"><p className="text-sm text-red-600">{error}</p><p className="text-xs text-gray-500 mt-2">This account is not set up as a market agent.</p></div>;

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-zana-primary/10 flex items-center justify-center"><Store size={22} className="text-zana-primary" /></div>
          <div><p className="text-xs text-gray-500">Market agent</p><h1 className="text-2xl font-black text-gray-900">{market?.name || 'Market'}</h1><p className="text-xs text-gray-500">{market?.address || 'Operational dashboard'}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold flex items-center gap-2"><RefreshCw size={14}/> {t("Refresh",lang)}</button><select value={lang} onChange={e=>{const v=e.target.value as Lang;setLang(v);setStoredLang(v)}} className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold"><option value="en">English</option><option value="rw">Ikinyarwanda</option><option value="fr">Français</option></select>
          <div className="bg-white rounded-xl border border-gray-200 px-3 py-2"><span className="text-[10px] text-gray-400 block">{t("Agent wallet",lang)}</span><span className={"font-black text-sm "+(Number(wallet?.balance||0)<0?"text-red-600":"")}>{money(wallet?.balance)}</span></div>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-xs font-semibold flex justify-between"><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}

      {view === 'overview' && <>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {statCards.map(([title, value, Icon]: any) => <button key={title} onClick={() => setRouteView(title === 'Orders today' ? 'orders' : title === 'Picked up' || title === 'Delivered' ? 'deliveries' : 'orders')} className="bg-white rounded-2xl p-4 text-left border border-gray-100 shadow-sm hover:border-zana-primary/30"><div className="flex justify-between items-center"><span className="text-xs text-gray-500">{title}</span><Icon size={17} className="text-zana-primary"/></div><p className="text-2xl font-black mt-2">{value}</p></button>)}
        </div>
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex justify-between items-center mb-4"><div><h2 className="font-black">{t("Today’s orders",lang)}</h2><p className="text-xs text-gray-500">{t("Open any order for the complete receipt and timeline.",lang)}</p></div><button onClick={() => setRouteView('orders')} className="text-xs font-bold text-zana-primary">{t("View all",lang)}</button></div>
            <div className="space-y-2">{orders.slice(0, 8).map(o => <OrderRow key={o.id} order={o} onOpen={() => openOrder(o.id)} />)}{!orders.length && <Empty text="No market orders yet."/>}</div>
          </section>
          <section className="space-y-3">
            <div className="bg-zana-primary text-white rounded-2xl p-5"><p className="text-xs opacity-80">{t("Agent earnings",lang)}</p><p className="text-3xl font-black mt-1">{money(earnings?.totalEarning)}</p><p className="text-xs opacity-80 mt-1">{earnings?.settlements?.length || 0} settled orders</p></div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4"><div className="flex gap-3"><AlertTriangle className="text-amber-500" size={18}/><div><p className="font-bold text-sm">{t("Item issues",lang)}</p><p className="text-xs text-gray-500">{pendingIssues ? pendingIssues + ' item' + (pendingIssues > 1 ? 's are' : ' is') + ' waiting for customer action' : 'No item issues today.'}</p></div></div></div>
          </section>
        </div>
      </>}

      {view === 'orders' && <section>
        <div className="flex items-end justify-between mb-4"><div><h2 className="text-xl font-black">{t("Orders",lang)}</h2><p className="text-xs text-gray-500">{t("Shop, resolve unavailable items and prepare packages for pickup.",lang)}</p></div><span className="text-xs font-bold bg-zana-primary/10 text-zana-primary px-3 py-2 rounded-xl">{active.length} active</span></div>
        <div className="space-y-3">{orders.map(o => <OrderCard key={o.id} order={o} fund={fundFor(o.id)} onOpen={() => openOrder(o.id)} onUnavailable={unavailable} onStatus={status} onWithdraw={withdraw} busy={busy} lang={lang}/>) }{!orders.length && <Empty text="No orders for this market."/>}</div>
      </section>}

      {view === 'deliveries' && <section>
        <div className="mb-4"><h2 className="text-xl font-black">{t("Deliveries",lang)}</h2><p className="text-xs text-gray-500">{t("Packages a Zana rider has been assigned to or has picked up from your market.",lang)}</p></div>
        <div className="space-y-3">{deliveries.map(d => <DeliveryCard key={d.id} delivery={d} onCall={() => d.status !== 'DELIVERED' && setCall({ contextId: d.id, name: d.driver?.user?.firstName || 'Rider' })} />)}{!deliveries.length && <Empty text="No packages have been handed to a rider yet."/>}</div>
      </section>}

      {view === 'items' && <section>
        <div className="flex justify-between items-end mb-4"><div><h2 className="text-xl font-black">{t("Today’s items",lang)}</h2><p className="text-xs text-gray-500">{t("What you can physically source at the market today.",lang)}</p></div><button onClick={() => setAdding(x => !x)} className="bg-zana-primary text-white px-4 py-2.5 rounded-xl text-xs font-bold flex gap-2 items-center"><Plus size={15}/> List item</button></div>
        {adding && <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Item name, e.g. Tomatoes (1kg)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/><input value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))} placeholder="Market price in RWF" inputMode="numeric" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/><p className="text-[11px] text-gray-500">Zana calculates the customer price from the approved market markup.</p><button onClick={addItem} disabled={busy==='add'} className="w-full bg-zana-primary text-white font-bold py-3 rounded-xl text-sm">{busy==='add'?'Saving…':'Add to today’s list'}</button></div>}
        {editing && <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-2"><p className="font-bold text-sm">Request market price change</p><input value={editPrice} onChange={e=>setEditPrice(e.target.value.replace(/\D/g,''))} placeholder="Market price in RWF" inputMode="numeric" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/><input value={editReason} onChange={e=>setEditReason(e.target.value)} placeholder="Reason (optional)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/><div className="flex gap-2"><button onClick={requestPrice} className="flex-1 bg-zana-primary text-white font-bold py-2.5 rounded-xl text-sm">Submit request</button><button onClick={()=>setEditing(null)} className="px-4 border rounded-xl text-sm">Cancel</button></div></div>}
        <div className="grid md:grid-cols-2 gap-3">{products.map(p => <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3"><div className="flex-1"><p className="font-bold">{p.name}</p><p className="text-sm font-black text-zana-primary">{money(p.price)}</p><p className="text-[11px] text-gray-400">Reference market price: {money(p.referenceCost)}</p><p className="text-[10px] mt-1 text-gray-500">{p.available ? 'Available' : 'Not currently available'} · {p.status}</p></div><div className="flex gap-1"><button onClick={()=>{setEditing(p);setEditPrice(String(p.referenceCost||p.price))}} className="text-xs font-bold text-zana-primary px-2">Price</button><button onClick={()=>removeItem(p.id)} className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={15}/></button></div></div>)}</div>
      </section>}

      {view === 'wallet' && <section><div className="mb-4"><h2 className="text-xl font-black">Wallet</h2><p className="text-xs text-gray-500">Your agent earnings and wallet activity.</p></div><div className="grid md:grid-cols-3 gap-3 mb-5"><div className="bg-zana-primary text-white rounded-2xl p-5"><p className="text-xs opacity-80">Available balance</p><p className="text-3xl font-black">{money(wallet?.balance)}</p></div><div className="bg-white rounded-2xl border p-5"><p className="text-xs text-gray-500">Total earnings</p><p className="text-2xl font-black">{money(earnings?.totalEarning)}</p></div><div className="bg-white rounded-2xl border p-5"><p className="text-xs text-gray-500">Total markup</p><p className="text-2xl font-black">{money(earnings?.totalMarkup)}</p></div></div><div className="bg-white rounded-2xl border p-4"><h3 className="font-black mb-3">{t("Recent wallet activity",lang)}</h3><div className="space-y-2">{(wallet?.transactions||[]).map((t:any)=><div key={t.id} className="flex justify-between py-2 border-b border-gray-50 text-sm"><span>{t.description || t.reference || 'Wallet transaction'}</span><span className={t.amount>=0?'text-zana-primary font-bold':'text-red-500 font-bold'}>{t.amount>=0?'+':''}{money(t.amount)}</span></div>)}</div></div></section>}

      {selected && <OrderDetail order={selected} fund={fundFor(selected.id)} onClose={()=>setSelected(null)} onUnavailable={unavailable} onCall={(d:any)=>setCall({contextId:d.id,name:d.driver?.user?.firstName||'Rider'})} onWithdraw={withdraw} busy={busy} lang={lang}/>}
      {loadingDetail && <div className="fixed inset-0 z-40 bg-black/20 flex items-center justify-center"><div className="bg-white rounded-2xl px-5 py-4 text-sm font-bold">Loading order…</div></div>}
      {call && <VoiceCall context="delivery" contextId={call.contextId} participantLabel={call.name} onClose={()=>setCall(null)}/>}
    </div>
  );
}

function OrderRow({order,onOpen}:any){return <button onClick={onOpen} className="w-full text-left bg-gray-50 rounded-xl p-3 flex items-center gap-3 hover:bg-gray-100"><div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-zana-primary"><ShoppingBag size={16}/></div><div className="flex-1 min-w-0"><div className="flex justify-between gap-3"><p className="font-mono text-xs font-bold text-zana-primary">{order.trackingCode||order.id.slice(0,8)}</p><span className="text-[10px] font-bold uppercase text-gray-500">{label(order.status)}</span></div><p className="text-xs text-gray-600 truncate">{order.customer?.firstName||'Customer'} · {(order.items||[]).length} items · {money(order.total)}</p></div><ChevronRight size={15} className="text-gray-400"/></button>}

function OrderCard({order,fund,onOpen,onUnavailable,onStatus,onWithdraw,busy,lang}:any){
 const next=order.status==='PENDING'||order.status==='CONFIRMED'?'PREPARING':order.status==='PREPARING'?'READY_FOR_PICKUP':null;
 const lat=order.delivery?.dropoffLat??order.dropoffLat??order.lat; const lng=order.delivery?.dropoffLng??order.dropoffLng??order.lng;
 const maps=lat!=null&&lng!=null?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(String(lat)+','+String(lng)):null;
 return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
  <div className="flex justify-between gap-3 mb-3"><button onClick={onOpen} className="text-left flex-1"><p className="font-mono text-xs font-bold text-zana-primary">{order.trackingCode||order.id.slice(0,8)}</p><p className="font-bold text-sm">{order.customer?.firstName||t('Customer',lang)}</p><p className="text-[11px] text-gray-400">{new Date(order.createdAt).toLocaleString()}</p></button><span className="h-fit px-2.5 py-1 rounded-full bg-gray-100 text-[10px] font-bold uppercase">{label(order.status)}</span></div>
  <div className="space-y-2 border-y border-gray-50 py-3">{(order.items||[]).map((i:any)=><div key={i.id} className="flex items-center gap-2"><div className="flex-1"><p className={['REFUNDED','REMOVED'].includes(i.status)?'line-through text-gray-400':'text-sm font-medium'}>{i.product?.name} ×{i.quantity}</p><p className="text-[10px] text-gray-400">{i.status==='UNAVAILABLE_PENDING'?'Waiting for customer choice':i.status==='REFUNDED'?t('Refunded to customer',lang):i.status==='REMOVED'?'Removed · refunded to wallet':i.status==='REPLACED'?'Replaced with this item':money(i.price*i.quantity)}</p></div>{i.status==='AVAILABLE'&&['PENDING','CONFIRMED','PREPARING'].includes(order.status)&&<button disabled={busy===i.id} onClick={()=>onUnavailable(order.id,i.id)} className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1.5 rounded-lg">Unavailable</button>}</div>)}</div>
  {fund&&<div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3"><div className="flex justify-between items-center"><div><p className="text-[10px] font-bold uppercase text-emerald-700">{t('Purchasing funds',lang)}</p><p className="text-lg font-black text-emerald-900">{money(fund.authorizedAmount)}</p></div><span className="text-[10px] font-bold uppercase text-emerald-700">{label(fund.status)}</span></div><div className="grid grid-cols-3 gap-2 mt-3 text-[10px]"><div><span className="block text-gray-500">{t('Authorized',lang)}</span><b>{money(fund.authorizedAmount)}</b></div><div><span className="block text-gray-500">{t('Withdrawn',lang)}</span><b>{money(fund.withdrawnAmount)}</b></div><div><span className="block text-gray-500">{t('Actual spend',lang)}</span><b>{fund.actualSpend==null?'—':money(fund.actualSpend)}</b></div></div>{fund.remainingAmount>0&&<p className="text-[10px] text-red-700 mt-2">{t('Customer refund',lang)}: {money(fund.remainingAmount)} · {t('Recovered from agent',lang)}</p>}{fund.status==='AVAILABLE'&&<button disabled={busy==='withdraw:'+order.id} onClick={()=>onWithdraw(order.id)} className="w-full mt-3 bg-zana-primary text-white text-xs font-bold px-4 py-3 rounded-xl">{busy==='withdraw:'+order.id?'Processing…':t('Withdraw',lang)+' '+money(fund.authorizedAmount)}</button>}{fund.status==='WITHDRAWN'&&<p className="text-[10px] text-emerald-700 mt-2">{t('Registered number',lang)}: {fund.destinationPhone}</p>}</div>}
  <div className="mt-3 flex items-center gap-2"><div className="flex-1"><p className="font-black">{money(order.total)}</p>{lat!=null&&lng!=null&&<p className="text-[10px] text-gray-500">{t('Latitude / Longitude',lang)}: {lat}, {lng}</p>}</div>{maps&&<a href={maps} target="_blank" rel="noreferrer" className="text-[10px] font-bold border rounded-xl px-3 py-2">{t('Open in Maps',lang)}</a>}{next?<button disabled={busy===order.id} onClick={()=>onStatus(order.id,next)} className="bg-zana-primary text-white text-xs font-bold px-4 py-2.5 rounded-xl">{busy===order.id?'Saving…':next==='PREPARING'?t('Start shopping',lang):t('Mark ready for pickup',lang)}</button>:order.status==='READY_FOR_PICKUP'?<span className="text-xs font-bold text-zana-primary">{t('Waiting for rider',lang)}</span>:null}</div>
 </div>
}
function DeliveryCard({delivery,onCall}:any){const d=delivery.driver?.user;return <div className="bg-white rounded-2xl border border-gray-100 p-4"><div className="flex justify-between gap-3"><div><p className="font-mono text-xs font-bold text-zana-primary">{delivery.order?.trackingCode||delivery.trackingCode}</p><p className="font-bold text-sm">{delivery.order?.customer?.firstName||'Customer'}</p><p className="text-xs text-gray-500">{delivery.dropoffAddress}</p></div><span className="h-fit text-[10px] font-bold uppercase bg-gray-100 px-2.5 py-1 rounded-full">{label(delivery.status)}</span></div><div className="mt-3 flex items-center justify-between bg-gray-50 rounded-xl p-3"><div><p className="text-xs font-bold">{d?.firstName||'Zana rider'}</p><p className="text-[10px] text-gray-500">{delivery.driver?.vehicle||'Vehicle'} {delivery.driver?.plate||''}</p></div>{delivery.status!=='DELIVERED'&&d?.phone&&<div className="flex gap-2"><a href={'tel:'+d.phone} className="w-9 h-9 rounded-full bg-white border flex items-center justify-center text-zana-primary"><Phone size={15}/></a><button onClick={onCall} className="w-9 h-9 rounded-full bg-zana-primary text-white flex items-center justify-center"><Phone size={15}/></button></div>}</div></div>}

function OrderDetail({order,fund,onClose,onUnavailable,onCall,onWithdraw,busy,lang}:any){
 const d=order.delivery; const customer=order.customer; const loc=d||order;
 const lat=loc?.dropoffLat??order.dropoffLat??loc?.lat; const lng=loc?.dropoffLng??order.dropoffLng??loc?.lng;
 const maps=lat!=null&&lng!=null?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(String(lat)+','+String(lng)):null;
 return <div className="fixed inset-0 z-50 bg-black/40 flex justify-end"><div className="w-full max-w-2xl bg-gray-50 h-full overflow-y-auto shadow-2xl">
  <div className="sticky top-0 z-10 bg-white border-b px-5 py-4 flex justify-between items-center"><div><p className="font-mono text-xs text-zana-primary font-bold">{order.trackingCode||order.id}</p><h2 className="font-black text-lg">{t('Orders',lang)}</h2></div><button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={18}/></button></div>
  <div className="p-5 space-y-4">
   <section className="bg-white rounded-2xl p-4 border"><h3 className="font-black mb-3">{t('Customer',lang)}</h3><p className="font-bold">{customer?.firstName||'Customer'} {customer?.lastName||''}</p><p className="text-sm text-gray-500">{customer?.phone}</p><div className="mt-3 space-y-2">{(loc?.dropoffAddress||order.dropoffAddress)&&<div className="text-sm bg-gray-50 rounded-xl p-3"><MapPin size={13} className="inline mr-1"/>{loc?.dropoffAddress||order.dropoffAddress}</div>}{lat!=null&&lng!=null&&<div className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-xl p-3"><span><b>{t('Latitude / Longitude',lang)}</b>: {lat}, {lng}</span>{maps&&<a href={maps} target="_blank" rel="noreferrer" className="font-bold text-zana-primary">{t('Open in Maps',lang)}</a>}</div>}</div><div className="mt-3"><a href={'tel:'+customer?.phone} className="block border rounded-xl py-2 text-xs font-bold text-center"><Phone size={13} className="inline mr-1"/> Call customer</a></div></section>
   {fund&&<section className="bg-white rounded-2xl p-4 border"><h3 className="font-black mb-3">{t('Purchasing funds',lang)}</h3><div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-gray-500">{t('Authorized',lang)}</p><p className="text-xl font-black">{money(fund.authorizedAmount)}</p></div><div><p className="text-xs text-gray-500">{t('Withdrawn',lang)}</p><p className="text-xl font-black">{money(fund.withdrawnAmount)}</p></div><div><p className="text-xs text-gray-500">{t('Actual spend',lang)}</p><p className="text-xl font-black">{fund.actualSpend==null?'—':money(fund.actualSpend)}</p></div><div><p className="text-xs text-gray-500">{t('Customer refund',lang)}</p><p className="text-xl font-black">{fund.remainingAmount==null?'—':money(fund.remainingAmount)}</p></div></div>{fund.status==='AVAILABLE'&&<button onClick={()=>onWithdraw(order.id)} disabled={busy==='withdraw:'+order.id} className="w-full mt-4 bg-zana-primary text-white rounded-xl py-3 text-sm font-bold">{busy==='withdraw:'+order.id?'Processing…':t('Withdraw',lang)+' '+money(fund.authorizedAmount)}</button>}{fund.destinationPhone&&<p className="text-xs text-gray-500 mt-3">{t('Registered number',lang)}: <b>{fund.destinationPhone}</b></p>}{fund.remainingAmount>0&&<div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{t('Customer refund',lang)} {money(fund.remainingAmount)} · {t('Recovered from agent',lang)}</div>}</section>}
   <section className="bg-white rounded-2xl p-4 border"><h3 className="font-black mb-3">Receipt</h3>{(order.items||[]).map((i:any)=><div key={i.id} className="flex items-center gap-2 py-2 border-b border-gray-50"><div className="flex-1"><p className={i.status==='UNAVAILABLE'?'line-through text-gray-400':'font-medium text-sm'}>{i.product?.name} ×{i.quantity}</p><p className="text-[10px] text-gray-400">{i.status==='UNAVAILABLE_PENDING'?'Waiting for customer choice':i.status==='REFUNDED'?t('Refunded to customer',lang):i.status==='REMOVED'?'Removed · refunded to wallet':i.status==='REPLACED'?'Replaced with this item':money(i.price*i.quantity)}</p></div>{i.status==='AVAILABLE'&&['PENDING','CONFIRMED','PREPARING'].includes(order.status)&&<button disabled={busy===i.id} onClick={()=>onUnavailable(order.id,i.id)} className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1.5 rounded-lg">Unavailable</button>}</div>)}<div className="flex justify-between text-sm mt-3"><span>Delivery</span><span>{money(order.deliveryFee)}</span></div><div className="flex justify-between font-black text-lg mt-1"><span>Total</span><span>{money(order.total)}</span></div></section>
   <section className="bg-white rounded-2xl p-4 border"><h3 className="font-black mb-3">{t('Rider handoff',lang)}</h3>{d?<><div className="flex justify-between"><div><p className="font-bold">{d.driver?.user?.firstName||'Rider'}</p><p className="text-xs text-gray-500">{d.driver?.vehicle||''} {d.driver?.plate||''}</p></div><span className="text-[10px] font-bold uppercase bg-gray-100 px-2 py-1 rounded-full">{label(d.status)}</span></div>{d.driver?.user?.phone&&d.status!=='DELIVERED'&&<div className="flex gap-2 mt-3"><a href={'tel:'+d.driver.user.phone} className="flex-1 border rounded-xl py-2 text-xs font-bold text-center">Phone call</a><button onClick={()=>onCall(d)} className="flex-1 bg-zana-primary text-white rounded-xl py-2 text-xs font-bold">Zana call</button></div>}</>:<p className="text-sm text-gray-500">{t('Waiting for rider',lang)}</p>}</section>
   <section className="bg-white rounded-2xl p-4 border"><h3 className="font-black mb-3">Order timeline</h3><div className="space-y-3"><TimelineDot title="Customer placed order" date={order.createdAt}/>{(order.timeline||[]).map((x:any)=><TimelineDot key={x.id} title={x.action.replace(/_/g,' ')} date={x.createdAt} detail={x.metadataJson}/>)}{d?.assignedAt&&<TimelineDot title="Rider assigned" date={d.assignedAt}/>} {d?.pickedUpAt&&<TimelineDot title="Picked up" date={d.pickedUpAt}/>} {d?.deliveredAt&&<TimelineDot title="Delivered" date={d.deliveredAt}/>}</div></section>
  </div></div></div>
}
function TimelineDot({title,date,detail}:any){return <div className="flex gap-3"><div className="w-2.5 h-2.5 rounded-full bg-zana-primary mt-1.5 shrink-0"/><div><p className="text-xs font-bold capitalize">{title}</p><p className="text-[10px] text-gray-400">{new Date(date).toLocaleString()}</p>{detail&&<p className="text-[10px] text-gray-500 mt-0.5">{detail}</p>}</div></div>}
function Empty({text}:{text:string}){return <div className="bg-white rounded-2xl border border-dashed p-10 text-center"><Package size={28} className="mx-auto text-gray-200 mb-2"/><p className="text-sm text-gray-500">{text}</p></div>}
