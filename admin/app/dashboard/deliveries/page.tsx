'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  useEffect(() => { getDeliveries().then(setDeliveries).catch(() => {}); }, []);

  // Client-side filter over the already-fetched page (100 rows, same
  // as the backend already returns) — a real backend search endpoint
  // is more work than this genuinely needs right now, and this alone
  // already closes the actual gap: no way at all to find a specific
  // delivery to investigate, short of already knowing its tracking code.
  const q = search.trim().toLowerCase();
  const filtered = !q ? deliveries : deliveries.filter(d =>
    d.itemDescription?.toLowerCase().includes(q) ||
    d.trackingCode?.toLowerCase().includes(q) ||
    d.customer?.firstName?.toLowerCase().includes(q) ||
    d.customer?.lastName?.toLowerCase().includes(q) ||
    d.customer?.phone?.includes(q) ||
    d.merchant?.businessName?.toLowerCase().includes(q) ||
    d.driver?.user?.firstName?.toLowerCase().includes(q)
  );

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Deliveries</h1>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by item, tracking code, customer, merchant or driver…"
          className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
        />
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Package','Item','From','Pickup','Dropoff','Fee','Status','Courier',''].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}
                  onClick={() => d.trackingCode && router.push(`/dashboard/tracking?code=${d.trackingCode}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">
                    {d.imageUrl ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setPreview(d); }} className="block group" title="View package photo">
                        <img src={d.imageUrl} alt="Package" className="w-14 h-14 rounded-lg object-cover border border-gray-200 group-hover:opacity-80" />
                      </button>
                    ) : <div className="w-14 h-14 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-[9px] text-gray-400">No photo</div>}
                  </td>
                  <td className="px-4 py-3 font-medium">{d.itemDescription}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{d.customer?.firstName ?? d.merchant?.businessName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-32 truncate">{d.pickupAddress}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-32 truncate">{d.dropoffAddress}</td>
                  <td className="px-4 py-3">{d.fee?.toLocaleString()} RWF</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[d.status] ?? ''}`}>{d.status}</span></td>
                  <td className="px-4 py-3 text-xs">{d.driver?.user?.firstName ?? '—'}</td>
                  <td className="px-4 py-3">
                    {d.trackingCode && (
                      <span className="text-xs text-zana-primary font-semibold hover:underline">View</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {preview?.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-gray-900">Package photo</h2>
                <p className="text-xs text-gray-500">{preview.itemDescription || 'Delivery package'} · {preview.trackingCode || ''}</p>
              </div>
              <button onClick={() => setPreview(null)} className="p-2 rounded-lg hover:bg-gray-100"><span className="text-xl">×</span></button>
            </div>
            <img src={preview.imageUrl} alt="Delivery package" className="w-full max-h-[70vh] object-contain rounded-xl bg-gray-50" />
            <a href={preview.imageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-xs font-semibold text-zana-primary hover:underline">Open original image</a>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

// Keep Pages production build synchronized with the admin delivery review UI.
