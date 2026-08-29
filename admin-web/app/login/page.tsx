'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import { login } from '../../lib/api/admin';
import { ApiError } from '../../lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const result = await login(identifier, password);
      if (result.user.role !== 'ADMIN') { setError('Not an admin account.'); setLoading(false); return; }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zana-primary-dark to-zana-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-zana-primary-light rounded-2xl flex items-center justify-center mb-3">
            <Shield size={28} className="text-zana-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Zana Control Center</h1>
          <p className="text-sm text-gray-500 mt-1">Admin access only</p>
        </div>
        <div className="space-y-3">
          <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Email or phone" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" autoFocus />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <button onClick={handleLogin} disabled={loading || !identifier || !password} className="w-full mt-4 bg-zana-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : 'Sign In'}
        </button>
      </div>
    </div>
  );
}
