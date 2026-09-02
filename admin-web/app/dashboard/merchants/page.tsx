'use client';
import { useEffect, useState } from 'react';
import { Check, Pause, RefreshCw, Play } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getMerchants, approveMerchant, suspendMerchant } from '../../../lib/api/admin';

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getMerchants(filter || undefined);
      setMerchants(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const act = async (id: string, fn: () => Promise<any>, msg: string) => {
    setActing(id);
    try {
      await fn();
      setToast(msg);
      setTimeout(() => setToast(''), 3000);
      // Reload all merchants so status change is visible
      const data = await getMerchants(filter || undefined);
      setMerchants(data);
    } catch (e: any) {
      setToast(e.message ?? 'Action failed');
      setTimeout(() => setToast(''), 3000);
    } finally { setActing(null); }
  };

  const counts = {
    all: merchants.length,
    PENDING: merchants.filter(m => m.status === 'PENDING').length,
    APPROVED: merchants.filter(m => m.status === 'APPROVED').length,
    SUSPENDED: merchants.filter(m => m.status === 'SUSPENDED').length,
  };

  return (
    <AdminShell>
      <div className="relative">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg">
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Merchants</h1>
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Filter tabs with counts */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { val: '', label: `All (${counts.all})` },
            { val: 'PENDING', label: `Pending (${counts.PENDING})` },
            { val: 'APPROVED', label: `Approved (${counts.APPROVED})` },
            { val: 'SUSPENDED', label: `Suspended (${counts.SUSPENDED})` },
          ].map(({ val, label }) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                filter === val
                  ? 'bg-zana-primary text-white border-zana-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-zana-primary'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : merchants.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <p className="text-gray-400">No merchants found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {merchants.map(m => (
              <div key={m.id} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900">{m.businessName}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        m.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        m.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{m.status}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {m.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {m.user?.firstName} {m.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.user?.phone} · {m.user?.email}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.products?.length ?? 0} product{m.products?.length !== 1 ? 's' : ''}
                      {m.branch ? ` · ${m.branch}` : ''}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {m.status !== 'APPROVED' && (
                      <button
                        onClick={() => act(m.id, () => approveMerchant(m.id), `${m.businessName} approved`)}
                        disabled={acting === m.id}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors min-w-[90px] justify-center"
                      >
                        {acting === m.id ? (
                          <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                        ) : (
                          <><Check size={13} /> Approve</>
                        )}
                      </button>
                    )}
                    {m.status === 'APPROVED' && (
                      <button
                        onClick={() => act(m.id, () => suspendMerchant(m.id), `${m.businessName} suspended`)}
                        disabled={acting === m.id}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors min-w-[90px] justify-center"
                      >
                        {acting === m.id ? (
                          <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                        ) : (
                          <><Pause size={13} /> Suspend</>
                        )}
                      </button>
                    )}
                    {m.status === 'SUSPENDED' && (
                      <button
                        onClick={() => act(m.id, () => approveMerchant(m.id), `${m.businessName} reinstated`)}
                        disabled={acting === m.id}
                        className="flex items-center gap-1.5 bg-zana-primary hover:bg-zana-primary-dark text-white font-semibold text-xs px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors min-w-[90px] justify-center"
                      >
                        <><Play size={13} /> Reinstate</>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
