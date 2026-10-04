'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Users, Activity, LockKeyhole, RefreshCw } from 'lucide-react';
import { getAuditLog, getStaffSecurity } from '../../../lib/api/admin';

export default function SecurityPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { const [s, a] = await Promise.all([getStaffSecurity(), getAuditLog({ limit: 100 })]); setStaff(s); setAudit(a); }
    catch (e: any) { setError(e?.message || 'Unable to load security data.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return <div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Security & Staff Control</h1><p className="text-sm text-gray-500 mt-1">Permissions, account status and administrative activity.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> Refresh</button></div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[["Staff",staff.length,Users],["Active",staff.filter(s=>s.active&&s.user?.status==='ACTIVE').length,Activity],["Suspended",staff.filter(s=>!s.active||s.user?.status!=='ACTIVE').length,LockKeyhole],["Audit events",audit.length,ShieldCheck]].map(([label,value,Icon]:any)=><div key={label} className="rounded-xl border bg-white p-5"><Icon size={20} className="text-zana-primary"/><div className="text-2xl font-bold mt-3">{value}</div><div className="text-sm text-gray-500">{label}</div></div>)}
    </div>
    <section className="rounded-xl border bg-white overflow-hidden"><div className="px-5 py-4 border-b"><h2 className="font-semibold">Staff Access</h2><p className="text-xs text-gray-500 mt-1">Server-side access is enforced independently of the UI.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-left"><tr><th className="p-3">Staff</th><th className="p-3">Role</th><th className="p-3">Access</th><th className="p-3">Status</th><th className="p-3">Last login</th></tr></thead><tbody>{staff.map(s=><tr key={s.id} className="border-t"><td className="p-3"><div className="font-medium">{s.name}</div><div className="text-xs text-gray-500">{s.email||s.phone}</div></td><td className="p-3">{s.role}</td><td className="p-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{s.accessRole||'OPERATIONS'}</span></td><td className="p-3">{s.active&&s.user?.status==='ACTIVE'?<span className="text-green-700">Active</span>:<span className="text-red-700">Suspended</span>}</td><td className="p-3 text-gray-500">{s.user?.lastLoginAt?new Date(s.user.lastLoginAt).toLocaleString():'Never recorded'}</td></tr>)}{!staff.length&&!loading&&<tr><td colSpan={5} className="p-8 text-center text-gray-500">No staff accounts found.</td></tr>}</tbody></table></div></section>
    <section className="rounded-xl border bg-white overflow-hidden"><div className="px-5 py-4 border-b"><h2 className="font-semibold">Recent Administrative Activity</h2></div><div className="divide-y">{audit.map((event:any)=><div key={event.id} className="px-5 py-3 flex items-start justify-between gap-4"><div><div className="font-medium">{event.action}</div><div className="text-xs text-gray-500">{event.entityType}{event.entityId?` · ${event.entityId}`:''} · {event.actor?.firstName||'System'} {event.actor?.lastName||''}</div></div><div className="text-xs text-gray-400 whitespace-nowrap">{event.createdAt?new Date(event.createdAt).toLocaleString():''}</div></div>)}{!audit.length&&!loading&&<div className="p-8 text-center text-gray-500">No audit events found.</div>}</div></section>
  </div>;
}
