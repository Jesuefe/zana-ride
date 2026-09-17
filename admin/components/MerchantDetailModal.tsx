'use client';
import { useEffect, useState } from 'react';
import { X, Store, Package } from 'lucide-react';
import { getMerchantDetail } from '../lib/api/admin';

export default function MerchantDetailModal({ merchantId, onClose }: { merchantId: string; onClose: () => void }) {
  const [m, setM] = useState<any>(null);

  useEffect(() => {
    getMerchantDetail(merchantId).then(setM).catch(() => {});
  }, [merchantId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {!m ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg text-gray-900">{m.businessName}</h2>
                <p className="text-xs text-gray-500">{m.user?.firstName} {m.user?.lastName} · {m.user?.phone}</p>
                <p className="text-xs text-gray-400 mt-1">Joined {new Date(m.createdAt).toLocaleDateString()} · {m.category}</p>
              </div>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{m.products?.length ?? 0}</p>
                <p className="text-[10px] text-gray-500">Products</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{m.orders?.length ?? 0}</p>
                <p className="text-[10px] text-gray-500">Recent orders</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-gray-900">{m.revenue?.toLocaleString() ?? 0}</p>
                <p className="text-[10px] text-gray-500">Revenue (RWF)</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3 mb-4">
              <Store size={14} /> {m.businessAddress ?? 'No address on file'} · <span className={`font-semibold ${m.status === 'APPROVED' ? 'text-green-600' : 'text-amber-600'}`}>{m.status}</span>
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Products ({m.products?.length ?? 0})</p>
            <div className="space-y-1.5 mb-4">
              {!m.products?.length && <p className="text-xs text-gray-400">No products listed.</p>}
              {m.products?.slice(0, 10).map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <Package size={13} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-gray-700 truncate">{p.name}</span>
                  <span className="font-semibold text-gray-900">{p.price?.toLocaleString()} RWF</span>
                </div>
              ))}
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Recent Orders</p>
            <div className="space-y-1.5">
              {!m.orders?.length && <p className="text-xs text-gray-400">No orders yet.</p>}
              {m.orders?.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-700">{o.customer?.firstName ?? 'Customer'} · {new Date(o.createdAt).toLocaleDateString()}</span>
                  <span className="font-semibold text-gray-900">{o.total?.toLocaleString()} RWF · {o.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
