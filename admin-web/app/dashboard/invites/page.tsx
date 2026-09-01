'use client';

import { useEffect, useState } from 'react';
import { Link2, Copy, Check, Plus, Clock } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api/client';

type Invite = { id: string; token: string; expiresAt: string; usedAt: string | null; createdAt: string };

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.get<Invite[]>('/admin/merchant-invites').then(setInvites).catch(() => {});
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const inv = await api.post<Invite>('/admin/merchant-invites');
      setInvites(prev => [inv, ...prev]);
    } catch {} finally { setGenerating(false); }
  };

  const copy = (token: string) => {
    const url = `https://zana-merchant.pages.dev/register?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const isExpired = (inv: Invite) => new Date(inv.expiresAt) < new Date();

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Merchant Invites</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate invite links for new merchants (expires in 30 days)</p>
        </div>
        <button onClick={generate} disabled={generating}
          className="flex items-center gap-2 bg-zana-primary text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40">
          <Plus size={15} /> {generating ? 'Generating…' : 'Generate Invite'}
        </button>
      </div>

      <div className="space-y-3">
        {invites.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <Link2 size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No invites yet. Generate one to invite a merchant.</p>
          </div>
        )}
        {invites.map(inv => (
          <div key={inv.id} className={`bg-white rounded-xl p-4 shadow-sm border ${inv.usedAt ? 'border-green-100' : isExpired(inv) ? 'border-red-100' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    inv.usedAt ? 'bg-green-100 text-green-700' :
                    isExpired(inv) ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {inv.usedAt ? 'Used' : isExpired(inv) ? 'Expired' : 'Active'}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={10} /> Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs font-mono text-gray-500 truncate">
                  zana-merchant.pages.dev/register?token={inv.token.slice(0, 16)}…
                </p>
              </div>
              {!inv.usedAt && !isExpired(inv) && (
                <button onClick={() => copy(inv.token)}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg shrink-0">
                  {copied === inv.token ? <><Check size={12} className="text-green-600" /> Copied!</> : <><Copy size={12} /> Copy link</>}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
