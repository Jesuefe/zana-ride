'use client';

import { useState } from 'react';
import Topbar from '../../components/Topbar';
import StatusBadge from '../../components/StatusBadge';
import { supportTickets as initial, TicketStatus } from '../../lib/mockData';

const statusFlow: Record<TicketStatus, TicketStatus> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'WAITING_CUSTOMER',
  WAITING_CUSTOMER: 'RESOLVED',
  RESOLVED: 'RESOLVED',
};

const nextLabel: Record<TicketStatus, string> = {
  OPEN: 'Start working',
  IN_PROGRESS: 'Wait on customer',
  WAITING_CUSTOMER: 'Mark resolved',
  RESOLVED: 'Resolved',
};

export default function SupportPage() {
  const [tickets, setTickets] = useState(initial);

  const advance = (id: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: statusFlow[t.status] } : t))
    );
  };

  const openCount = tickets.filter((t) => t.status !== 'RESOLVED').length;

  return (
    <>
      <Topbar title="Support" subtitle={`${openCount} open tickets`} />
      <div className="p-8">
        <div className="bg-zana-surface border border-zana-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zana-muted border-b border-zana-border bg-gray-50">
                <th className="px-5 py-3 font-medium">Ticket</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-zana-border last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{t.subject}</div>
                    <div className="text-xs text-zana-muted">{t.id}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{t.customerName}</td>
                  <td className="px-5 py-3 text-gray-700">{t.category}</td>
                  <td className="px-5 py-3"><StatusBadge status={t.priority} /></td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-3 text-xs text-zana-muted">{t.date}</td>
                  <td className="px-5 py-3 text-right">
                    {t.status !== 'RESOLVED' && (
                      <button
                        onClick={() => advance(t.id)}
                        className="text-xs font-medium text-zana-primary-dark hover:underline"
                      >
                        {nextLabel[t.status]}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
