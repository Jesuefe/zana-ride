'use client';
import { useEffect, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api/client';
import { ClipboardList } from 'lucide-react';

type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target?: string;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    // This endpoint doesn't exist on the backend yet — every admin
    // mutation (approve, suspend, fare change, refund, etc.) needs to
    // actually write a record before this page has anything real to
    // show. The UI is ready now so wiring it up later is just the
    // backend side, not a rebuild.
    api.get<AuditEntry[]>('/admin/audit-log')
      .then(setEntries)
      .catch(() => setConnected(false));
  }, []);

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Audit Log</h1>
        <p className="text-sm text-gray-500 mb-5">
          Every sensitive admin action — who did it, what changed, and when.
        </p>

        {!connected && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
            <ClipboardList size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Not connected yet</p>
              <p className="text-xs text-amber-700 mt-1">
                This page is ready, but the backend doesn't record admin actions yet.
                Once that's wired up, entries will appear here automatically.
              </p>
            </div>
          </div>
        )}

        {connected && entries && entries.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-sm text-gray-400">
            No actions recorded yet.
          </div>
        )}

        {connected && entries && entries.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-left">
                {['When', 'Who', 'Action', 'Target', 'Before', 'After'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium">{e.actor}</td>
                    <td className="px-4 py-3">{e.action}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{e.target ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.previousValue ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{e.newValue ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
