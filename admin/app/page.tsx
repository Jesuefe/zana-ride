'use client';

import { DollarSign, Route, Car, Clock, LifeBuoy, Users } from 'lucide-react';
import Topbar from '../components/Topbar';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { revenueSeries, trips, drivers, supportTickets } from '../lib/mockData';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DashboardPage() {
  const todayRevenue = revenueSeries[revenueSeries.length - 1].revenue;
  const onlineDrivers = drivers.filter((d) => d.onlineStatus !== 'OFFLINE').length;
  const pendingApprovals = drivers.filter((d) => d.approvalStatus === 'PENDING').length;
  const openTickets = supportTickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
  const completedTrips = trips.filter((t) => t.status === 'COMPLETED').length;
  const cancelledTrips = trips.filter((t) => t.status === 'CANCELLED' || t.status === 'NO_DRIVER_FOUND').length;

  return (
    <>
      <Topbar title="Dashboard" subtitle="Kigali operations overview" />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Today's revenue" value={`${todayRevenue.toLocaleString()} RWF`} icon={DollarSign} trend="+12% vs yesterday" trendUp accent="primary" />
          <StatCard label="Active trips" value="18" icon={Route} trend="Live now" accent="primary" />
          <StatCard label="Online drivers" value={String(onlineDrivers)} icon={Car} trend={`${drivers.length} total`} accent="secondary" />
          <StatCard label="Pending approvals" value={String(pendingApprovals)} icon={Clock} trend="Needs review" accent="secondary" />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-zana-surface border border-zana-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Revenue this week</h2>
              <span className="text-xs text-zana-muted">RWF</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00A082" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00A082" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} RWF`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#00A082" strokeWidth={2} fill="url(#revGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zana-surface border border-zana-border rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Today's snapshot</h2>
            <div className="space-y-3 text-sm">
              <Row label="Completed trips" value={String(completedTrips)} />
              <Row label="Cancelled / unmatched" value={String(cancelledTrips)} />
              <Row label="New customers" value="14" />
              <Row label="Open support tickets" value={String(openTickets)} icon={LifeBuoy} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-zana-surface border border-zana-border rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Recent trips</h2>
            <div className="space-y-3">
              {trips.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-gray-900">{t.customerName}</div>
                    <div className="text-xs text-zana-muted">{t.pickup} → {t.destination}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zana-surface border border-zana-border rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Drivers awaiting approval</h2>
            {pendingApprovals === 0 ? (
              <p className="text-sm text-zana-muted">No pending approvals right now.</p>
            ) : (
              <div className="space-y-3">
                {drivers.filter((d) => d.approvalStatus === 'PENDING').map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-gray-900">{d.name}</div>
                      <div className="text-xs text-zana-muted">{d.vehicle}</div>
                    </div>
                    <StatusBadge status={d.approvalStatus} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Users }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zana-muted flex items-center gap-1.5">
        {Icon && <Icon size={13} />}
        {label}
      </span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
