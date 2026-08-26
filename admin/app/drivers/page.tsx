'use client';

import { useState } from 'react';
import { Search, Check, X, Ban, Star, FileCheck2, FileX2 } from 'lucide-react';
import Topbar from '../../components/Topbar';
import StatusBadge from '../../components/StatusBadge';
import { drivers as initialDrivers, Driver } from '../../lib/mockData';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Driver | null>(null);

  const filtered = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.plate.toLowerCase().includes(query.toLowerCase()) ||
      d.phone.includes(query)
  );

  const updateStatus = (id: string, status: Driver['approvalStatus']) => {
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, approvalStatus: status } : d)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, approvalStatus: status } : prev));
  };

  return (
    <>
      <Topbar title="Drivers" subtitle={`${drivers.length} registered drivers`} />
      <div className="p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zana-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, or plate…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-zana-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>
        </div>

        <div className="bg-zana-surface border border-zana-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zana-muted border-b border-zana-border bg-gray-50">
                <th className="px-5 py-3 font-medium">Driver</th>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium">Rating</th>
                <th className="px-5 py-3 font-medium">Trips</th>
                <th className="px-5 py-3 font-medium">Approval</th>
                <th className="px-5 py-3 font-medium">Online</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-zana-border last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{d.name}</div>
                    <div className="text-xs text-zana-muted">{d.phone}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{d.vehicle}<div className="text-xs text-zana-muted">{d.plate}</div></td>
                  <td className="px-5 py-3">
                    {d.rating > 0 ? (
                      <span className="flex items-center gap-1 text-gray-700">
                        <Star size={13} className="fill-zana-secondary text-zana-secondary" /> {d.rating}
                      </span>
                    ) : (
                      <span className="text-zana-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-700">{d.totalTrips}</td>
                  <td className="px-5 py-3"><StatusBadge status={d.approvalStatus} /></td>
                  <td className="px-5 py-3"><StatusBadge status={d.onlineStatus} /></td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setSelected(d)}
                      className="text-xs font-medium text-zana-primary-dark hover:underline"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <DriverDrawer driver={selected} onClose={() => setSelected(null)} onUpdateStatus={updateStatus} />
      )}
    </>
  );
}

function DriverDrawer({
  driver,
  onClose,
  onUpdateStatus,
}: {
  driver: Driver;
  onClose: () => void;
  onUpdateStatus: (id: string, status: Driver['approvalStatus']) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[420px] bg-white h-full shadow-xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{driver.name}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <InfoRow label="Phone" value={driver.phone} />
          <InfoRow label="Vehicle" value={`${driver.vehicle} · ${driver.plate}`} />
          <InfoRow label="Service" value={driver.serviceType} />
          <InfoRow label="Joined" value={driver.joinedDate} />
          <InfoRow label="Acceptance rate" value={`${driver.acceptanceRate}%`} />
          <InfoRow label="Cancellation rate" value={`${driver.cancellationRate}%`} />
          <InfoRow label="Earnings this month" value={`${driver.earningsThisMonth.toLocaleString()} RWF`} />

          <div className="pt-2">
            <div className="text-xs text-zana-muted mb-2 uppercase tracking-wide">Documents</div>
            <div className="space-y-2">
              {driver.documents.map((doc) => (
                <div key={doc.label} className="flex items-center justify-between border border-zana-border rounded-lg px-3 py-2">
                  <span className="text-gray-700">{doc.label}</span>
                  {doc.verified ? (
                    <FileCheck2 size={16} className="text-zana-success" />
                  ) : (
                    <FileX2 size={16} className="text-zana-error" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-zana-border flex gap-2">
          {driver.approvalStatus === 'PENDING' && (
            <>
              <button
                onClick={() => onUpdateStatus(driver.id, 'APPROVED')}
                className="flex-1 flex items-center justify-center gap-1.5 bg-zana-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-zana-primary-dark transition-colors"
              >
                <Check size={15} /> Approve
              </button>
              <button
                onClick={() => onUpdateStatus(driver.id, 'REJECTED')}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={15} /> Reject
              </button>
            </>
          )}
          {driver.approvalStatus === 'APPROVED' && (
            <button
              onClick={() => onUpdateStatus(driver.id, 'SUSPENDED')}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#FCEBEB] text-[#791F1F] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#F7C1C1] transition-colors"
            >
              <Ban size={15} /> Suspend driver
            </button>
          )}
          {driver.approvalStatus === 'SUSPENDED' && (
            <button
              onClick={() => onUpdateStatus(driver.id, 'APPROVED')}
              className="flex-1 flex items-center justify-center gap-1.5 bg-zana-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-zana-primary-dark transition-colors"
            >
              <Check size={15} /> Reinstate driver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zana-muted">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
