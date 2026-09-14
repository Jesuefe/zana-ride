'use client';
import { useEffect, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { getDeliveries } from '../../../lib/api/admin';

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-700',
  COURIER_ASSIGNED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  useEffect(() => { getDeliveries().then(setDeliveries).catch(() => {}); }, []);

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Deliveries</h1>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Item','From','Pickup','Dropoff','Fee','Status','Courier'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {deliveries.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.itemDescription}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{d.customer?.firstName ?? d.merchant?.businessName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-32 truncate">{d.pickupAddress}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-32 truncate">{d.dropoffAddress}</td>
                  <td className="px-4 py-3">{d.fee?.toLocaleString()} RWF</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[d.status] ?? ''}`}>{d.status}</span></td>
                  <td className="px-4 py-3 text-xs">{d.driver?.user?.firstName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
