'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, Loader2 } from 'lucide-react';
import { login } from '../../lib/api/admin';
import { ApiError, clearToken } from '../../lib/api/client';

export default function StaffLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const result = await login(identifier.trim(), password);
      if (result.user.role !== 'STAFF') {
        clearToken();
        setError('This login is for ZANA staff accounts only.');
        setLoading(false);
        return;
      }
      router.push(result.user.accessRole === 'CUSTOMER_SUPPORT' ? '/dashboard/support' : result.user.accessRole === 'DRIVER_OPERATIONS' ? '/dashboard/drivers' : result.user.accessRole === 'MARKET_OPERATIONS' ? '/dashboard/markets' : '/dashboard/orders');
    } catch (err) {
      clearToken();
      setError(err instanceof ApiError ? err.message : 'Login failed.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zana-primary-dark to-zana-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-zana-primary-light rounded-2xl flex items-center justify-center mb-3">
            <BriefcaseBusiness size={28} className="text-zana-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">ZANA Staff Login</h1>
          <p className="text-sm text-gray-500 mt-1">Your assigned operations workspace</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); void handleLogin(); }} className="space-y-3">
          <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Email or phone" autoComplete="username" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" autoFocus />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" autoComplete="current-password" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={loading || !identifier.trim() || !password} className="w-full bg-zana-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : 'Sign In'}
          </button>
        </form>
        <button onClick={() => router.push('/forgot-password')} className="w-full text-sm text-gray-500 py-2.5 mt-1">Forgot your password?</button>
        <button onClick={() => router.push('/login')} className="w-full text-xs text-zana-primary py-2">Administrator login</button>
      </div>
    </div>
  );
}
