'use client';
import { useEffect, useState } from 'react';
import { X, Package, Truck } from 'lucide-react';
import { getOrderDetail } from '../lib/api/admin';

const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [o, setO] = useState<any>(null);

  useEffect(() => {
    getOrderDetail(orderId).then(setO).catch(() => {});
  }, [orderId]);

  const stepIndex = o ? STATUS_STEPS.indexOf(o.status) : -1;
  const isMarket = !!o?.marketId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {!o ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg text-gray-900">Order</h2>
                <p className="text-xs text-gray-400 font-mono">{o.id}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(o.createdAt).toLocaleString()}</p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{o.status}</span>
            </div>

            {o.status !== 'CANCELLED' && (
              <div className="flex items-center mb-4 overflow-x-auto pb-1">
                {STATUS_STEPS.map((s, i) => (
                  <div key={s} className="flex items-center shrink-0">
                    <div className={`w-2 h-2 rounded-full ${i <= stepIndex ? 'bg-zana-primary' : 'bg-gray-200'}`} />
                    {i < STATUS_STEPS.length - 1 && <div className={`w-6 h-0.5 ${i < stepIndex ? 'bg-zana-primary' : 'bg-gray-200'}`} />}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">Customer</p>
                <p className="text-sm font-semibold text-gray-900">{o.customer?.firstName} {o.customer?.lastName}</p>
                <p className="text-xs text-gray-500">{o.customer?.phone}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">{isMarket ? 'Market · Agent' : 'Merchant'}</p>
                <p className="text-sm font-semibold text-gray-900">{isMarket ? o.market?.name : o.merchant?.businessName}</p>
                <p className="text-xs text-gray-500">{isMarket ? (o.agentName ?? 'No agent yet') : o.merchant?.user?.phone}</p>
              </div>
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Items</p>
            <div className="space-y-1.5 mb-4">
              {o.items?.map((i: any) => (
                <div key={i.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <Package size={13} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-gray-700">{i.product?.name} ×{i.quantity}</span>
                  <span className="font-semibold text-gray-900">{(i.price * i.quantity).toLocaleString()} RWF</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between bg-zana-primary-light rounded-xl p-3 mb-4">
              <span className="text-xs text-gray-700">Total ({o.paymentMethod}, {o.paid ? 'Paid' : 'Unpaid'})</span>
              <span className="font-bold text-gray-900">{o.total?.toLocaleString()} RWF</span>
            </div>

            {o.delivery ? (
              <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
                <Truck size={14} />
                Delivery: <span className="font-semibold">{o.delivery.status}</span>
                {o.delivery.driver?.user && <span>· {o.delivery.driver.user.firstName}</span>}
              </div>
            ) : (
              <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">No delivery created yet.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
