'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, Copy, Check, ShieldCheck, KeyRound } from 'lucide-react';
import {
  login,
  startAdminTotpSetup,
  enableAdminTotp,
  verifyAdminTotpLogin,
} from '../../lib/api/admin';
import { ApiError, clearToken } from '../../lib/api/client';

type LoginStep = 'credentials' | 'setup' | 'verify' | 'recovery';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const finish = (result: any) => {
    if (result?.user?.role !== 'ADMIN' || !result?.token) {
      clearToken();
      setError('This sign-in is for administrator accounts only.');
      return;
    }
    router.push('/dashboard');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      if (step === 'credentials') {
        const result = await login(identifier.trim(), password);
        if (result?.user?.role !== 'ADMIN') {
          clearToken();
          throw new Error('This sign-in is for administrator accounts only.');
        }
        if (result.token) {
          finish(result);
          return;
        }
        if (result.requiresTwoFactorSetup && result.setupToken) {
          setSetupToken(result.setupToken);
          const setup = await startAdminTotpSetup(result.setupToken);
          setSecret(setup.secret);
          setOtpauthUrl(setup.otpauthUrl);
          setAccountLabel(setup.accountLabel);
          setCode('');
          setStep('setup');
          return;
        }
        if (result.requiresTwoFactor && result.challengeToken) {
          setChallengeToken(result.challengeToken);
          setCode('');
          setStep('verify');
          return;
        }
        throw new Error('The server did not return a valid administrator verification challenge.');
      }

      if (step === 'setup') {
        const result = await enableAdminTotp(setupToken, code);
        if (result?.user?.role !== 'ADMIN' || !result?.token) {
          clearToken();
          throw new Error('Authenticator setup could not create an administrator session.');
        }
        setRecoveryCodes(result.recoveryCodes || []);
        setStep('recovery');
        setCode('');
        return;
      }

      if (step === 'verify') {
        const result = await verifyAdminTotpLogin(challengeToken, code);
        finish(result);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setError('Copy is unavailable in this browser. Select and copy the setup key manually.');
    }
  };

  const submitLabel = step === 'credentials'
    ? 'Continue securely'
    : step === 'setup'
      ? 'Verify and enable authenticator'
      : step === 'verify'
        ? 'Verify and sign in'
        : 'Continue to Zana Admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-zana-primary-dark to-zana-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 sm:p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 bg-zana-primary-light rounded-2xl flex items-center justify-center mb-3">
            <Shield size={28} className="text-zana-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Zana Control Center</h1>
          <p className="text-sm text-gray-500 mt-1">Administrator access protected by two-factor authentication</p>
        </div>

        {step === 'credentials' && (
          <>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 mb-5 flex gap-3">
              <ShieldCheck size={19} className="text-emerald-700 shrink-0 mt-0.5" />
              <p className="text-xs leading-5 text-emerald-900">Sign in with your administrator password, then confirm using Google Authenticator. First-time administrators will be guided through setup.</p>
            </div>
            <div className="space-y-3">
              <input
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Admin phone or email"
                autoComplete="username"
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
              />
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
              />
            </div>
          </>
        )}

        {step === 'setup' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zana-primary">Step 1 of 2 · Set up authenticator</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1">Connect Google Authenticator</h2>
              <p className="text-sm text-gray-500 mt-1">In Google Authenticator, choose Add a code → Enter a setup key. Select time-based and use six digits.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
              <p className="text-xs text-gray-500">Account</p>
              <p className="text-sm font-semibold text-gray-900">{accountLabel}</p>
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-gray-500">Your private setup key</p>
                <button type="button" onClick={copySecret} className="inline-flex items-center gap-1 text-xs font-semibold text-zana-primary">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy key'}
                </button>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3 font-mono text-sm tracking-widest break-all select-all">{secret}</div>
              <p className="text-[11px] leading-4 text-amber-700">Keep this key private. Anyone who has it can generate your administrator sign-in codes.</p>
            </div>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1.5">Enter the six-digit code from your authenticator</span>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-lg tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
              />
            </label>
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-semibold">Manual setup URI</summary>
              <p className="mt-2 break-all select-all">{otpauthUrl}</p>
            </details>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zana-primary">Two-factor verification</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1">Confirm it’s you</h2>
              <p className="text-sm text-gray-500 mt-1">Enter the six-digit code from Google Authenticator, or one unused recovery code.</p>
            </div>
            <div className="flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 py-5">
              <KeyRound size={28} className="text-zana-primary" />
            </div>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase())}
              autoComplete="one-time-code"
              placeholder="Authenticator or recovery code"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>
        )}

        {step === 'recovery' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Authenticator enabled</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1">Save your recovery codes</h2>
              <p className="text-sm text-gray-500 mt-1">Each code can be used once if you lose access to your authenticator. These codes are shown only now.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
              {recoveryCodes.map(value => <code key={value} className="rounded-md bg-white border border-gray-200 px-2 py-2 text-center text-sm font-bold tracking-wider">{value}</code>)}
            </div>
            <button type="button" onClick={() => navigator.clipboard.writeText(recoveryCodes.join('\n'))} className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 inline-flex items-center justify-center gap-2">
              <Copy size={15} /> Copy recovery codes
            </button>
            <p className="text-xs text-amber-700">Store these somewhere private and offline. Do not share them with anyone.</p>
          </div>
        )}

        {error && <p className="text-xs text-red-600 mt-4" role="alert">{error}</p>}

        {step !== 'recovery' ? (
          <button
            onClick={handleSubmit}
            disabled={loading || (step === 'credentials' ? !identifier.trim() || !password : step === 'setup' ? code.length !== 6 : code.length < 6)}
            className="w-full mt-5 bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> : submitLabel}
          </button>
        ) : (
          <button onClick={() => router.push('/dashboard')} className="w-full mt-5 bg-zana-primary text-white font-semibold py-3 rounded-lg">
            {submitLabel}
          </button>
        )}

        {step === 'credentials' && (
          <>
            <button onClick={() => router.push('/create-admin')} className="w-full text-sm text-zana-primary font-medium py-2.5 mt-2">Create administrator</button>
            <button onClick={() => router.push('/forgot-password')} className="w-full text-sm text-gray-500 py-2.5">Forgot your password?</button>
            <button onClick={() => router.push('/staff')} className="w-full text-xs text-zana-primary py-2.5">Staff login</button>
          </>
        )}
      </div>
    </div>
  );
}
