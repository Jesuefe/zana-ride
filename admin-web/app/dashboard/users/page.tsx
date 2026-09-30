'use client';
import { useEffect, useState } from 'react';
import { Search, Shield, ShieldOff, UserCheck, KeyRound, X } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getUsers, updateUserStatus, resetUserPassword } from '../../../lib/api/admin';

const ROLE_BADGE: Record<string, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-700',
  DRIVER: 'bg-green-100 text-green-700',
  MERCHANT: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-red-100 text-red-700',
  AGENT: 'bg-amber-100 text-amber-700',
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');

  const load = () => {
    setLoading(true);
    getUsers({ role: role || undefined, search: search || undefined }).then(u => { setUsers(u); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [role]);

  const handleStatus = async (id: string, status: string) => {
    await updateUserStatus(id, status);
    load();
  };

  const handleReset = async () => {
    if (!resetUser || newPassword.length < 6) return;
    setResetBusy(true);
    setResetError('');
    try {
      await resetUserPassword(resetUser.id, newPassword);
      setResetUser(null);
      setNewPassword('');
    } catch (e: any) {
      setResetError(e?.message || 'Could not reset this password.');
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <AdminShell>
      <div>
        <div className="flex items-center justify-between mb-5 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-sm text-gray-500 mt-1">Manage account access and sensitive recovery actions.</p>
          </div>
        </div>

        {resetUser && (
          <div className="mb-5 rounded-xl border-2 border-red-200 bg-red-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-red-700">Sensitive action</p>
                <h2 className="font-bold text-red-900 mt-1">Reset another user&apos;s password</h2>
                <p className="text-sm text-red-800 mt-1">
                  This changes the password immediately for {resetUser.firstName || ''} {resetUser.lastName || ''} ({resetUser.role}). The action is recorded in the admin audit log.
                </p>
              </div>
              <button onClick={() => { setResetUser(null); setNewPassword(''); setResetError(''); }} className="p-1 text-red-700"><X size={18} /></button>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Temporary/new password (6+ characters)"
                className="flex-1 border border-red-200 rounded-lg px-3 py-2 text-sm bg-white"
              />
              <button
                onClick={handleReset}
                disabled={resetBusy || newPassword.length < 6}
                className="bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40"
              >
                {resetBusy ? 'Resetting…' : 'Confirm password reset'}
              </button>
            </div>
            {resetError && <p className="text-xs text-red-700 mt-2">{resetError}</p>}
          </div>
        )}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search size={15} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="Search by name, phone, email…" className="text-sm flex-1 outline-none" />
          </div>
          <select value={role} onChange={e => setRole(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All roles</option>
            {['CUSTOMER','DRIVER','MERCHANT','ADMIN','AGENT'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Name','Phone','Email','Role','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>}
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-3 text-gray-600">{u.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-600'}`}>{u.role}</span></td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {u.status !== 'ACTIVE' && <button onClick={() => handleStatus(u.id, 'ACTIVE')} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"><UserCheck size={13} /></button>}
                      {u.status === 'ACTIVE' && <button onClick={() => handleStatus(u.id, 'SUSPENDED')} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><ShieldOff size={13} /></button>}
                      {u.role !== 'ADMIN' && <button onClick={() => { setResetUser(u); setNewPassword(''); setResetError(''); }} title="Reset password" className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"><KeyRound size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
