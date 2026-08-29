'use client';
import { useEffect, useState } from 'react';
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getAgents, createAgent, toggleAgent, assignAgent, getMarkets } from '../../../lib/api/admin';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ phone: '', firstName: '', lastName: '', email: '', password: '', marketId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => { getAgents().then(setAgents).catch(() => {}); getMarkets().then(setMarkets).catch(() => {}); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true); setError('');
    try {
      await createAgent({ ...form, phone: `+250${form.phone.replace(/\D/g, '')}`, marketId: form.marketId || undefined });
      setShowForm(false);
      setForm({ phone: '', firstName: '', lastName: '', email: '', password: '', marketId: '' });
      load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <AdminShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
            <p className="text-sm text-gray-500 mt-0.5">Created by admin only. Agents handle market purchasing.</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm"><Plus size={15} /> Add Agent</button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
            <h2 className="font-semibold text-gray-900 mb-3">New Agent</h2>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.firstName} onChange={e => setForm(f => ({...f, firstName: e.target.value}))} placeholder="First name" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={form.lastName} onChange={e => setForm(f => ({...f, lastName: e.target.value}))} placeholder="Last name" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <span className="border border-gray-200 rounded-lg px-3 flex items-center text-sm">+250</span>
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value.replace(/\D/g,'').slice(0,9)}))} placeholder="788 123 456" inputMode="numeric" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="Email (optional)" type="email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="Password" type="password" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <select value={form.marketId} onChange={e => setForm(f => ({...f, marketId: e.target.value}))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">No market assigned</option>
                {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreate} disabled={saving || !form.firstName || !form.phone || !form.password} className="bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-40">{saving ? 'Creating…' : 'Create Agent'}</button>
              <button onClick={() => setShowForm(false)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Name','Phone','Market','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{a.user.firstName} {a.user.lastName}</td>
                  <td className="px-4 py-3 text-gray-600">{a.user.phone}</td>
                  <td className="px-4 py-3">
                    <select value={a.marketId ?? ''} onChange={e => assignAgent(a.id, e.target.value).then(load)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
                      <option value="">Unassigned</option>
                      {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{a.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleAgent(a.id, !a.active).then(load)} className={a.active ? 'text-green-600' : 'text-gray-400'}>
                      {a.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
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
