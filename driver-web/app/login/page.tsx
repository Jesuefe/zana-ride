'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Car } from 'lucide-react';
import { login } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = identifier.trim().length > 3 && password.length >= 6;

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-zana-primary-light flex-1 flex items-center justify-center animate-fade-in py-10">
        <div className="w-28 h-28 rounded-3xl bg-white shadow-lg flex items-center justify-center animate-fade-slide-up">
          <Car size={56} className="text-zana-primary" strokeWidth={1.5} />
        </div>
      </div>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Driver Login</h1>
        <p className="text-sm text-zana-muted mt-1">Log in with your email or phone number.</p>

        <div className="mt-6 space-y-3">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or phone number"
            className="w-full border border-zana-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            autoFocus
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="w-full border border-zana-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            onKeyDown={(e) => e.key === 'Enter' && valid && handleLogin()}
          />
        </div>

        {error && <p className="text-xs text-zana-error mt-3">{error}</p>}

        <button
          disabled={!valid || loading}
          onClick={handleLogin}
          className="w-full mt-6 bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-40 hover:bg-zana-primary-dark transition-colors active:scale-[0.98]"
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>

        <p className="text-center text-sm text-zana-muted mt-4">
          New driver?{' '}
          <Link href="/signup" className="text-zana-primary font-semibold">
            Apply to drive
          </Link>
        </p>
      </div>
    </div>
  );
}
