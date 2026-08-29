'use client';

import { useEffect, useState } from 'react';
import { Users, Car, Store, Package, Truck, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import AdminShell from '../../components/AdminShell';
import { getOverview } from '../../lib/api/admin';

type Overview = {
  totalUsers: number; customers: number; merchants: number; drivers: number; agents: number;
  activeRides: number; activeDeliveries: number;
  pendingDrivers: number; pendingMerchants: number; pendingProducts: number;
  totalRevenue: number;
};

function StatCard({ icon: Icon, label, value, sub, alert }: any) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm ${alert ? 'ring-2 ring-amber-400' : ''}`}>
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

  useEffect(() => {
    getOverview().then(setData).catch(() => {});
    const interval = setInterval(() => getOverview().then(setData).catch(() => {}), 15000);
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
          <StatCard icon={TrendingUp} label="Active rides" value={data?.activeRides} />
          <StatCard icon={Truck} label="Active deliveries" value={data?.activeDeliveries} />
          <StatCard icon={Car} label="Pending drivers" value={data?.pendingDrivers} alert={data && data.pendingDrivers > 0} />
          <StatCard icon={Package} label="Pending products" value={data?.pendingProducts} alert={data && data.pendingProducts > 0} />
        </div>

        {/* Platform totals */}
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Platform totals</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={Users} label="Total users" value={data?.totalUsers} />
          <StatCard icon={Users} label="Customers" value={data?.customers} />
          <StatCard icon={Car} label="Drivers" value={data?.drivers} />
          <StatCard icon={Store} label="Merchants" value={data?.merchants} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard icon={Users} label="Agents" value={data?.agents} />
          <StatCard icon={Store} label="Pending merchants" value={data?.pendingMerchants} alert={data && data.pendingMerchants > 0} />
          <div className="bg-zana-primary-dark rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
            <p className="text-white/70 text-xs">Total revenue (rides)</p>
            <p className="text-2xl font-bold text-white mt-1">{data ? `${(data.totalRevenue).toLocaleString()} RWF` : '…'}</p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
