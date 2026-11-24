'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { ApiError, changePassword, clearToken, getToken } from '../../lib/api/client';

/**
 * Shown when an account signs in with a temporary password
 * (the API answers PASSWORD_CHANGE_REQUIRED until it is changed).
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < 8) { setError('Use at least 8 characters.'); return; }
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    if (next === current) { setError('Choose a password different from the temporary one.'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      router.replace('/dashboard');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '';
      if (msg === 'WRONG_PASSWORD') setError('The temporary password is incorrect.');
      else if (msg === 'PASSWORD_TOO_SHORT') setError('Use at least 8 characters.');
      else setError(msg || 'Could not change the password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => { clearToken(); router.replace('/login'); };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="w-12 h-12 rounded-xl bg-zana-primary/10 flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6 text-zana-primary" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Set your new password</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">You signed in with a temporary password. Choose your own to continue.</p>

        {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="cur">Temporary password</label>
        <input id="cur" type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required
          className="w-full mb-4 rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />

        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new">New password</label>
        <div className="relative mb-4">
          <input id="new" type={show ? 'text' : 'password'} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} required minLength={8}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-10 text-sm" />
          <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide passwords' : 'Show passwords'}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="conf">Confirm new password</label>
        <input id="conf" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required
          className="w-full mb-5 rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />

        <button type="submit" disabled={busy}
          className="w-full bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Change password
        </button>
        <button type="button" onClick={signOut} className="w-full text-xs text-gray-500 py-3">Sign out</button>
      </form>
    </main>
  );
}
