'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requestLoginCode, loginWithCode } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

/**
 * Signing in with an SMS code. Most people here do not want to remember a
 * password for a moto app, and a code they already receive during signup is
 * a familiar pattern.
 */
export default function LoginWithCode() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Stops people hammering the resend button and burning SMS credit.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const fullPhone = () => `+250${phone.replace(/\D/g, '').replace(/^250/, '')}`;

  const send = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) { setError('Enter your full phone number.'); return; }

    setBusy(true);
    setError('');
    try {
      await requestLoginCode(fullPhone());
      setStep('code');
      setCooldown(30);
    } catch {
      // The API stays silent about whether an account exists, so we do too.
      setStep('code');
      setCooldown(30);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      await loginWithCode(fullPhone(), code.trim());
      router.replace('/');
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : '';
      if (msg.includes('CODE_EXPIRED')) setError('That code has expired. Ask for a new one.');
      else if (msg.includes('ACCOUNT_SUSPENDED')) setError('This account is suspended. Contact support.');
      else setError('That code is not right, or there is no account on this number.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 pt-14 pb-10">
      <button
        onClick={() => (step === 'code' ? setStep('phone') : router.back())}
        className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center mb-6"
      >
        <ArrowLeft size={18} className="text-gray-700" />
      </button>

      {step === 'phone' ? (
        <>
          <h1 className="text-2xl font-black text-gray-900">Sign in with a code</h1>
          <p className="text-sm text-gray-500 mt-1.5 mb-7">
            No password needed. We&rsquo;ll text you a six-digit code.
          </p>

          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Phone number
          </label>
          <div className="flex items-center border-2 border-gray-100 rounded-2xl mt-2 focus-within:border-zana-primary">
            <span className="pl-4 pr-2 text-sm font-bold text-gray-400">+250</span>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              onKeyDown={e => e.key === 'Enter' && send()}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="7xx xxx xxx"
              className="flex-1 py-3.5 pr-4 text-sm outline-none bg-transparent"
            />
          </div>

          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

          <button
            onClick={send}
            disabled={busy || phone.replace(/\D/g, '').length < 9}
            className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl mt-6 disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Send code'}
          </button>

          <button
            onClick={() => router.push('/login')}
            className="w-full text-sm text-gray-500 py-3 mt-2 font-semibold"
          >
            Use a password instead
          </button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-black text-gray-900">Enter your code</h1>
          <p className="text-sm text-gray-500 mt-1.5 mb-7">
            Sent to {fullPhone()}. Valid for five minutes.
          </p>

          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && code.length === 6 && verify()}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 text-2xl font-mono tracking-[0.4em] text-center focus:border-zana-primary focus:outline-none"
          />

          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

          <button
            onClick={verify}
            disabled={busy || code.length < 6}
            className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl mt-6 disabled:opacity-40"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>

          <button
            onClick={send}
            disabled={busy || cooldown > 0}
            className="w-full text-sm text-gray-400 py-3 mt-1 disabled:opacity-50"
          >
            {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send the code again'}
          </button>
        </>
      )}
    </div>
  );
}
