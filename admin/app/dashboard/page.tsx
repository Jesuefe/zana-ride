'use client';

import { useEffect, useState } from 'react';
import { Users, Car, Store, Package, Truck, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AdminShell from '../../components/AdminShell';
import { getOverview, getDeliveryKpis } from '../../lib/api/admin';

type Overview = {
  totalUsers: number; customers: number; merchants: number; drivers: number; agents: number;
  activeRides: number; activeDeliveries: number;
  pendingDrivers: number; pendingMerchants: number; pendingProducts: number;
  totalRevenue: number; totalDeliveries: number; deliveryRevenue: number;
};

// Previously every number here was a dead end — seeing "4 pending
// drivers" told you nothing about which four, and finding them meant
// leaving Overview and re-navigating from scratch. Any card with an
// href is now the actual first step into that list, not just a count.
function StatCard({ icon: Icon, label, value, sub, alert, href }: any) {
  const router = useRouter();
  return (
    <div
      onClick={href ? () => router.push(href) : undefined}
      className={`bg-white rounded-xl p-4 shadow-sm ${alert ? 'ring-2 ring-amber-400' : ''} ${href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-zana-primary-light flex items-center justify-center">
          <Icon size={18} className="text-zana-primary" />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{value?.toLocaleString() ?? '…'}</p>
          <p className="text-xs text-gray-500">{label}</p>
          {sub && <p className="text-[10px] text-amber-600 font-semibold">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [deliveryKpis, setDeliveryKpis] = useState<any>(null);

  useEffect(() => {
    getOverview().then(setData).catch(() => {});
    getDeliveryKpis('today').then(setDeliveryKpis).catch(() => {});
    const interval = setInterval(() => {
      getOverview().then(setData).catch(() => {});
      getDeliveryKpis('today').then(setDeliveryKpis).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Overview</h1>
        <p className="text-sm text-gray-500 mb-6">Live platform stats — refreshes every 15 seconds.</p>

        {/* Pending approvals — most urgent */}
        {data && (data.pendingDrivers > 0 || data.pendingMerchants > 0 || data.pendingProducts > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Action required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {[
                  data.pendingDrivers > 0 && `${data.pendingDrivers} driver${data.pendingDrivers > 1 ? 's' : ''} awaiting approval`,
                  data.pendingMerchants > 0 && `${data.pendingMerchants} merchant${data.pendingMerchants > 1 ? 's' : ''} awaiting approval`,
                  data.pendingProducts > 0 && `${data.pendingProducts} product${data.pendingProducts > 1 ? 's' : ''} awaiting review`,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        )}

        {/* Active now */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={TrendingUp} label="Active rides" value={data?.activeRides} href="/dashboard/rides" />
          <StatCard icon={Truck} label="Active deliveries" value={data?.activeDeliveries} href="/dashboard/deliveries" />
          <StatCard icon={Car} label="Pending drivers" value={data?.pendingDrivers} alert={data && data.pendingDrivers > 0} href="/dashboard/drivers" />
          <StatCard icon={Package} label="Pending products" value={data?.pendingProducts} alert={data && data.pendingProducts > 0} href="/dashboard/products" />
        </div>

        {/* Platform totals */}
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Platform totals</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={Users} label="Total users" value={data?.totalUsers} href="/dashboard/users" />
          <StatCard icon={Users} label="Customers" value={data?.customers} href="/dashboard/users?role=CUSTOMER" />
          <StatCard icon={Car} label="Drivers" value={data?.drivers} href="/dashboard/drivers?status=" />
          <StatCard icon={Store} label="Merchants" value={data?.merchants} href="/dashboard/merchants" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          <StatCard icon={Users} label="Agents" value={data?.agents} href="/dashboard/agents" />
          <StatCard icon={Store} label="Pending merchants" value={data?.pendingMerchants} alert={data && data.pendingMerchants > 0} href="/dashboard/merchants?status=PENDING" />
          <div className="bg-zana-primary-dark rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
            <p className="text-white/70 text-xs">Total revenue (rides)</p>
            <p className="text-2xl font-bold text-white mt-1">{data ? `${(data.totalRevenue).toLocaleString()} RWF` : '…'}</p>
          </div>
          <div className="bg-zana-primary-dark rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
            <p className="text-white/70 text-xs">Total revenue (deliveries, {data?.totalDeliveries ?? '…'})</p>
            <p className="text-2xl font-bold text-white mt-1">{data ? `${(data.deliveryRevenue).toLocaleString()} RWF` : '…'}</p>
          </div>
        </div>

        {/* Deliveries today — reads the same Commission/CommissionDebt
            records the delivery completion flow itself writes, not a
            separate calculation. */}
        <h2 className="text-sm font-semibold text-gray-700 mb-3 mt-2">Deliveries today</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={Package} label="Deliveries" value={deliveryKpis?.volume?.delivered} />
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xl font-bold text-gray-900">{deliveryKpis ? `${(deliveryKpis.financial.gmv).toLocaleString()} RWF` : '…'}</p>
            <p className="text-xs text-gray-500">GMV</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xl font-bold text-gray-900">{deliveryKpis ? `${(deliveryKpis.financial.zanaCommission).toLocaleString()} RWF` : '…'}</p>
            <p className="text-xs text-gray-500">Zana commission</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xl font-bold text-gray-900">{deliveryKpis?.performance?.completionRate != null ? `${deliveryKpis.performance.completionRate}%` : '—'}</p>
            <p className="text-xs text-gray-500">Completion rate</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-lg font-bold text-gray-900">{deliveryKpis ? `${(deliveryKpis.financial.cashGmv).toLocaleString()} RWF` : '…'}</p>
            <p className="text-xs text-gray-500">Cash GMV</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-lg font-bold text-gray-900">{deliveryKpis ? `${(deliveryKpis.financial.digitalGmv).toLocaleString()} RWF` : '…'}</p>
            <p className="text-xs text-gray-500">Digital GMV</p>
          </div>
          <div className={`rounded-xl p-4 shadow-sm ${deliveryKpis?.financial?.outstandingCommissionDebt > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-white'}`}>
            <p className="text-lg font-bold text-gray-900">{deliveryKpis ? `${(deliveryKpis.financial.outstandingCommissionDebt).toLocaleString()} RWF` : '…'}</p>
            <p className="text-xs text-gray-500">Outstanding debt (all-time)</p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
