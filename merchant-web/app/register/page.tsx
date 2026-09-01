'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Store } from 'lucide-react';
import { api } from '../../lib/api/client';

function RegisterContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [form, setForm] = useState({ businessName: '', email: '', password: '', phone: '', category: 'FOOD' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <p className="text-2xl mb-2">🔗</p>
        <p className="font-semibold text-gray-900">Invalid invite link</p>
        <p className="text-sm text-gray-500 mt-1">Please contact Zana support for a valid invite.</p>
      </div>
    </div>
  );

  const handleRegister = async () => {
    if (!form.businessName || !form.email || !form.password || !form.phone) {
      setError('All fields are required.'); return;
    }
    setLoading(true); setError('');
    try {
      await api.post('/auth/register-merchant', { ...form, token });
      router.push('/');
    } catch (e: any) {
      setError(e.message ?? 'Registration failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-zana-primary flex items-center justify-center">
            <Store size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">Join Zana Business</p>
            <p className="text-xs text-gray-500">Create your merchant account</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {[
            { key: 'businessName', label: 'Business name', type: 'text', placeholder: 'Kigali Fresh Market' },
            { key: 'email', label: 'Email address', type: 'email', placeholder: 'business@example.com' },
            { key: 'phone', label: 'Phone number', type: 'tel', placeholder: '+250788123456' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zana-primary/30" />
            </div>
          ))}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
              <option value="FOOD">Food & Restaurants</option>
              <option value="GIFTS">Gifts & Flowers</option>
              <option value="GOODS">Goods & Products</option>
            </select>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button onClick={handleRegister} disabled={loading}
            className="w-full bg-zana-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Creating account…' : 'Create merchant account'}
          </button>

          <p className="text-xs text-gray-400 text-center">Your account will be reviewed before going live.</p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterContent /></Suspense>;
}
