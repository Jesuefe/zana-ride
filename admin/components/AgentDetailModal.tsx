'use client';
import { useEffect, useState } from 'react';
import { X, MapPin, Package } from 'lucide-react';
import { getAgentDetail } from '../lib/api/admin';

export default function AgentDetailModal({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [a, setA] = useState<any>(null);

  useEffect(() => {
    getAgentDetail(agentId).then(setA).catch(() => {});
  }, [agentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {!a ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg text-gray-900">{a.user?.firstName} {a.user?.lastName}</h2>
                <p className="text-xs text-gray-500">{a.user?.phone}</p>
                <p className="text-xs text-gray-400 mt-1">Joined {new Date(a.createdAt).toLocaleDateString()}</p>
              </div>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{a.market?.products?.length ?? 0}</p>
                <p className="text-[10px] text-gray-500">Items listed</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{a.orders?.length ?? 0}</p>
                <p className="text-[10px] text-gray-500">Recent orders</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-gray-900">{a.revenue?.toLocaleString() ?? 0}</p>
                <p className="text-[10px] text-gray-500">Order value (RWF)</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3 mb-4">
              <MapPin size={14} /> {a.market?.name ?? 'No market assigned'} · <span className={`font-semibold ${a.active ? 'text-green-600' : 'text-gray-500'}`}>{a.active ? 'Active' : 'Inactive'}</span>
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Recent Orders</p>
            <div className="space-y-1.5">
              {!a.orders?.length && <p className="text-xs text-gray-400">No orders yet.</p>}
              {a.orders?.map((o: any) => (
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
