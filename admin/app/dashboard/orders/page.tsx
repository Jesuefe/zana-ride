'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import AdminShell from '../../../components/AdminShell';
import { getOrders } from '../../../lib/api/admin';
import { getToken } from '../../../lib/api/client';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-blue-100 text-blue-700',
  READY_FOR_PICKUP: 'bg-purple-100 text-purple-700',
  OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  const load = () => getOrders().then(setOrders).catch(() => {});

  useEffect(() => {
    load();

    // Previously this page never refreshed itself at all — not on a
    // timer, not on any event, only ever on a manual browser reload.
    // WebSocket is the primary path now; this poll is the explicit,
    // preserved fallback the task asked for, in case that connection
    // ever drops. Slower than merchant's own 6s poll on purpose — this
    // is operational visibility, not something a driver-facing loop
    // depends on being second-fresh.
    const interval = setInterval(load, 20000);

    const token = getToken();
    let socket: ReturnType<typeof io> | undefined;
    if (token) {
      socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com', {
        auth: { token },
        transports: ['websocket'],
      });
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      // Simplest, safest reaction to any of these: refetch the whole
      // list from the backend rather than try to patch one field of one
      // row client-side. The backend stays the single source of truth;
      // this only ever asks it again, never guesses at what changed.
      const refetch = () => load();
      socket.on('order:new', refetch);
      socket.on('order:status', refetch);
      socket.on('order:delivery-created', refetch);
      socket.on('delivery:status', refetch);
    }

    return () => {
      clearInterval(interval);
      socket?.disconnect();
    };
  }, []);

  return (
    <AdminShell>
      <div>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-zana-primary' : 'bg-gray-300'}`} />
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
            <button
              onClick={load}
              className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left">
              {['Customer','Source','Items','Total','Status','Date'].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {orders.map(o => {
                // Order.merchantId and Order.marketId are mutually
                // exclusive — an order is always exactly one or the
                // other, never both, never neither.
                const isMarket = !!o.marketId;
                return (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">{o.customer?.firstName} {o.customer?.lastName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mr-1.5 ${isMarket ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {isMarket ? 'MARKET' : 'MERCHANT'}
                      </span>
                      <span className="text-gray-700">{isMarket ? o.market?.name : o.merchant?.businessName}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{o.items?.map((i: any) => `${i.product?.name} ×${i.quantity}`).join(', ')}</td>
                    <td className="px-4 py-3 font-medium">{o.total?.toLocaleString()} RWF</td>
                    <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status] ?? ''}`}>{o.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
              {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
