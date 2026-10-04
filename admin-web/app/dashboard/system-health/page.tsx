'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, Activity } from 'lucide-react';
import { getSystemHealth } from '../../../lib/api/admin';

export default function SystemHealthPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await getSystemHealth()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) return <div className="p-6 text-sm text-gray-500">Inspecting production data integrity…</div>;

  const critical = data?.findings?.filter((f: any) => f.severity === 'critical' && f.count > 0) ?? [];
  const high = data?.findings?.filter((f: any) => f.severity === 'high' && f.count > 0) ?? [];
  const active = data?.findings?.filter((f: any) => f.count > 0) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">System Health & DB Integrity</h1>
          <p className="text-sm text-gray-500 mt-1">Read-only production checks across security, wallets, operations and lifecycle state.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Object.entries(data?.summary ?? {}).map(([key, value]) => (
          <div key={key} className="rounded-xl border bg-white p-4">
            <div className="text-xs uppercase text-gray-400">{key.replace(/([A-Z])/g, ' $1')}</div>
            <div className="text-xl font-bold mt-1">{String(value)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          {data?.healthy ? <CheckCircle2 className="text-green-600" size={20} /> : <ShieldAlert className="text-red-600" size={20} />}
          <h2 className="font-semibold">{data?.healthy ? 'No critical integrity findings' : 'Integrity attention required'}</h2>
        </div>
        {critical.length + high.length === 0 ? (
          <div className="text-sm text-gray-500">No critical or high-severity findings are currently detected.</div>
        ) : (
          <div className="space-y-3">
            {[...critical, ...high].map((f: any) => (
              <div key={f.key} className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{f.title}</div>
                  <div className="font-bold">{f.count}</div>
                </div>
                <div className="text-xs text-gray-600 mt-1">{f.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center gap-2 mb-4"><Activity size={18} /><h2 className="font-semibold">Operational findings</h2></div>
        <div className="divide-y">
          {active.map((f: any) => (
            <div key={f.key} className="py-3 flex items-start justify-between gap-4">
              <div><div className="text-sm font-medium">{f.title}</div><div className="text-xs text-gray-500 mt-1">{f.detail}</div></div>
              <div className="text-sm font-semibold">{f.count}</div>
            </div>
          ))}
          {!active.length && <div className="text-sm text-gray-500">No active findings.</div>}
        </div>
      </div>

      <div className="text-xs text-gray-400">Generated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}</div>
    </div>
  );
}
