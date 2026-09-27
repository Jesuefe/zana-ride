'use client';
import { useEffect, useState } from 'react';
import { Plus, Camera, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { fetchMyProducts, createProduct, updateProduct, Product, WEIGHT_OPTIONS } from '../../lib/api/merchant';
import { compressImage } from '../../lib/image';
import { ApiError } from '../../lib/api/client';
import { useLang } from '../../lib/LangContext';

const CATEGORIES = [
  { value: 'FOOD', label: 'Food & Drinks' },
  { value: 'GIFTS', label: 'Gifts' },
  { value: 'GOODS', label: 'General Goods' },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  DISABLED: 'bg-gray-100 text-gray-600',
};

export default function ProductsPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', category: 'FOOD' as any, stock: '', imageBase64: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => fetchMyProducts().then(setProducts).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setForm(f => ({ ...f, imageBase64: compressed }));
  };

  const handleCreate = async () => {
    setSaving(true); setError('');
    try {
      await createProduct({
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        category: form.category,
        imageBase64: form.imageBase64 || undefined,
        stock: form.stock ? Number(form.stock) : undefined,
      });
      setShowForm(false);
      setForm({ name: '', description: '', price: '', category: 'FOOD', stock: '', imageBase64: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create product.');
    } finally { setSaving(false); }
  };

  const handleToggle = async (p: Product) => {
    await updateProduct(p.id, { available: !p.available });
    load();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('My Products')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("New products go to admin for approval before they're visible.")}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm"><Plus size={15} /> Add Product</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">{t('New Product')}</h2>
          <div className="space-y-3">
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder={t('Product name')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder={t('Description (optional)')} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
            <div className="grid grid-cols-3 gap-2">
              <input value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} placeholder={t('Price (RWF)')} type="number" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} placeholder={t('Stock')} type="number" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value as any}))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
              </select>
            </div>
            {form.imageBase64 ? (
              <div className="relative h-32 rounded-xl overflow-hidden bg-gray-100">
                <img src={form.imageBase64} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setForm(f => ({...f, imageBase64: ''}))} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"><X size={12} className="text-white" /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-5 cursor-pointer">
                <Camera size={18} className="text-gray-400" />
                <span className="text-sm text-gray-500">{t('Add product photo')}</span>
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
            )}
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={handleCreate} disabled={saving || !form.name || !form.price} className="bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-40">{saving ? t('Submitting…') : t('Submit for Review')}</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm">{t('Cancel')}</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {products.map(p => (
          <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm flex gap-3">
            {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" /> : <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[p.status]}`}{t(p.status.charAt(0)+p.status.slice(1).toLowerCase())}</span>
              </div>
              <p className="text-sm font-bold text-zana-primary mt-0.5">{p.price.toLocaleString()} RWF</p>
              <p className="text-xs text-gray-500">{t('Stock')}: {p.stock} · {t(p.category === 'FOOD' ? 'Food & Drinks' : p.category === 'GIFTS' ? 'Gifts' : 'General Goods')}</p>
              {p.adminNote && <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">{p.adminNote}</p>}
            </div>
            <button onClick={() => handleToggle(p)} className={p.available ? 'text-green-600' : 'text-gray-400'}>
              {p.available ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            </button>
          </div>
        ))}
        {products.length === 0 && <p className="text-sm text-gray-500 text-center py-10">{t('No products yet. Add your first one!')}</p>}
      </div>
    </div>
  );
}
// Note: deleteProduct added to api layer
