'use client';

import { useState } from 'react';
import { Search, Ban, RotateCcw } from 'lucide-react';
import Topbar from '../../components/Topbar';
import StatusBadge from '../../components/StatusBadge';
import { users as initialUsers, PlatformUser } from '../../lib/mockData';

export default function UsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>(initialUsers);
  const [query, setQuery] = useState('');

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.phone.includes(query)
  );

  const toggleSuspend = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' } : u
      )
    );
  };

  return (
    <>
      <Topbar title="Users" subtitle={`${users.length} registered customers`} />
      <div className="p-8">
        <div className="relative max-w-sm mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zana-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or phone…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-zana-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
          />
        </div>

        <div className="bg-zana-surface border border-zana-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zana-muted border-b border-zana-border bg-gray-50">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Trips</th>
                <th className="px-5 py-3 font-medium">Wallet</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-zana-border last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{u.name}</div>
                    <div className="text-xs text-zana-muted">{u.phone}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{u.totalTrips}</td>
                  <td className="px-5 py-3 text-gray-700">{u.walletBalance.toLocaleString()} RWF</td>
                  <td className="px-5 py-3 text-gray-700">{u.joinedDate}</td>
                  <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3 text-right">
                    {u.status !== 'BANNED' && (
                      <button
                        onClick={() => toggleSuspend(u.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-zana-primary-dark hover:underline"
                      >
                        {u.status === 'SUSPENDED' ? (
                          <>
                            <RotateCcw size={13} /> Reinstate
                          </>
                        ) : (
                          <>
                            <Ban size={13} /> Suspend
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
