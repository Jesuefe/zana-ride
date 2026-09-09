'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { requestPasswordReset, resetPassword } from '../../lib/api/client';

/**
 * Recovery for staff accounts. The code always goes by SMS even though these
 * accounts sign in by email, because a phone number is the one contact detail
 * every account is required to have.
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
    if (!identifier.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await requestPasswordReset(identifier.trim());
      setHint(res?.phoneHint ?? null);
      if (/^\+?\d[\d\s]{6,}$/.test(identifier.trim())) {
        setPhone(identifier.trim().replace(/\s/g, ''));
      }
    } catch { /* stay silent about whether the account exists */ }
    setStep('reset');
    setBusy(false);
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
      const msg = e?.message ?? '';
      if (msg.includes('INVALID_CODE')) setError('That code is not right.');
      else if (msg.includes('CODE_EXPIRED')) setError('That code has expired. Ask for a new one.');
      else setError('Could not reset your password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-7 shadow-sm">
        <button
          onClick={() => (step === 'reset' ? setStep('identify') : router.push('/login'))}
          className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center mb-5"
        >
          <ArrowLeft size={17} className="text-gray-700" />
        </button>

        {step === 'identify' ? (
          <>
            <h1 className="text-xl font-black text-gray-900">Forgot your password?</h1>
            <p className="text-sm text-gray-500 mt-1.5 mb-6">
              Enter your email or phone number and we&rsquo;ll send a code by SMS.
            </p>

            <input
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Email or phone number"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-zana-primary focus:outline-none"
            />

            <button
              onClick={send}
              disabled={busy || !identifier.trim()}
              className="w-full bg-zana-primary text-white font-bold py-3.5 rounded-xl mt-5 disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-black text-gray-900">Enter your code</h1>
            <p className="text-sm text-gray-500 mt-1.5 mb-5">
              If that account exists, a code is on its way
              {hint ? ` to ${hint}` : ''}. Valid for five minutes.
            </p>

            {!phone && (
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Phone number the code went to"
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm mb-3 focus:border-zana-primary focus:outline-none"
              />
            )}

            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-lg font-mono tracking-[0.4em] text-center mb-3 focus:border-zana-primary focus:outline-none"
            />

            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm mb-3 focus:border-zana-primary focus:outline-none"
            />

            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Confirm password"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-zana-primary focus:outline-none"
            />

            {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

            <button
              onClick={submit}
              disabled={busy || code.length < 6 || !password}
              className="w-full bg-zana-primary text-white font-bold py-3.5 rounded-xl mt-5 disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Set new password'}
            </button>

            <button onClick={send} disabled={busy} className="w-full text-xs text-gray-400 py-2.5">
              Send the code again
            </button>
          </>
        )}

        <div className="flex items-start gap-2 mt-6 pt-5 border-t border-gray-100">
          <ShieldCheck size={13} className="text-gray-300 shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Zana will never ask for your password or code by phone or message.
          </p>
        </div>
      </div>
    </div>
  );
}
