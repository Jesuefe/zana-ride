'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { ApiError, changePassword } from '../lib/api/client';

/** Change-password form for the signed-in account (Settings page). */
export default function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setDone(false);
    if (next.length < 8) { setError('Use at least 8 characters.'); return; }
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    if (next === current) { setError('Choose a password different from the current one.'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      setDone(true);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '';
      if (msg === 'WRONG_PASSWORD') setError('The current password is incorrect.');
      else if (msg === 'PASSWORD_TOO_SHORT') setError('Use at least 8 characters.');
      else setError(msg || 'Could not change the password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm';
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center gap-3">
        <KeyRound size={20} className="text-zana-primary" />
        <div>
          <h2 className="font-bold text-gray-900">Change password</h2>
          <p className="text-xs text-gray-500">Update the password for the account you are signed in with.</p>
        </div>
      </div>
      <form onSubmit={submit} className="p-5 grid md:grid-cols-3 gap-4 items-end">
        {error && <div role="alert" className="md:col-span-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {done && <div role="status" className="md:col-span-3 rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2">Password changed.</div>}
        <label className="block text-xs font-semibold text-gray-600">Current password
          <input type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required className={`mt-1 ${input}`} />
        </label>
        <label className="block text-xs font-semibold text-gray-600">New password
          <input type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={next} onChange={e => setNext(e.target.value)} required className={`mt-1 ${input}`} />
        </label>
        <label className="block text-xs font-semibold text-gray-600">Confirm new password
          <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required className={`mt-1 ${input}`} />
        </label>
        <div className="md:col-span-3 flex items-center gap-3">
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-zana-primary text-white font-bold px-4 py-2.5 rounded-lg text-sm disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} Change password
          </button>
          <button type="button" onClick={() => setShow(v => !v)} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            {show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? 'Hide' : 'Show'} passwords
          </button>
        </div>
      </form>
    </section>
  );
}
