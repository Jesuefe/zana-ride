'use client';

import Link from 'next/link';
import { Wallet, PackagePlus, ArrowRight } from 'lucide-react';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import WhatsAppPreview from '../components/WhatsAppPreview';
import { merchant, merchantDeliveries } from '../lib/mockData';

export default function OverviewPage() {
  const activeDeliveries = merchantDeliveries.filter(
    (d) => d.status !== 'DELIVERED' && d.status !== 'CANCELLED'
  ).length;
  const deliveredToday = merchantDeliveries.filter((d) => d.status === 'DELIVERED').length;

  return (
    <>
      <Topbar title={`Hello, ${merchant.businessName}`} subtitle={merchant.branch} />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-zana-surface border border-zana-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zana-muted">Wallet balance</span>
              <div className="w-9 h-9 rounded-lg bg-zana-primary-light text-zana-primary-dark flex items-center justify-center">
                <Wallet size={16} />
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{merchant.walletBalance.toLocaleString()} RWF</div>
          </div>
          <div className="bg-zana-surface border border-zana-border rounded-xl p-5">
            <span className="text-sm text-zana-muted">Active deliveries</span>
            <div className="text-2xl font-semibold text-gray-900 mt-3">{activeDeliveries}</div>
          </div>
          <div className="bg-zana-surface border border-zana-border rounded-xl p-5">
            <span className="text-sm text-zana-muted">Delivered today</span>
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
            <div className="space-y-3">
              {merchantDeliveries.slice(0, 4).map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-gray-900">{d.receiverName}</div>
                    <div className="text-xs text-zana-muted">{d.dropoffAddress}</div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
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
              Every new delivery request sends an instant WhatsApp message to {merchant.whatsappNumber} — no need to keep this dashboard open.
            </p>
            <WhatsAppPreview
              lines={[
                'New delivery request — Zana Business',
                'Yvonne N. · Nyamirambo, KG 3 St',
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
