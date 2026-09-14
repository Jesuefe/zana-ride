'use client';
import { useEffect, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { getFares, updateFare } from '../../../lib/api/admin';

export default function FaresPage() {
  const [fares, setFares] = useState<any[]>([]);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState('');

  useEffect(() => { getFares().then(setFares).catch(() => {}); }, []);

  const handleSave = async (serviceType: string) => {
    setSaving(serviceType);
    await updateFare(serviceType, editing[serviceType]);
    setSaving('');
    getFares().then(setFares).catch(() => {});
  };

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Fare Configuration</h1>
        <p className="text-sm text-gray-500 mb-5">Changes take effect immediately without a redeploy.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {fares.map(f => {
            const ed = editing[f.serviceType] ?? {};
            const val = (k: string) => ed[k] ?? f[k];
            return (
              <div key={f.serviceType} className="bg-white rounded-xl p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">{f.serviceType}</h2>
                {[['base','Base fare (RWF)'],['perKm','Per km (RWF)'],['perMin','Per minute (RWF)'],['bookingFee','Booking fee (RWF)'],['minimum','Minimum fare (RWF)']].map(([k, label]) => (
                  <div key={k} className="mb-3">
                    <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                    <input type="number" value={val(k)} onChange={e => setEditing(prev => ({ ...prev, [f.serviceType]: { ...(prev[f.serviceType] ?? {}), [k]: Number(e.target.value) } }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                ))}
                <button onClick={() => handleSave(f.serviceType)} disabled={saving === f.serviceType} className="w-full bg-zana-primary text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-40">
                  {saving === f.serviceType ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
