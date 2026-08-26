'use client';

import { useState } from 'react';
import { Search, Star } from 'lucide-react';
import Topbar from '../../components/Topbar';
import StatusBadge from '../../components/StatusBadge';
import { trips, TripStatus } from '../../lib/mockData';

const statusFilters: { id: TripStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
  { id: 'NO_DRIVER_FOUND', label: 'No driver found' },
];

export default function TripsPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TripStatus | 'ALL'>('ALL');

  const filtered = trips.filter((t) => {
    const matchesQuery =
      t.customerName.toLowerCase().includes(query.toLowerCase()) ||
      t.id.toLowerCase().includes(query.toLowerCase()) ||
      (t.driverName ?? '').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <>
      <Topbar title="Trips" subtitle={`${trips.length} trips logged`} />
      <div className="p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative max-w-sm flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zana-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search trip ID, customer, or driver…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-zana-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>
          <div className="flex gap-1.5">
            {statusFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  statusFilter === f.id
                    ? 'bg-zana-primary-dark text-white border-zana-primary-dark'
                    : 'bg-white text-gray-700 border-zana-border hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zana-surface border border-zana-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zana-muted border-b border-zana-border bg-gray-50">
                <th className="px-5 py-3 font-medium">Trip</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Driver</th>
                <th className="px-5 py-3 font-medium">Fare</th>
                <th className="px-5 py-3 font-medium">Rating</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-zana-border last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{t.id}</div>
                    <div className="text-xs text-zana-muted">{t.pickup} → {t.destination}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{t.customerName}</td>
                  <td className="px-5 py-3 text-gray-700">{t.driverName ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-700">{t.fare > 0 ? `${t.fare.toLocaleString()} RWF` : '—'}</td>
                  <td className="px-5 py-3">
                    {t.rating ? (
                      <span className="flex items-center gap-1 text-gray-700">
                        <Star size={13} className="fill-zana-secondary text-zana-secondary" /> {t.rating}
                      </span>
                    ) : (
                      <span className="text-zana-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-3 text-xs text-zana-muted">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
