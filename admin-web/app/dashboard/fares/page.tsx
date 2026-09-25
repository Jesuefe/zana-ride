'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CarFront, CheckCircle2, Clock3, Percent, RefreshCw, Save, ShieldCheck, Bike } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getFares, updateFare } from '../../../lib/api/admin';

type Fare = {
  serviceType: 'BIKE' | 'ECONOMY' | 'COMFORT';
  base: number; perKm: number; perMin: number; bookingFee: number; minimum: number;
  commissionRate: number; freeWaitingMinutes: number; waitingPerMinute: number; updatedAt?: string;
};

const labels: Record<string, { name: string; subtitle: string; icon: any }> = {
  BIKE: { name: 'Moto / Bike', subtitle: 'Motorcycle rides', icon: Bike },
  ECONOMY: { name: 'Economy Car', subtitle: 'Standard car service', icon: CarFront },
  COMFORT: { name: 'Premium Car', subtitle: 'Premium / comfort service', icon: CarFront },
};

const fields = [
  ['base', 'Base fare', 'RWF'], ['perKm', 'Per kilometer', 'RWF / km'],
  ['perMin', 'Time rate', 'RWF / min'], ['bookingFee', 'Booking fee', 'RWF'],
  ['minimum', 'Minimum fare', 'RWF'], ['commissionRate', 'ZANA commission', '%'],
  ['freeWaitingMinutes', 'Free waiting', 'minutes'], ['waitingPerMinute', 'Waiting charge', 'RWF / min'],
] as const;

export default function FaresPage() {
  const [fares, setFares] = useState<Fare[]>([]);
  const [editing, setEditing] = useState<Record<string, Partial<Fare>>>({});
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    try { setFares(await getFares()); setMessage(''); }
    catch { setMessage('Could not load live fare configuration.'); }
  };

  useEffect(() => { load(); }, []);

  const changed = (serviceType: string) => Object.keys(editing[serviceType] ?? {}).length > 0;
  const value = (fare: Fare, key: string) => (editing[fare.serviceType] as any)?.[key] ?? (fare as any)[key];

  const update = (serviceType: string, key: string, raw: string) => {
    const number = Number(raw);
    setEditing(prev => ({ ...prev, [serviceType]: { ...(prev[serviceType] ?? {}), [key]: Number.isFinite(number) ? number : 0 } }));
  };

  const save = async (fare: Fare) => {
    if (!changed(fare.serviceType)) return;
    setSaving(fare.serviceType); setMessage('');
    try {
      await updateFare(fare.serviceType, editing[fare.serviceType]);
      setEditing(prev => ({ ...prev, [fare.serviceType]: {} }));
      await load();
      setMessage(labels[fare.serviceType].name + ' policy saved and is now live.');
    } catch (e: any) {
      setMessage(e?.message || 'Could not save fare policy.');
    } finally { setSaving(''); }
  };

  const liveCommission = useMemo(() => !fares.length ? 0 : fares.reduce((sum, f) => sum + f.commissionRate, 0) / fares.length, [fares]);

  return (
    <AdminShell>
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck size={19} className="text-zana-primary" /><h1 className="text-2xl font-bold text-gray-900">Pricing & Commission Control</h1></div>
            <p className="text-sm text-gray-500 mt-1">Operational rate cards for every ride class. Changes are persisted in the live FareConfig and require no redeploy.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"><RefreshCw size={14} /> Refresh live rates</button>
        </div>

        {message && <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm flex items-center gap-2"><CheckCircle2 size={16} className="text-zana-primary" /> {message}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold">Ride classes</p><p className="text-2xl font-bold text-gray-900 mt-1">{fares.length}</p><p className="text-xs text-gray-500 mt-1">Live service configurations</p></div>
          <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold">Average commission</p><p className="text-2xl font-bold text-gray-900 mt-1">{liveCommission.toFixed(1)}%</p><p className="text-xs text-gray-500 mt-1">Across configured ride classes</p></div>
          <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold">Waiting policy</p><p className="text-2xl font-bold text-gray-900 mt-1">10 min</p><p className="text-xs text-gray-500 mt-1">Current standard free period</p></div>
          <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold">Control status</p><p className="text-2xl font-bold text-zana-primary mt-1">LIVE</p><p className="text-xs text-gray-500 mt-1">Backend is source of truth</p></div>
        </div>

        <div className="grid xl:grid-cols-3 gap-4">
          {fares.map(fare => {
            const meta = labels[fare.serviceType]; const Icon = meta.icon; const dirty = changed(fare.serviceType);
            const commission = Number(value(fare, 'commissionRate')); const waiting = Number(value(fare, 'waitingPerMinute'));
            return (
              <section key={fare.serviceType} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-zana-primary-light flex items-center justify-center"><Icon size={19} className="text-zana-primary" /></div><div><h2 className="font-bold text-gray-900">{meta.name}</h2><p className="text-xs text-gray-500">{meta.subtitle}</p></div></div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-50 text-green-700">LIVE</span>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {fields.map(([key, label, unit]) => (
                    <div key={key} className={key === 'commissionRate' || key === 'freeWaitingMinutes' ? 'pt-2 border-t border-gray-100' : ''}>
                      <div className="flex items-center justify-between mb-1.5"><label className="text-xs font-semibold text-gray-600">{label}</label><span className="text-[10px] text-gray-400">{unit}</span></div>
                      <input type="number" min="0" step={key === 'commissionRate' ? '0.1' : '1'} value={value(fare, key)} onChange={e => update(fare.serviceType, key, e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-zana-primary/20 focus:border-zana-primary" />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="rounded-lg bg-gray-50 p-3"><div className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-gray-400"><Percent size={11}/> ZANA take</div><p className="text-lg font-bold text-gray-900 mt-1">{commission.toFixed(1)}%</p></div>
                    <div className="rounded-lg bg-gray-50 p-3"><div className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-gray-400"><Clock3 size={11}/> Waiting</div><p className="text-lg font-bold text-gray-900 mt-1">{value(fare, 'freeWaitingMinutes')}m free</p><p className="text-[10px] text-gray-500">{waiting.toLocaleString()} RWF/min after</p></div>
                  </div>
                  {fare.commissionRate > 0 && fare.commissionRate !== 15 && <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-100 p-3 text-[11px] text-amber-800"><AlertTriangle size={14} className="shrink-0 mt-0.5" />This service has a commission rate different from the current 15% operating baseline.</div>}
                  <button onClick={() => save(fare)} disabled={!dirty || saving === fare.serviceType} className="w-full inline-flex justify-center items-center gap-2 bg-zana-primary text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-40"><Save size={14} />{saving === fare.serviceType ? 'Applying policy…' : dirty ? 'Apply live policy' : 'No pending changes'}</button>
                </div>
              </section>
            );
          })}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900"><strong>Operations rule:</strong> fare and commission changes are server-side controls. Every change is validated and written to the finance audit trail with the operator identity. Existing completed rides keep their recorded commission; new rides use the active policy.</div>
      </div>
    </AdminShell>
  );
}
