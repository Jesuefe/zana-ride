'use client';
import { useEffect, useState } from 'react';
import { Check, X, Pause } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getDrivers, approveDriver, rejectDriver, suspendDriver } from '../../../lib/api/admin';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  SUSPENDED: 'bg-gray-100 text-gray-600',
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [filter, setFilter] = useState('PENDING');

  const load = () => getDrivers(filter || undefined).then(setDrivers).catch(() => {});
  useEffect(() => { load(); }, [filter]);

  const act = async (fn: () => Promise<any>) => { await fn(); load(); };

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Drivers</h1>
        <div className="flex gap-2 mb-4">
          {['PENDING','APPROVED','REJECTED','SUSPENDED',''].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === s ? 'bg-zana-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Name','Phone','Vehicle','Plate','Type','Status','Online','Actions'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.user.firstName} {d.user.lastName}</td>
                  <td className="px-4 py-3 text-gray-600">{d.user.phone}</td>
                  <td className="px-4 py-3">{d.vehicle}</td>
                  <td className="px-4 py-3">{d.plate}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{d.serviceType}</span></td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[d.approvalStatus]}`}>{d.approvalStatus}</span></td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${d.onlineStatus === 'ONLINE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{d.onlineStatus}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {d.approvalStatus !== 'APPROVED' && <button onClick={() => act(() => approveDriver(d.id))} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100" title="Approve"><Check size={13} /></button>}
                      {d.approvalStatus === 'PENDING' && <button onClick={() => act(() => rejectDriver(d.id))} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" title="Reject"><X size={13} /></button>}
                      {d.approvalStatus === 'APPROVED' && <button onClick={() => act(() => suspendDriver(d.id))} className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100" title="Suspend"><Pause size={13} /></button>}
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
