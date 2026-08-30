'use client';
import { useEffect, useState } from 'react';
import { Check, Pause } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getMerchants, approveMerchant, suspendMerchant } from '../../../lib/api/admin';

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [filter, setFilter] = useState('PENDING');
  const load = () => getMerchants(filter || undefined).then(setMerchants).catch(() => {});
  useEffect(() => { load(); }, [filter]);
  const act = async (fn: () => Promise<any>) => { await fn(); load(); };

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Merchants</h1>
        <div className="flex gap-2 mb-4">
          {['PENDING','APPROVED','SUSPENDED',''].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === s ? 'bg-zana-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{s || 'All'}</button>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Business','Owner','Phone','Category','Status','Products','Actions'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {merchants.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.businessName}</td>
                  <td className="px-4 py-3">{m.user.firstName} {m.user.lastName}</td>
                  <td className="px-4 py-3 text-gray-600">{m.user.phone}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{m.category}</span></td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.status === 'APPROVED' ? 'bg-green-100 text-green-700' : m.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{m.status}</span></td>
                  <td className="px-4 py-3">{m.products?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {m.status !== 'APPROVED' && <button onClick={() => act(() => approveMerchant(m.id))} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"><Check size={13} /></button>}
                      {m.status === 'APPROVED' && <button onClick={() => act(() => suspendMerchant(m.id))} className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100"><Pause size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
