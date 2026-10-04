'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Loader2, Users } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { createTestAccounts } from '../../../lib/api/admin';
import { ApiError } from '../../../lib/api/client';

export default function TestAccountsPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      setResult(await createTestAccounts({ password }));
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Test account creation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-black">Create Test Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Create the standard Customer, Driver and Merchant accounts through the protected admin API.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {[
            ['Customer', 'customer@zanaride.rw', 'Customer app testing'],
            ['Driver', 'driver@zanaride.rw', 'Ride and delivery testing'],
            ['Merchant', 'merchant@zanaride.rw', 'Merchant/order testing'],
          ].map(([role, email, detail]) => (
            <div key={role} className="bg-white border rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl bg-zana-primary/10 flex items-center justify-center mb-3">
                <Users size={19} className="text-zana-primary" />
              </div>
              <p className="font-black">{role}</p>
              <p className="text-xs text-gray-600 mt-1">{email}</p>
              <p className="text-[11px] text-gray-400 mt-2">{detail}</p>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="bg-white border rounded-2xl p-5 max-w-xl">
          <h2 className="font-black">Set test password</h2>
          <p className="text-xs text-gray-500 mt-1 mb-4">The password is entered here, hashed on the server, and is never stored in this page.</p>
          <div className="relative">
            <input
              required
              minLength={6}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Test account password"
              className="w-full border rounded-lg px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-3 text-gray-400">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">{error}</div>}
          <button disabled={loading || password.length < 6} className="w-full mt-4 bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating accounts…</> : 'Create all 3 test accounts'}
          </button>
        </form>

        {result?.created && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-green-700 font-black"><CheckCircle2 size={20} /> All three accounts created</div>
            <div className="mt-3 grid sm:grid-cols-3 gap-2 text-xs">
              {Object.entries(result.accounts || {}).map(([role, account]: any) => (
                <div key={role} className="bg-white rounded-xl p-3 border border-green-100">
                  <p className="font-black capitalize">{role}</p>
                  <p className="text-gray-600 mt-1">{account.email}</p>
                  <p className="text-gray-400 mt-1">{account.role}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
