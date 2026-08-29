'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, Plus, Trash2 } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getFinancial, getCommissionSummary, getExpenses, createExpense, deleteExpense } from '../../../lib/api/admin';

function Card({ label, value, sub, color = 'green' }: any) {
  const colors: Record<string, string> = { green: 'bg-green-50 text-green-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700' };
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color === 'green' ? 'text-gray-900' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 font-semibold px-2 py-0.5 rounded-full inline-block ${colors[color]}`}>{sub}</p>}
    </div>
  );
}

export default function FinancialPage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [commissions, setCommissions] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', category: 'Office', description: '' });
  const CATEGORIES = ['Office', 'Fuel', 'Marketing', 'Software', 'Salaries', 'Equipment', 'Other'];

  const load = () => {
    getFinancial().then(setSnapshot).catch(() => {});
    getCommissionSummary().then(setCommissions).catch(() => {});
    getExpenses().then(setExpenses).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleAddExpense = async () => {
    await createExpense({ ...form, amount: Number(form.amount) });
    setShowExpenseForm(false);
    setForm({ title: '', amount: '', category: 'Office', description: '' });
    load();
  };

  const handleDeleteExpense = async (id: string) => {
    await deleteExpense(id);
    load();
  };

  const fmt = (n: number) => `${n?.toLocaleString() ?? 0} RWF`;

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Financial Dashboard</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card label="Total Revenue (rides)" value={fmt(snapshot?.totalRevenue)} />
          <Card label="Total Commission Earned" value={fmt(snapshot?.totalCommission)} sub="15% per ride" color="green" />
          <Card label="Total Expenses" value={fmt(snapshot?.totalExpenses)} color="red" />
          <Card label="Net Profit" value={fmt(snapshot?.netProfit)} color={snapshot?.netProfit >= 0 ? 'green' : 'red'} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <Card label="Monthly Salary Burden" value={fmt(snapshot?.monthlySalaryBurden)} sub="All active staff" color="amber" />
          <Card label="Ride Commissions" value={fmt(commissions?.rideCommission)} sub={`${commissions?.rideCount ?? 0} rides`} />
          <Card label="Delivery Commissions" value={fmt(commissions?.deliveryCommission)} sub={`${commissions?.deliveryCount ?? 0} deliveries`} />
        </div>

        {snapshot?.unpaidPayrolls?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-red-800">⚠ Unpaid payroll</p>
            {snapshot.unpaidPayrolls.map((p: any) => (
              <p key={p.id} className="text-xs text-red-700 mt-1">{p.staff?.name} — {p.month} — {fmt(p.amount)}</p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Expenses</h2>
          <button onClick={() => setShowExpenseForm(true)} className="flex items-center gap-1.5 bg-zana-primary text-white font-semibold px-3 py-1.5 rounded-lg text-xs"><Plus size={13} /> Add Expense</button>
        </div>

        {showExpenseForm && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Title" className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" />
              <input value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="Amount (RWF)" type="number" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Note (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddExpense} disabled={!form.title || !form.amount} className="bg-zana-primary text-white font-semibold px-4 py-1.5 rounded-lg text-sm disabled:opacity-40">Save</button>
              <button onClick={() => setShowExpenseForm(false)} className="border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Title','Category','Amount','Date',''].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">{e.title}{e.description && <span className="text-gray-400 text-xs"> — {e.description}</span>}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{e.category}</span></td>
                  <td className="px-4 py-3 font-medium">{e.amount?.toLocaleString()} RWF</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><button onClick={() => handleDeleteExpense(e.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button></td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No expenses recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
