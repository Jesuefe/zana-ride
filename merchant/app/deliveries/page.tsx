'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import Topbar from '../../components/Topbar';
import StatusBadge from '../../components/StatusBadge';
import { merchantDeliveries } from '../../lib/mockData';

export default function DeliveriesPage() {
  const [query, setQuery] = useState('');

  const filtered = merchantDeliveries.filter(
    (d) =>
      d.receiverName.toLowerCase().includes(query.toLowerCase()) ||
      d.dropoffAddress.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Topbar title="Deliveries" subtitle={`${merchantDeliveries.length} total`} />
      <div className="p-8">
        <div className="relative max-w-sm mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zana-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search receiver or address…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-zana-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
          />
        </div>

        <div className="bg-zana-surface border border-zana-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zana-muted border-b border-zana-border bg-gray-50">
                <th className="px-5 py-3 font-medium">Delivery</th>
                <th className="px-5 py-3 font-medium">Receiver</th>
                <th className="px-5 py-3 font-medium">Courier</th>
                <th className="px-5 py-3 font-medium">Fee</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-zana-border last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{d.id}</div>
                    <div className="text-xs text-zana-muted">{d.dropoffAddress}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {d.receiverName}
                    <div className="text-xs text-zana-muted">{d.receiverPhone}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{d.courierName ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-700">{d.fee.toLocaleString()} RWF</td>
                  <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-5 py-3 text-xs text-zana-muted">{d.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
