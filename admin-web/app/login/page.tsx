'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import { login, requestAdminOtp, verifyAdminOtp } from '../../lib/api/admin';
import { ApiError } from '../../lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const finish = (result: any) => {
    if (result.user.role !== 'ADMIN') {
      setError('This login is for admin accounts only.');
      setLoading(false);
      return;
    }
    router.push('/dashboard');
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      if (mode === 'password') {
        finish(await login(identifier, password));
      } else if (!otpSent) {
        if (!identifier) return;
        await requestAdminOtp(identifier);
        setOtpSent(true);
        setLoading(false);
      } else {
        finish(await verifyAdminOtp(identifier, code));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Authentication failed.');
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

        <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
          <button onClick={() => { setMode('password'); setError(''); }} className={`flex-1 py-2 text-xs font-semibold rounded-md ${mode === 'password' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Password</button>
          <button onClick={() => { setMode('otp'); setError(''); }} className={`flex-1 py-2 text-xs font-semibold rounded-md ${mode === 'otp' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>SMS code</button>
        </div>

        <div className="space-y-3">
          <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Admin phone or email" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" autoFocus />
          {mode === 'password' ? (
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          ) : otpSent ? (
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit SMS code" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-zana-primary/30" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          ) : null}
        </div>

        {mode === 'otp' && otpSent && <p className="text-xs text-gray-500 mt-2">Verification code sent to the admin phone. It expires in 5 minutes.</p>}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        <button onClick={handleSubmit} disabled={loading || !identifier || (mode === 'password' ? !password : otpSent && code.length !== 6)} className="w-full mt-4 bg-zana-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={15} className="animate-spin" /> {mode === 'otp' && !otpSent ? 'Sending code…' : 'Signing in…'}</> : mode === 'otp' && !otpSent ? 'Send SMS code' : 'Sign In'}
        </button>

        {mode === 'otp' && otpSent && <button onClick={() => { setOtpSent(false); setCode(''); setError(''); }} className="w-full text-xs text-gray-500 py-2.5">Use a different number</button>}
        <button onClick={() => router.push('/forgot-password')} className="w-full text-sm text-gray-500 py-2.5 mt-1">Forgot your password?</button>
        <button onClick={() => router.push('/staff')} className="w-full text-xs text-zana-primary py-2.5 mt-1">Staff login</button>
      </div>
    </div>
  );
}
