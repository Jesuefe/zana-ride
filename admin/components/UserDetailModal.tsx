'use client';
import { useEffect, useState } from 'react';
import { X, Wallet, Car } from 'lucide-react';
import { getUserDetail } from '../lib/api/admin';

export default function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [u, setU] = useState<any>(null);

  useEffect(() => {
    getUserDetail(userId).then(setU).catch(() => {});
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {!u ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg text-gray-900">{u.firstName} {u.lastName}</h2>
                <p className="text-xs text-gray-500">{u.phone} {u.email ? `· ${u.email}` : ''}</p>
                <p className="text-xs text-gray-400 mt-1">Joined {new Date(u.createdAt).toLocaleDateString()} · {u.role}</p>
              </div>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3 mb-4">
              <Wallet size={14} /> Wallet balance: <span className="font-semibold text-gray-900">{(u.wallet?.balance ?? 0).toLocaleString()} RWF</span>
            </div>

            {u.driver && (
              <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3 mb-4">
                <Car size={14} /> {u.driver.vehicle} · {u.driver.plate} · {u.driver.totalTrips} rides · {u.driver.rating?.toFixed(1)}★
              </div>
            )}

            {u.merchant && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 mb-4">
                Merchant: <span className="font-semibold text-gray-900">{u.merchant.businessName}</span> · {u.merchant.status}
              </div>
            )}

            {u.role === 'CUSTOMER' && (
              <>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Recent Rides ({u.tripsAsCustomer?.length ?? 0})</p>
                <div className="space-y-1.5">
                  {!u.tripsAsCustomer?.length && <p className="text-xs text-gray-400">No rides yet.</p>}
                  {u.tripsAsCustomer?.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-gray-700">{t.driver?.user?.firstName ?? 'Driver'} · {new Date(t.createdAt).toLocaleDateString()}</span>
                      <span className="font-semibold text-gray-900">{t.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
