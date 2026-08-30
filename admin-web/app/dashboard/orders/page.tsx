'use client';
import { useEffect, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { getOrders } from '../../../lib/api/admin';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-blue-100 text-blue-700',
  READY_FOR_PICKUP: 'bg-purple-100 text-purple-700',
  OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => { getOrders().then(setOrders).catch(() => {}); }, []);

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Orders</h1>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Customer','Merchant','Items','Total','Status','Date'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">{o.customer?.firstName} {o.customer?.lastName}</td>
                  <td className="px-4 py-3">{o.merchant?.businessName}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{o.items?.map((i: any) => `${i.product?.name} ×${i.quantity}`).join(', ')}</td>
                  <td className="px-4 py-3 font-medium">{o.total?.toLocaleString()} RWF</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status] ?? ''}`}>{o.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
