'use client';

import { useState } from 'react';
import { ZanaMark } from '../../components/ZanaLogo';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { login } from '../../lib/api/merchant';
import { ApiError } from '../../lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { user } = await login(email.trim(), password);

      // Merchants and market agents both sign in here, then land on
      // whichever dashboard fits their role.
      if (user.role === 'AGENT') {
        router.push('/agent');
        return;
      }
      if (user.role !== 'MERCHANT') {
        setError('This account is not a merchant or agent account.');
        return;
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <ZanaMark size={40} />
          <div>
            <p className="font-bold text-gray-900 text-lg leading-tight">Zana Business</p>
            <p className="text-xs text-gray-500">Merchant Portal</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Sign in</h1>
          <p className="text-sm text-gray-500 mb-6">Sign in as a merchant or market agent</p>

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Email address</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-zana-primary/30 focus-within:border-zana-primary transition-all">
                <Mail size={16} className="text-gray-400 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="business@example.com"
                  autoComplete="email"
                  className="flex-1 text-sm outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Password</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-zana-primary/30 focus-within:border-zana-primary transition-all">
                <Lock size={16} className="text-gray-400 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="flex-1 text-sm outline-none bg-transparent"
                />
                <button onClick={() => setShowPassword(v => !v)} className="text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full mt-5 bg-zana-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-zana-primary-dark transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            Don't have an account? Contact <a href="mailto:support@zana.rw" className="text-zana-primary">support@zana.rw</a>
          </p>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Demo: merchant@zana.rw / merchant123
        </p>
      </div>
    </div>
  );
}
