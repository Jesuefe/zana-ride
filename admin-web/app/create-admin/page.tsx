'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { createAdmin } from '../../lib/api/admin';
import { ApiError } from '../../lib/api/client';

export default function CreateAdminPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: 'admin@zanaride.rw', phone: '', password: '', recoverySecret: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createAdmin(form);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Admin creation failed.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zana-primary-dark to-zana-primary flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin created</h1>
          <p className="text-sm text-gray-500 mt-2">The account is now ready for Zana Control Center.</p>
          <button onClick={() => router.push('/login')} className="w-full mt-6 bg-zana-primary text-white font-semibold py-3 rounded-lg">Continue to Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zana-primary-dark to-zana-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 sm:p-8 w-full max-w-md">
        <button onClick={() => router.push('/login')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ArrowLeft size={16} /> Back to sign in
        </button>
        <div className="flex items-center gap-3 mb-7">
          <div className="w-12 h-12 bg-zana-primary-light rounded-xl flex items-center justify-center">
            <ShieldCheck size={24} className="text-zana-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Create admin</h1>
            <p className="text-sm text-gray-500">Secure Zana administrator bootstrap</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="First name" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
            <input value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Last name" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
          </div>
          <input required type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="Admin email" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
          <input required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="Phone (+250...)" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
          <div className="relative">
            <input required minLength={12} type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} placeholder="Admin password (12+ characters)" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-2.5 text-gray-400">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <div className="relative">
            <input required minLength={16} type={showSecret ? 'text' : 'password'} value={form.recoverySecret} onChange={e => update('recoverySecret', e.target.value)} placeholder="Server recovery secret" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
            <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-3 top-2.5 text-gray-400">{showSecret ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {error && <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-500">This page uses the protected admin recovery endpoint. It does not write credentials directly to the database.</div>
          <button type="submit" disabled={loading || !form.email || !form.phone || !form.password || !form.recoverySecret} className="w-full mt-2 bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating admin…</> : 'Create Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
