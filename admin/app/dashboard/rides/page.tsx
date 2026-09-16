'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '../../../components/AdminShell';
import { getTrips } from '../../../lib/api/admin';

export default function RidesPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => { getTrips().then(setTrips).catch(() => {}); }, []);

  const q = search.trim().toLowerCase();
  const filtered = !q ? trips : trips.filter(t =>
    t.customer?.firstName?.toLowerCase().includes(q) ||
    t.customer?.lastName?.toLowerCase().includes(q) ||
    t.customer?.phone?.includes(q) ||
    t.driver?.user?.firstName?.toLowerCase().includes(q) ||
    t.pickupAddress?.toLowerCase().includes(q) ||
    t.destinationAddress?.toLowerCase().includes(q)
  );

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Rides</h1>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer, driver, phone or address…"
          className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
        />
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Customer','Driver','Type','From','To','Fare','Status','Date',''].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">{t.customer?.firstName} {t.customer?.lastName}</td>
                  <td className="px-4 py-3">{t.driver?.user?.firstName ?? '—'}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{t.serviceType}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-28 truncate">{t.pickupAddress}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-28 truncate">{t.destinationAddress}</td>
                  <td className="px-4 py-3">{(t.finalFare ?? t.estimatedFare)?.toLocaleString()} RWF</td>
                  <td className="px-4 py-3 text-xs">{t.status}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(t.requestedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><Link href={`/dashboard/rides/detail?id=${t.id}`} className="text-xs text-zana-primary font-semibold hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
