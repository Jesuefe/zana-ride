'use client';
import { useEffect, useState } from 'react';
import { Plus, Check, DollarSign } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getStaff, createStaff, updateStaff, getSalaryPayments, recordSalaryPayment } from '../../../lib/api/admin';

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', phone: '', email: '', salary: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    getStaff().then(setStaff).catch(() => {});
    getSalaryPayments(month).then(setPayments).catch(() => {});
  };
  useEffect(() => { load(); }, [month]);

  const handleCreate = async () => {
    setSaving(true);
    await createStaff({ ...form, salary: Number(form.salary) });
    setShowForm(false);
    setForm({ name: '', role: '', phone: '', email: '', salary: '' });
    load();
    setSaving(false);
  };

  const handlePay = async (staffId: string, salary: number) => {
    await recordSalaryPayment({ staffMemberId: staffId, month, amount: salary });
    load();
  };

  const paidIds = new Set(payments.filter(p => p.paid).map((p: any) => p.staffMemberId));
  const totalPaid = payments.filter(p => p.paid).reduce((s: number, p: any) => s + p.amount, 0);
  const totalDue = staff.reduce((s, st) => s + st.salary, 0);

  return (
    <AdminShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff & Payroll</h1>
            <p className="text-sm text-gray-500 mt-0.5">Monthly salary burden: {totalDue.toLocaleString()} RWF</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm"><Plus size={15} /> Add Staff</button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <label className="text-sm font-medium text-gray-700">Payroll month:</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          <span className="text-sm text-gray-500">{totalPaid.toLocaleString()} / {totalDue.toLocaleString()} RWF paid</span>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
            <h2 className="font-semibold text-gray-900 mb-3">New Staff Member</h2>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Full name" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} placeholder="Role (e.g. Driver Coordinator)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="Phone" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="Email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={form.salary} onChange={e => setForm(f => ({...f, salary: e.target.value}))} placeholder="Monthly salary (RWF)" type="number" className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreate} disabled={saving || !form.name || !form.salary} className="bg-zana-primary text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-40">{saving ? 'Saving…' : 'Add Staff'}</button>
              <button onClick={() => setShowForm(false)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Name','Role','Phone','Monthly Salary',`${month} Status`,'Action'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.role}</td>
                  <td className="px-4 py-3 text-gray-600">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold">{s.salary?.toLocaleString()} RWF</td>
                  <td className="px-4 py-3">
                    {paidIds.has(s.id)
                      ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>
                      : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Unpaid</span>}
                  </td>
                  <td className="px-4 py-3">
                    {!paidIds.has(s.id) && (
                      <button onClick={() => handlePay(s.id, s.salary)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold">
                        <DollarSign size={12} /> Mark Paid
                      </button>
                    )}
                    {paidIds.has(s.id) && <Check size={15} className="text-green-600 ml-2" />}
                  </td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No staff members added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
