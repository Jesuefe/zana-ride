'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { requestPasswordReset, resetPassword } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

/**
 * Two steps in one screen: ask for the account, then take the code and the
 * new password together. Splitting those into separate pages makes people
 * lose the code when they switch to their SMS app.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<'identify' | 'reset'>('identify');

  const [identifier, setIdentifier] = useState('');
  const [phone, setPhone] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const id = identifier.trim();
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const res = await requestPasswordReset(id);
      setHint(res?.phoneHint ?? null);
      // The reset step needs the phone the code went to. If they typed a
      // phone we already have it; if they typed an email we ask for it.
      if (/^\+?\d[\d\s]{6,}$/.test(id)) setPhone(id.replace(/\s/g, ''));
      setStep('reset');
    } catch {
      // Deliberately vague: we never confirm whether an account exists.
      setStep('reset');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (password !== confirm) { setError('Those passwords do not match.'); return; }
    if (password.length < 6) { setError('Use at least 6 characters.'); return; }
    if (!phone) { setError('Enter the phone number the code was sent to.'); return; }

    setBusy(true);
    setError('');
    try {
      await resetPassword(phone, code.trim(), password);
      router.replace('/');
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : '';
      if (msg.includes('INVALID_CODE')) setError('That code is not right. Check and try again.');
      else if (msg.includes('CODE_EXPIRED')) setError('That code has expired. Ask for a new one.');
      else if (msg.includes('PASSWORD_TOO_SHORT')) setError('Use at least 6 characters.');
      else setError('Could not reset your password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 pt-14 pb-10">
      <button
        onClick={() => (step === 'reset' ? setStep('identify') : router.back())}
        className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center mb-6"
      >
        <ArrowLeft size={18} className="text-gray-700" />
      </button>

      {step === 'identify' ? (
        <>
          <h1 className="text-2xl font-black text-gray-900">Forgot your password?</h1>
          <p className="text-sm text-gray-500 mt-1.5 mb-7">
            Enter the phone number or email on your account and we&rsquo;ll send a
            code by SMS.
          </p>

          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Phone or email
          </label>
          <input
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="+250 7xx xxx xxx"
            autoComplete="username"
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 mt-2 text-sm focus:border-zana-primary focus:outline-none"
          />

          <button
            onClick={send}
            disabled={busy || !identifier.trim()}
            className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl mt-6 disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-black text-gray-900">Enter your code</h1>
          <p className="text-sm text-gray-500 mt-1.5 mb-6">
            If that account exists, a code is on its way
            {hint ? ` to ${hint}` : ''}. It is valid for five minutes.
          </p>

          {!phone && (
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Phone number the code went to
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+250 7xx xxx xxx"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 mt-2 text-sm focus:border-zana-primary focus:outline-none"
              />
            </div>
          )}

          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            6-digit code
          </label>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 mt-2 mb-4 text-lg font-mono tracking-[0.4em] text-center focus:border-zana-primary focus:outline-none"
          />

          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 mt-2 mb-4 text-sm focus:border-zana-primary focus:outline-none"
          />

          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoComplete="new-password"
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 mt-2 text-sm focus:border-zana-primary focus:outline-none"
          />

          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

          <button
            onClick={submit}
            disabled={busy || code.length < 6 || !password}
            className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl mt-6 disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Set new password'}
          </button>

          <button
            onClick={send}
            disabled={busy}
            className="w-full text-sm text-gray-400 py-3 mt-1"
          >
            Send the code again
          </button>
        </>
      )}

      <div className="flex items-start gap-2 mt-8 pt-6 border-t border-gray-100">
        <ShieldCheck size={14} className="text-gray-300 shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Zana will never ask for your password or your code by phone or
          message. If someone does, it is not us.
        </p>
      </div>
    </div>
  );
}
