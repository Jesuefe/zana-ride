'use client';

import { useEffect, useState } from 'react';
import { Store, Plus, Package, Check, Trash2 } from 'lucide-react';
import { api } from '../../lib/api/client';

/**
 * Agent view. Agents work inside a physical market: they list what is on
 * the stalls today, then buy and pack whatever customers order.
 */
export default function AgentPage() {
  const [market, setMarket] = useState<any>(null);
  const [tab, setTab] = useState<'orders' | 'items'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New item form
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get<any>('/agent/me').then(r => setMarket(r.market)).catch(e => setError(e?.message ?? ''));
    api.get<any[]>('/agent/orders').then(setOrders).catch(() => {});
    api.get<any[]>('/agent/products').then(setProducts).catch(() => {});
  };

  useEffect(() => {
    load();
    setLoading(false);
    const t = setInterval(() => {
      api.get<any[]>('/agent/orders').then(setOrders).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const addItem = async () => {
    if (!name.trim() || !price) return;
    setSaving(true);
    try {
      await api.post('/agent/products', { name: name.trim(), price: Number(price), stock: 99 });
      setName(''); setPrice(''); setAdding(false);
      api.get<any[]>('/agent/products').then(setProducts).catch(() => {});
    } catch (e: any) {
      setError(e?.message ?? 'Could not add the item');
    } finally { setSaving(false); }
  };

  const removeItem = async (id: string) => {
    await api.delete(`/agent/products/${id}`).catch(() => {});
    setProducts(p => p.filter(x => x.id !== id));
  };

  const setStatus = async (id: string, status: string) => {
    await api.patch(`/agent/orders/${id}/status`, { status }).catch(() => {});
    api.get<any[]>('/agent/orders').then(setOrders).catch(() => {});
  };

  // Agents only ever move an order through these three states — the rider
  // handles everything after Ready for pickup.
  const nextStep = (status: string) =>
    status === 'PENDING' ? { label: 'Start shopping', to: 'PREPARING' }
    : status === 'CONFIRMED' ? { label: 'Start shopping', to: 'PREPARING' }
    : status === 'PREPARING' ? { label: 'Ready for pickup', to: 'READY_FOR_PICKUP' }
    : null;

  const active = orders.filter(o =>
    ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status));

  if (loading) return <div className="p-6">Loading…</div>;

  if (error && !market) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error}</p>
        <p className="text-xs text-gray-500 mt-2">
          This account is not set up as a market agent.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {/* Market header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-zana-primary-light flex items-center justify-center">
          <Store size={20} className="text-zana-primary" />
        </div>
        <div>
          <p className="text-xs text-gray-500">Agent at</p>
          <p className="font-black text-gray-900">{market?.name ?? '—'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {([['orders', `Orders${active.length ? ` (${active.length})` : ''}`], ['items', 'Today\'s items']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 ${
              tab === id ? 'border-zana-primary bg-zana-primary text-white' : 'border-gray-100 bg-white text-gray-600'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders */}
      {tab === 'orders' && (
        <div className="space-y-3">
          {active.length === 0 && (
            <div className="text-center py-12">
              <Package size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No orders waiting</p>
            </div>
          )}

          {active.map(o => {
            const step = nextStep(o.status);
            return (
              <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-xs font-bold text-zana-primary">{o.trackingCode ?? o.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500">{o.customer?.firstName ?? 'Customer'}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    {o.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="space-y-1 py-2 border-y border-gray-50 my-2">
                  {o.items?.map((i: any) => (
                    <div key={i.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{i.product?.name} ×{i.quantity}</span>
                      <span className="text-gray-500">{(i.price * i.quantity).toLocaleString()} RWF</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-black text-gray-900">{o.total?.toLocaleString()} RWF</span>
                  {step && (
                    <button onClick={() => setStatus(o.id, step.to)}
                      className="bg-zana-primary text-white text-xs font-bold px-4 py-2.5 rounded-xl">
                      {step.label}
                    </button>
                  )}
                  {o.status === 'READY_FOR_PICKUP' && (
                    <span className="flex items-center gap-1 text-xs font-bold text-zana-primary">
                      <Check size={13} /> Rider on the way
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Items */}
      {tab === 'items' && (
        <div>
          <button onClick={() => setAdding(a => !a)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-zana-primary/40 text-zana-primary font-bold py-3 rounded-2xl mb-3">
            <Plus size={16} /> List an item
          </button>

          {adding && (
            <div className="bg-white rounded-2xl p-4 mb-3 space-y-2">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Item name, e.g. Tomatoes (1kg)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              <input value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))}
                placeholder="Price in RWF" inputMode="numeric"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              <button onClick={addItem} disabled={saving || !name.trim() || !price}
                className="w-full bg-zana-primary text-white font-bold py-3 rounded-xl disabled:opacity-40">
                {saving ? 'Saving…' : 'Add to today\'s list'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {products.length === 0 && !adding && (
              <p className="text-center text-sm text-gray-500 py-10">
                Nothing listed yet. Add what is on the stalls today.
              </p>
            )}
            {products.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-900">{p.name}</p>
                  <p className="text-sm text-zana-primary font-black">{p.price?.toLocaleString()} RWF</p>
                </div>
                <button onClick={() => removeItem(p.id)}
                  className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 size={15} className="text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
