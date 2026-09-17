'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api/client';

// useSearchParams() requires a Suspense boundary during static export —
// the actual query string isn't known at build time. This was missing
// entirely, which is a hard build failure, not a runtime warning.
export default function TrackingPage() {
  return (
    <Suspense fallback={null}>
      <TrackingPageInner />
    </Suspense>
  );
}

function TrackingPageInner() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async (searchCode?: string) => {
    const target = (searchCode ?? code).trim();
    if (!target) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get<any>(`/deliveries/track/${target.toUpperCase()}`);
      setResult(res);
    } catch (e: any) {
      setError(e?.message?.includes('404') || e?.message?.includes('No delivery')
        ? 'No delivery or order found with that code.'
        : (e?.message ?? 'Lookup failed'));
    } finally {
      setLoading(false);
    }
  };

  // Lets other admin pages (the deliveries list, a future rides
  // detail view) link straight here with ?code=... instead of making
  // whoever's investigating an issue copy a tracking code by hand and
  // paste it into this search box themselves.
  useEffect(() => {
    const fromUrl = params.get('code');
    if (fromUrl) search(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (d?: string) =>
    d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <AdminShell>
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-black text-gray-900 mb-1">Track a delivery</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter the tracking code shared with the customer, merchant or driver.
        </p>
  
        <div className="flex gap-2 mb-8">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="ZD4F9K2A"
            className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 font-mono font-bold tracking-wider focus:border-zana-primary focus:outline-none"
          />
          <button
            onClick={() => search()}
            disabled={loading || !code.trim()}
            className="bg-zana-primary text-white font-bold px-8 rounded-xl disabled:opacity-40"
          >
            {loading ? 'Searching…' : 'Track'}
          </button>
        </div>
  
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
  
        {result && (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">{result.type}</p>
                  <p className="font-mono font-black text-xl text-zana-primary mt-0.5">
                    {result.trackingCode}
                  </p>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-zana-primary-light text-zana-primary text-xs font-bold">
                  {result.status}
                </span>
              </div>
            </div>
  
            {/* Route */}
            {result.pickupAddress && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Route</p>
                <div className="flex gap-3 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-zana-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Pickup</p>
                    <p className="text-sm text-gray-900">{result.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Drop-off</p>
                    <p className="text-sm text-gray-900">{result.dropoffAddress}</p>
                  </div>
                </div>
              </div>
            )}
  
            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">Timeline</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">{fmt(result.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Picked up</span>
                  <span className="text-gray-900">{fmt(result.pickedUpAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivered</span>
                  <span className="text-gray-900">{fmt(result.deliveredAt)}</span>
                </div>
              </div>
            </div>
  
            {/* Driver */}
            {result.driver?.user && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Driver</p>
                <p className="font-bold text-gray-900">{result.driver.user.firstName}</p>
                <p className="text-sm text-gray-500">{result.driver.user.phone}</p>
              </div>
            )}
  
            {/* Financials — only present for deliveries where a
                Commission record already exists (i.e. completed ones);
                the numbers are the same authoritative records the
                completion flow itself wrote, never recalculated here. */}
            {result.financials && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Delivery financials</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Delivery value</p>
                    <p className="font-bold text-gray-900">{result.financials.gmv?.toLocaleString()} RWF</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Payment method</p>
                    <p className="font-bold text-gray-900">{result.financials.paymentMethod === 'CASH' ? 'Cash' : 'Digital'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Zana commission</p>
                    <p className="font-bold text-gray-900">{result.financials.zanaCommission?.toLocaleString()} RWF</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Driver earnings</p>
                    <p className="font-bold text-gray-900">{result.financials.driverEarnings?.toLocaleString()} RWF</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Commission debt</p>
                    <p className={`font-bold ${result.financials.debtStatus === 'OUTSTANDING' ? 'text-amber-600' : 'text-gray-900'}`}>
                      {result.financials.commissionDebt?.toLocaleString()} RWF
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Debt status</p>
                    <p className="font-bold text-gray-900">
                      {result.financials.debtStatus === 'N/A' ? '—' : result.financials.debtStatus === 'PAID' ? 'Paid' : 'Outstanding'}
                    </p>
                  </div>
                  {result.financials.settlement && (
                    <div>
                      <p className="text-xs text-gray-400">Settlement</p>
                      <p className="font-bold text-gray-900">{result.financials.settlement === 'AUTO' ? 'Automatic' : 'Manual'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Proof of handling */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">Proof of handling</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'At pickup', url: result.pickupPhotoUrl },
                  { label: 'At drop-off', url: result.dropoffPhotoUrl },
                ].map(p => (
                  <div key={p.label}>
                    <p className="text-xs text-gray-500 mb-1.5">{p.label}</p>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer">
                        <img src={p.url} alt={p.label}
                          className="w-full h-40 object-cover rounded-xl border border-gray-100" />
                      </a>
                    ) : (
                      <div className="w-full h-40 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                        <p className="text-xs text-gray-400">No photo</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
