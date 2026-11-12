'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Package, Plus, Tag } from 'lucide-react';
import Topbar from '../../components/Topbar';
import { ApiError } from '../../lib/api/client';
import { createMerchantPromotion, fetchMerchantPromotions, fetchMyProducts, fetchMyMerchant, type MerchantPromotion, type Product } from '../../lib/api/merchant';

export default function PromotionsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [promoExempt, setPromoExempt] = useState(false);
  const [promotions, setPromotions] = useState<MerchantPromotion[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [comboPrice, setComboPrice] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedProducts = useMemo(() => products.filter(p => selected.includes(p.id)), [products, selected]);
  const regularTotal = selectedProducts.reduce((sum, p) => sum + p.price, 0);
  const durationDays = startsAt && endsAt ? Math.floor((Date.parse(endsAt + 'T00:00:00Z') - Date.parse(startsAt + 'T00:00:00Z')) / 86400000) + 1 : 0;

  const load = async () => {
    setLoading(true);
    try {
      const [p, promos, merchant] = await Promise.all([fetchMyProducts(), fetchMerchantPromotions(), fetchMyMerchant()]);
      setProducts(p);
      setPromotions(promos);
      setPromoExempt(!!merchant.promoExempt);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load promotions.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggleProduct = (id: string) => setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);

  const submit = async () => {
    setError(''); setSuccess('');
    if (selected.length < 2) { setError('Choose at least two products to create a combo.'); return; }
    if (!startsAt || !endsAt || durationDays < 1 || (!promoExempt && durationDays > 7)) { setError(promoExempt ? 'Choose a valid date range within one calendar month.' : 'Choose a continuous date range of 1–7 days.'); return; }
    if (Number(comboPrice) <= 0 || Number(comboPrice) >= regularTotal) { setError('Combo price must be lower than the combined normal prices.'); return; }
    setSaving(true);
    try {
      await createMerchantPromotion({ title, description: description || undefined, productIds: selected, comboPrice: Number(comboPrice), startsAt: new Date(startsAt + 'T00:00:00.000Z').toISOString(), endsAt: new Date(Date.parse(endsAt + 'T00:00:00.000Z') + 86400000).toISOString() });
      setSuccess('Your combo promotion has been submitted for Zana review.');
      setTitle(''); setDescription(''); setComboPrice(''); setStartsAt(''); setEndsAt(''); setSelected([]);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit your promotion.');
    } finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <Topbar title="Combo promotions" subtitle="Create a discounted bundle from your approved products" />
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-amber-900"><CalendarDays size={17}/> Monthly promotion rule</div>
      <p className="mt-1 text-sm leading-6 text-amber-800">{promoExempt ? 'Your store has a Zana-approved promotion exemption. You may schedule promotions beyond the standard seven-day allowance, but each promotion must remain within one calendar month. Promotions must contain at least two approved products and are reviewed by Zana before going live.' : 'Each store may run promotions for up to 7 consecutive days per calendar month. Promotions must contain at least two approved products and are reviewed by Zana before going live. Ask Zana administration if your store needs an exemption.'}</p>
    </div>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><Tag size={18} className="text-zana-primary"/><h2 className="font-bold text-gray-900">Build a combo</h2></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Promotion name" className="rounded-xl border border-gray-200 px-3 py-3 text-sm"/>
        <input value={comboPrice} onChange={e=>setComboPrice(e.target.value)} type="number" min="1" placeholder="Combo price (RWF)" className="rounded-xl border border-gray-200 px-3 py-3 text-sm"/>
      </div>
      <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short description (optional)" rows={2} className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm"/>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-gray-800">Select products</h3><span className="text-xs text-gray-500">{selected.length} selected · Normal total {regularTotal.toLocaleString()} RWF</span></div>
        {products.filter(p=>p.status==='APPROVED' && p.available).length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">You need approved and available products before creating a promotion.</p> :
          <div className="grid gap-2 sm:grid-cols-2">{products.filter(p=>p.status==='APPROVED' && p.available).map(p=><label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected.includes(p.id)?'border-zana-primary bg-emerald-50':'border-gray-100'}`}>
            <input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggleProduct(p.id)} className="h-4 w-4 accent-emerald-600"/>
            {p.imageUrl?<img src={p.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover"/>:<div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100"><Package size={17}/></div>}
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{p.name}</span><span className="text-xs text-gray-500">{p.price.toLocaleString()} RWF</span></span>
          </label>)}</div>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-gray-600">Starts<input type="date" value={startsAt} onChange={e=>setStartsAt(e.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-normal"/></label>
        <label className="text-xs font-semibold text-gray-600">Ends<input type="date" value={endsAt} onChange={e=>setEndsAt(e.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-normal"/></label>
      </div>
      {durationDays>0 && <p className="mt-2 text-xs text-gray-500">Selected duration: {durationDays} day(s). {promoExempt ? 'Zana exemption active' : 'Maximum: 7 consecutive days.'}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <button onClick={submit} disabled={saving || !title || selected.length<2} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zana-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Plus size={16}/>{saving?'Submitting…':'Submit combo for review'}</button>
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-bold text-gray-900">Your promotions</h2>
      {loading ? <p className="py-6 text-sm text-gray-500">Loading…</p> : promotions.length===0 ? <p className="py-6 text-sm text-gray-500">No promotions submitted yet.</p> : <div className="space-y-3">{promotions.map(p=><div key={p.id} className="rounded-xl border border-gray-100 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-gray-900">{p.title}</p><p className="mt-1 text-xs text-gray-500">{p.items.map(i=>i.product.name).join(' + ')}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{p.status}</span></div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600"><span className="font-bold">{p.comboPrice.toLocaleString()} RWF combo</span><span>{new Date(p.startsAt).toLocaleDateString()} – {new Date(new Date(p.endsAt).getTime()-86400000).toLocaleDateString()}</span></div>
      </div>)}</div>}
    </section>
  </div>;
}
