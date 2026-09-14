'use client';
import { useEffect, useState } from 'react';
import { fetchMyOrders, updateOrderStatus } from '../../lib/api/merchant';
import { Package, Clock, ChevronRight, Truck } from 'lucide-react';

// Merchant only handles: PENDING → CONFIRMED → PREPARING → READY_FOR_PICKUP
// After READY_FOR_PICKUP, Zana dispatches a driver automatically
const MERCHANT_NEXT: Record<string, { label: string; next: string }> = {
  PENDING:     { label: 'Confirm order', next: 'CONFIRMED' },
  CONFIRMED:   { label: 'Start preparing', next: 'PREPARING' },
  PREPARING:   { label: 'Ready for pickup', next: 'READY_FOR_PICKUP' },
};

const STATUS_STYLE: Record<string, string> = {
  PENDING:          'bg-amber-100 text-amber-700',
  CONFIRMED:        'bg-blue-100 text-blue-700',
  PREPARING:        'bg-indigo-100 text-indigo-700',
  READY_FOR_PICKUP: 'bg-purple-100 text-purple-700',
  OUT_FOR_DELIVERY: 'bg-cyan-100 text-cyan-700',
  DELIVERED:        'bg-green-100 text-green-700',
  CANCELLED:        'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:          'New order',
  CONFIRMED:        'Confirmed',
  PREPARING:        'Preparing',
  READY_FOR_PICKUP: 'Ready — driver en route',
  OUT_FOR_DELIVERY: 'Driver delivering',
  DELIVERED:        'Delivered',
  CANCELLED:        'Cancelled',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [filter, setFilter] = useState('active');

  const load = () => fetchMyOrders().then(setOrders).catch(() => {});

  useEffect(() => {
    load();
    const i = setInterval(load, 6000);
    return () => clearInterval(i);
  }, []);

  const advance = async (id: string, next: string) => {
    setAdvancing(id);
    await updateOrderStatus(id, next).catch(() => {});
    await load();
    setAdvancing(null);
  };

  const filtered = orders.filter(o => {
    if (filter === 'active') return !['DELIVERED','CANCELLED'].includes(o.status);
    if (filter === 'done') return ['DELIVERED','CANCELLED'].includes(o.status);
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <div className="flex gap-2">
          {[['active','Active'],['done','Done'],['all','All']].map(([val,label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                filter === val ? 'bg-zana-primary text-white border-zana-primary' : 'bg-white text-gray-600 border-gray-200'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <Package size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No orders here</p>
          </div>
        )}

        {filtered.map(o => {
          const action = MERCHANT_NEXT[o.status];
          const isDriverHandling = ['READY_FOR_PICKUP','OUT_FOR_DELIVERY'].includes(o.status);
          const isDone = ['DELIVERED','CANCELLED'].includes(o.status);

          return (
            <div key={o.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 ${
              o.status === 'PENDING' ? 'border-amber-400' :
              isDone ? 'border-gray-200' :
              isDriverHandling ? 'border-cyan-400' :
              'border-zana-primary'
            }`}>
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-bold text-gray-900">
                      {o.customer?.firstName} {o.customer?.lastName}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(o.createdAt ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${STATUS_STYLE[o.status] ?? ''}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1 mb-3">
                  {o.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.product?.name} <span className="text-gray-400">×{item.quantity}</span></span>
                      <span className="font-semibold text-gray-900">{((item.product?.price ?? 0) * item.quantity).toLocaleString()} RWF</span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2 mb-3">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="font-black text-zana-primary">{o.total?.toLocaleString() ?? '—'} RWF</span>
                </div>

                {/* Driver handling notice */}
                {isDriverHandling && (
                  <div className="flex items-center gap-2 bg-cyan-50 rounded-xl px-3 py-2.5 mb-3">
                    <Truck size={14} className="text-cyan-600 shrink-0" />
                    <p className="text-xs text-cyan-700 font-semibold">
                      {o.status === 'READY_FOR_PICKUP'
                        ? 'A Zana driver has been dispatched to collect this order.'
                        : 'Driver is delivering to your customer.'}
                    </p>
                  </div>
                )}

                {/* Action button — only for merchant-controlled statuses */}
                {action && !isDone && (
                  <button
                    onClick={() => advance(o.id, action.next)}
                    disabled={advancing === o.id}
                    className="w-full bg-zana-primary text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {advancing === o.id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><ChevronRight size={15} /> {action.label}</>
                    )}
                  </button>
                )}

                {o.status === 'PENDING' && (
                  <button
                    onClick={() => advance(o.id, 'CANCELLED')}
                    className="w-full mt-2 text-xs text-gray-400 hover:text-red-500 py-1"
                  >
                    Decline order
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
