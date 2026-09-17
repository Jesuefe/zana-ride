'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, User, Store, Package, Car, Truck, ShoppingBag } from 'lucide-react';
import { api } from '../lib/api/client';

// Previously an admin who wanted to find "that driver with plate RAD
// 123" or an order for a phone number had to already know which page
// to look on, then scroll through it manually. One box now checks
// people, merchants, products, and the three transaction types by id
// or tracking code, all at once.
export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!q.trim() || q.trim().length < 2) { setResults(null); return; }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.get<any>(`/admin/search?q=${encodeURIComponent(q.trim())}`)
        .then(r => { setResults(r); setOpen(true); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  const totalCount = results
    ? (results.people?.length ?? 0) + (results.merchants?.length ?? 0) + (results.products?.length ?? 0) +
      (results.trips?.length ?? 0) + (results.deliveries?.length ?? 0) + (results.orders?.length ?? 0)
    : 0;

  const roleOf = (p: any) => p.driver ? 'DRIVER' : p.merchant ? 'MERCHANT' : p.agent ? 'AGENT' : p.role;
  const goTo = (path: string) => { setOpen(false); setQ(''); router.push(path); };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => q.trim().length >= 2 && setOpen(true)}
          placeholder="Search people, plates, orders, tracking codes…"
          className="flex-1 text-sm outline-none"
        />
        {q && <button onClick={() => { setQ(''); setResults(null); }}><X size={14} className="text-gray-400" /></button>}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-96 overflow-y-auto z-50">
          {loading && <p className="text-xs text-gray-400 text-center py-4">Searching…</p>}
          {!loading && totalCount === 0 && <p className="text-xs text-gray-400 text-center py-4">No matches.</p>}

          {!loading && results?.people?.length > 0 && (
            <div className="p-2 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1">People</p>
              {results.people.map((p: any) => (
                <button key={p.id} onClick={() => goTo(p.driver ? '/dashboard/drivers' : '/dashboard/users')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                  <User size={13} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-xs text-gray-700 truncate">{p.firstName} {p.lastName} · {p.phone}</span>
                  <span className="text-[10px] font-semibold text-gray-400">{roleOf(p)}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && results?.merchants?.length > 0 && (
            <div className="p-2 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1">Merchants</p>
              {results.merchants.map((m: any) => (
                <button key={m.id} onClick={() => goTo('/dashboard/merchants')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                  <Store size={13} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-xs text-gray-700 truncate">{m.businessName}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && results?.products?.length > 0 && (
            <div className="p-2 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1">Products</p>
              {results.products.map((p: any) => (
                <button key={p.id} onClick={() => goTo(p.marketId ? '/dashboard/markets' : '/dashboard/products')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                  <Package size={13} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-xs text-gray-700 truncate">{p.name}</span>
                  <span className="text-[10px] text-gray-400">{p.price?.toLocaleString()} RWF</span>
                </button>
              ))}
            </div>
          )}

          {!loading && results?.trips?.length > 0 && (
            <div className="p-2 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1">Rides</p>
              {results.trips.map((t: any) => (
                <button key={t.id} onClick={() => goTo(`/dashboard/rides/detail?id=${t.id}`)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                  <Car size={13} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-xs text-gray-700 truncate">{t.customer?.firstName} · {t.driver?.user?.firstName ?? 'No driver'}</span>
                  <span className="text-[10px] text-gray-400">{t.status}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && results?.deliveries?.length > 0 && (
            <div className="p-2 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1">Deliveries</p>
              {results.deliveries.map((d: any) => (
                <button key={d.id} onClick={() => goTo(d.trackingCode ? `/dashboard/tracking?code=${d.trackingCode}` : '/dashboard/deliveries')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                  <Truck size={13} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-xs text-gray-700 truncate">{d.trackingCode ?? d.id.slice(0, 8)} · {d.customer?.firstName ?? 'Customer'}</span>
                  <span className="text-[10px] text-gray-400">{d.status}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && results?.orders?.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1">Orders</p>
              {results.orders.map((o: any) => (
                <button key={o.id} onClick={() => goTo('/dashboard/orders')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                  <ShoppingBag size={13} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-xs text-gray-700 truncate">{o.customer?.firstName} · {o.merchant?.businessName ?? o.market?.name}</span>
                  <span className="text-[10px] text-gray-400">{o.total?.toLocaleString()} RWF</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
