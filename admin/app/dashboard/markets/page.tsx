'use client';
import { useEffect, useState } from 'react';
import { Plus, MapPin, ToggleLeft, ToggleRight, Package, X } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getMarkets, createMarket, updateMarket, addMarketProduct } from '../../../lib/api/admin';

export default function MarketsPage() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', address: '', lat: '', lng: '' });
  const [saving, setSaving] = useState(false);

  // Previously the only way to list a market item at all was through an
  // agent's own app — admin had no upload path of their own.
  const [addingProductFor, setAddingProductFor] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: '', price: '', stock: '' });
  const [savingProduct, setSavingProduct] = useState(false);

  const load = () => getMarkets().then(setMarkets).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    await createMarket({ ...form, lat: Number(form.lat), lng: Number(form.lng) });
    setShowForm(false);
    setForm({ name: '', description: '', address: '', lat: '', lng: '' });
    load();
    setSaving(false);
  };

  const handleAddProduct = async (marketId: string) => {
    if (!productForm.name.trim() || !productForm.price) return;
    setSavingProduct(true);
    try {
      await addMarketProduct(marketId, {
        name: productForm.name.trim(),
        price: Number(productForm.price),
        stock: productForm.stock ? Number(productForm.stock) : undefined,
      });
      setProductForm({ name: '', price: '', stock: '' });
      setAddingProductFor(null);
      load();
    } finally {
      setSavingProduct(false);
    }
  };

  return (
    <AdminShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Markets</h1>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm"><Plus size={15} /> Add Market</button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
            <h2 className="font-semibold text-gray-900 mb-3">New Market</h2>
            <div className="grid grid-cols-2 gap-3">
              {[['name','Market name'],['description','Description'],['address','Address'],['lat','Latitude'],['lng','Longitude']].map(([k,p]) => (
                <input key={k} value={(form as any)[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} placeholder={p} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreate} disabled={saving || !form.name || !form.address} className="bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-40">Save</button>
              <button onClick={() => setShowForm(false)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {markets.map(m => (
            <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin size={11} />{m.address}</p>
                  {m.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                  <p className="text-xs text-gray-500 mt-2">{m.agents?.length ?? 0} agent{m.agents?.length !== 1 ? 's' : ''} assigned · {m.products?.length ?? 0} item{m.products?.length !== 1 ? 's' : ''} listed</p>
                </div>
                <button onClick={() => updateMarket(m.id, { active: !m.active }).then(load)} className={`${m.active ? 'text-green-600' : 'text-gray-400'}`}>
                  {m.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
              </div>

              {m.products?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                  {m.products.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{p.name}</span>
                      <span className="font-semibold text-gray-900">{p.price?.toLocaleString()} RWF</span>
                    </div>
                  ))}
                </div>
              )}

              {addingProductFor === m.id ? (
                <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
                  <input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Item name" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                  <div className="flex gap-2">
                    <input value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value.replace(/\D/g,'') }))}
                      placeholder="Price (RWF)" inputMode="numeric" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                    <input value={productForm.stock} onChange={e => setProductForm(f => ({ ...f, stock: e.target.value.replace(/\D/g,'') }))}
                      placeholder="Stock (optional)" inputMode="numeric" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAddProduct(m.id)} disabled={savingProduct || !productForm.name.trim() || !productForm.price}
                      className="bg-zana-primary text-white font-semibold px-3 py-1.5 rounded-lg text-xs disabled:opacity-40">
                      {savingProduct ? 'Adding…' : 'Add item'}
                    </button>
                    <button onClick={() => { setAddingProductFor(null); setProductForm({ name: '', price: '', stock: '' }); }}
                      className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingProductFor(m.id)}
                  className="mt-3 pt-3 border-t border-gray-50 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-zana-primary">
                  <Package size={13} /> Add item to this market
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
