'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Truck, Wallet, ShoppingBag, Plus, TrendingUp } from 'lucide-react';
import Topbar from '../components/Topbar';
import { fetchMyMerchant, fetchDeliveries, fetchWallet, fetchMyOrders, ApiMerchant, ApiDelivery } from '../lib/api/merchant';
import { ApiError } from '../lib/api/client';

export default function OverviewPage() {
  const [merchant, setMerchant] = useState<ApiMerchant | null>(null);
  const [deliveries, setDeliveries] = useState<ApiDelivery[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, d, w, o] = await Promise.all([
          fetchMyMerchant(),
          fetchDeliveries(),
          fetchWallet(),
          fetchMyOrders().catch(() => []),
        ]);
        setMerchant(m);
        setDeliveries(d);
        setWalletBalance(w.balance);
        setOrders(o);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pendingOrders = orders.filter(o => o.status === 'PENDING').length;
  const activeDeliveries = deliveries.filter(d => ['REQUESTED','COURIER_ASSIGNED','PICKED_UP'].includes(d.status)).length;

  return (
    <div>
      <Topbar title={merchant?.businessName ?? 'Dashboard'} subtitle={undefined} />

      {/* Zana logo + greeting */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 bg-zana-primary rounded-xl flex items-center justify-center font-black text-white text-xl">Z</div>
        <div>
          <p className="text-xs text-gray-500">Welcome back</p>
          <p className="font-bold text-gray-900">{merchant?.businessName ?? '—'}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-zana-primary-light rounded-xl p-4">
          <Wallet size={18} className="text-zana-primary mb-2" />
          <p className="text-2xl font-bold text-gray-900">{walletBalance?.toLocaleString() ?? '—'}</p>
          <p className="text-xs text-gray-500">RWF balance</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <ShoppingBag size={18} className="text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{pendingOrders}</p>
          <p className="text-xs text-gray-500">Pending orders</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <Truck size={18} className="text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{activeDeliveries}</p>
          <p className="text-xs text-gray-500">Active deliveries</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <TrendingUp size={18} className="text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{deliveries.length}</p>
          <p className="text-xs text-gray-500">Total deliveries</p>
        </div>
      </div>

      {/* Quick actions */}
      <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
      <div className="space-y-2">
        <Link href="/new-delivery" className="flex items-center gap-3 bg-zana-primary text-white rounded-xl px-4 py-3.5">
          <Truck size={18} />
          <div className="flex-1">
            <p className="font-semibold text-sm">Send a Package</p>
            <p className="text-xs text-white/70">Request a Zana courier</p>
          </div>
          <Plus size={16} />
        </Link>
        <Link href="/products" className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm">
          <Package size={18} className="text-zana-primary" />
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900">My Products</p>
            <p className="text-xs text-gray-500">Manage your listings</p>
          </div>
        </Link>
        <Link href="/orders" className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm">
          <ShoppingBag size={18} className="text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900">Orders</p>
            <p className="text-xs text-gray-500">{pendingOrders > 0 ? `${pendingOrders} pending` : 'View all orders'}</p>
          </div>
          {pendingOrders > 0 && (
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{pendingOrders}</span>
          )}
        </Link>
      </div>

      {/* Merchant status */}
      {(merchant as any)?.status === 'PENDING' && (
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800">Account pending approval</p>
          <p className="text-xs text-amber-600 mt-1">Your merchant account is under review. Products you add will only appear publicly after admin approval.</p>
        </div>
      )}
    </div>
  );
}
