'use client';
import { useEffect, useState } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getProducts, reviewProduct, deleteProduct } from '../../../lib/api/admin';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [filter, setFilter] = useState('PENDING');
  const [note, setNote] = useState('');

  const load = () => getProducts(filter || undefined).then(setProducts).catch(() => {});
  useEffect(() => { load(); }, [filter]);

  const act = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await reviewProduct(id, status, note || undefined);
    setNote('');
    load();
  };

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Products</h1>
        <div className="flex gap-2 mb-4 flex-wrap">
          {['PENDING','APPROVED','REJECTED',''].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === s ? 'bg-zana-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="grid gap-3">
          {products.map(p => (
            <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-4">
              {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" /> : <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.merchant?.businessName}</p>
                    <p className="text-sm text-gray-700 mt-1">{p.price?.toLocaleString()} RWF · {p.category} · Stock: {p.stock}</p>
                    {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                    {p.adminNote && <p className="text-xs text-amber-700 mt-1 bg-amber-50 px-2 py-1 rounded">Admin note: {p.adminNote}</p>}
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : p.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span>
                </div>
                <button onClick={async () => { if(confirm('Delete this product?')) { await deleteProduct(p.id); load(); } }} className="mt-2 flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600"><Trash2 size={10}/> Delete</button>
              {p.status === 'PENDING' && (
                  <div className="flex items-center gap-2 mt-3">
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional rejection note…" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                    <button onClick={() => act(p.id, 'APPROVED')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold"><Check size={12} /> Approve</button>
                    <button onClick={() => act(p.id, 'REJECTED')} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold"><X size={12} /> Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
