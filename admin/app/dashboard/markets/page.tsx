'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, MapPin, ToggleLeft, ToggleRight, Package, X, Pencil, Trash2, ImagePlus } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getMarkets, createMarket, updateMarket, addMarketProduct } from '../../../lib/api/admin';
import { api } from '../../../lib/api/client';

const emptyProductForm = { name: '', price: '', referenceCost: '', stock: '', imageBase64: '' };

export default function MarketsPage() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', address: '', lat: '', lng: '' });
  const [saving, setSaving] = useState(false);

  // Previously the only way to list a market item at all was through an
  // agent's own app — admin had no upload path of their own. Editing,
  // deleting, and adding a photo didn't exist for admin at all either,
  // even after the upload path itself was added.
  const [productPanelFor, setProductPanelFor] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Compressed client-side, matching the same pattern already proven for
  // merchant storefront photos — phone photos are large, and a product
  // thumbnail never needs to be full resolution.
  const handleImageSelect = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 800;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setProductForm(f => ({ ...f, imageBase64: canvas.toDataURL('image/jpeg', 0.8) }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const openAddForm = (marketId: string) => {
    setProductPanelFor(marketId);
    setEditingProductId(null);
    setProductForm(emptyProductForm);
  };

  const openEditForm = (marketId: string, p: any) => {
    setProductPanelFor(marketId);
    setEditingProductId(p.id);
    setProductForm({
      name: p.name ?? '',
      price: String(p.price ?? ''),
      referenceCost: p.referenceCost != null ? String(p.referenceCost) : '',
      stock: p.stock != null ? String(p.stock) : '',
      imageBase64: '',
    });
  };

  const closeProductPanel = () => {
    setProductPanelFor(null);
    setEditingProductId(null);
    setProductForm(emptyProductForm);
  };

  const handleSaveProduct = async (marketId: string) => {
    if (!productForm.name.trim() || !productForm.price) return;
    setSavingProduct(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        price: Number(productForm.price),
        referenceCost: productForm.referenceCost ? Number(productForm.referenceCost) : undefined,
        stock: productForm.stock ? Number(productForm.stock) : undefined,
        imageBase64: productForm.imageBase64 || undefined,
      };
      if (editingProductId) {
        await api.patch(`/admin/products/${editingProductId}`, payload);
      } else {
        await addMarketProduct(marketId, payload);
      }
      closeProductPanel();
      load();
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/admin/products/${id}`);
      load();
    } finally {
      setDeletingId(null);
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
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Package size={13} className="text-gray-400" /></div>}
                      <span className="flex-1 text-gray-700 truncate">{p.name}</span>
                      <span className="font-semibold text-gray-900 shrink-0">{p.price?.toLocaleString()} RWF</span>
                      <button onClick={() => openEditForm(m.id, p)} className="text-gray-400 shrink-0"><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteProduct(p.id)} disabled={deletingId === p.id} className="text-red-400 shrink-0 disabled:opacity-40"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}

              {productPanelFor === m.id ? (
                <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {productForm.imageBase64
                        ? <img src={productForm.imageBase64} alt="" className="w-full h-full object-cover" />
                        : <ImagePlus size={16} className="text-gray-400" />}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => handleImageSelect(e.target.files?.[0])} />
                    <input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Item name" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <input value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value.replace(/\D/g,'') }))}
                      placeholder="Selling price (RWF)" inputMode="numeric" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                    <input value={productForm.referenceCost} onChange={e => setProductForm(f => ({ ...f, referenceCost: e.target.value.replace(/\D/g,'') }))}
                      placeholder="Normal stall price" inputMode="numeric" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                  </div>
                  <input value={productForm.stock} onChange={e => setProductForm(f => ({ ...f, stock: e.target.value.replace(/\D/g,'') }))}
                    placeholder="Stock (optional)" inputMode="numeric" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveProduct(m.id)} disabled={savingProduct || !productForm.name.trim() || !productForm.price}
                      className="bg-zana-primary text-white font-semibold px-3 py-1.5 rounded-lg text-xs disabled:opacity-40">
                      {savingProduct ? 'Saving…' : editingProductId ? 'Save changes' : 'Add item'}
                    </button>
                    <button onClick={closeProductPanel}
                      className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => openAddForm(m.id)}
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
