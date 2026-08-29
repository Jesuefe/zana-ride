'use client';
import { useEffect, useState } from 'react';
import { fetchMyOrders, updateOrderStatus } from '../../lib/api/merchant';

const STATUSES = ['PENDING','CONFIRMED','PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700', CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-blue-100 text-blue-700', READY_FOR_PICKUP: 'bg-purple-100 text-purple-700',
  OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-700', DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};
const NEXT_STATUS: Record<string, string> = {
  PENDING: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY_FOR_PICKUP',
  READY_FOR_PICKUP: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const load = () => fetchMyOrders().then(setOrders).catch(() => {});
  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, []);

  const advance = async (id: string, status: string) => {
    await updateOrderStatus(id, status);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Orders</h1>
      <div className="space-y-3">
        {orders.map(o => (
          <div key={o.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-gray-900">{o.customer?.firstName} {o.customer?.lastName}</p>
                <p className="text-xs text-gray-500">{o.items?.map((i: any) => `${i.product?.name} ×${i.quantity}`).join(', ')}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[o.status] ?? ''}`}>{o.status}</span>
            </div>
            <p className="text-sm font-bold text-zana-primary mb-3">{o.total?.toLocaleString()} RWF</p>
            {NEXT_STATUS[o.status] && (
              <button onClick={() => advance(o.id, NEXT_STATUS[o.status])} className="w-full bg-zana-primary text-white font-semibold py-2 rounded-lg text-sm">
                Mark as {NEXT_STATUS[o.status].replace(/_/g, ' ')}
              </button>
            )}
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-gray-500 text-center py-10">No orders yet.</p>}
      </div>
    </div>
  );
}
