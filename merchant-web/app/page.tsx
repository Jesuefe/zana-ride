'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, PackagePlus, ArrowRight, Loader2 } from 'lucide-react';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import WhatsAppPreview from '../components/WhatsAppPreview';
import { fetchMyMerchant, fetchDeliveries, fetchWallet, ApiMerchant, ApiDelivery } from '../lib/api/merchant';
import { ApiError } from '../lib/api/client';

export default function OverviewPage() {
  const [merchant, setMerchant] = useState<ApiMerchant | null>(null);
  const [deliveries, setDeliveries] = useState<ApiDelivery[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, d, w] = await Promise.all([fetchMyMerchant(), fetchDeliveries(), fetchWallet()]);
        setMerchant(m);
        setDeliveries(d);
        setWalletBalance(w.balance);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeDeliveries = deliveries.filter((d) => d.status !== 'DELIVERED' && d.status !== 'CANCELLED').length;
  const deliveredToday = deliveries.filter((d) => d.status === 'DELIVERED').length;

  if (loading) {
    return (
      <>
        <Topbar title="Loading…" />
        <div className="p-8 flex items-center gap-2 text-sm text-zana-muted">
          <Loader2 size={16} className="animate-spin" /> Loading your business dashboard…
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Topbar title="Zana Business" />
        <div className="p-8 text-sm text-zana-error">{error}</div>
      </>
    );
  }

  return (
    <>
      <Topbar title={`Hello, ${merchant?.businessName}`} subtitle={merchant?.branch ?? undefined} />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-zana-surface border border-zana-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zana-muted">Wallet balance</span>
              <div className="w-9 h-9 rounded-lg bg-zana-primary-light text-zana-primary-dark flex items-center justify-center">
                <Wallet size={16} />
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{(walletBalance ?? 0).toLocaleString()} RWF</div>
          </div>
          <div className="bg-zana-surface border border-zana-border rounded-xl p-5">
            <span className="text-sm text-zana-muted">Active deliveries</span>
            <div className="text-2xl font-semibold text-gray-900 mt-3">{activeDeliveries}</div>
          </div>
          <div className="bg-zana-surface border border-zana-border rounded-xl p-5">
            <span className="text-sm text-zana-muted">Delivered</span>
            <div className="text-2xl font-semibold text-gray-900 mt-3">{deliveredToday}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-zana-surface border border-zana-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent deliveries</h2>
              <Link href="/deliveries" className="text-xs font-medium text-zana-primary-dark flex items-center gap-1 hover:underline">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {deliveries.length === 0 ? (
              <p className="text-sm text-zana-muted">No deliveries yet.</p>
            ) : (
              <div className="space-y-3">
                {deliveries.slice(0, 4).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-gray-900">{d.receiverName}</div>
                      <div className="text-xs text-zana-muted">{d.dropoffAddress}</div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/new-delivery"
              className="mt-5 flex items-center justify-center gap-1.5 bg-zana-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-zana-primary-dark transition-colors w-full"
            >
              <PackagePlus size={15} /> Request a new delivery
            </Link>
          </div>

          <div className="bg-zana-surface border border-zana-border rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-1">How order alerts work</h2>
            <p className="text-xs text-zana-muted mb-4">
              Every new delivery request will send an instant WhatsApp message once the Business API is
              connected on the backend.
            </p>
            <WhatsAppPreview
              lines={[
                'New delivery request — Zana Business',
                'Sample notification preview',
                'Package: Fragile · Fee: 2,500 RWF',
                'Reply CONFIRM to accept.',
              ]}
            />
          </div>
        </div>
      </div>
    </>
  );
}
