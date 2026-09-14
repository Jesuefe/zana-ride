'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api/client';

type Expense = { id: string; description: string; amount: number; category: string; createdAt: string };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('OPERATIONS');
  const [adding, setAdding] = useState(false);

  const load = () => api.get<Expense[]>('/admin/expenses').then(setExpenses).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!desc || !amount) return;
    setAdding(true);
    await api.post('/admin/expenses', { description: desc, amount: Number(amount), category }).catch(() => {});
    setDesc(''); setAmount('');
    load();
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/admin/expenses/${id}`).catch(() => {});
    load();
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Expenses</h1>

      {/* Add expense */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-5">
        <p className="font-semibold text-gray-900 mb-3">Add Expense</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <input value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g,''))} placeholder="Amount (RWF)" inputMode="numeric"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            {['OPERATIONS','SALARIES','MARKETING','TECH','OTHER'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={handleAdd} disabled={adding || !desc || !amount}
          className="mt-3 flex items-center gap-2 bg-zana-primary text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-40">
          <Plus size={15} /> Add Expense
        </button>
      </div>

      {/* Total */}
      <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-3 mb-4 flex justify-between">
        <p className="font-semibold text-red-800">Total expenses</p>
        <p className="font-black text-red-800">{total.toLocaleString()} RWF</p>
      </div>

      {/* List */}
      <div className="space-y-2">
        {expenses.map(e => (
          <div key={e.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-gray-900">{e.description}</p>
              <p className="text-xs text-gray-400">{e.category} · {new Date(e.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-bold text-red-600">{e.amount.toLocaleString()} RWF</p>
              <button onClick={() => handleDelete(e.id)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={13} className="text-red-400" />
              </button>
            </div>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No expenses recorded.</p>}
      </div>
    </AdminShell>
  );
}
