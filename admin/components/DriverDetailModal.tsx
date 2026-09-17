'use client';
import { useEffect, useState } from 'react';
import { X, FileText, Star, Car, Check } from 'lucide-react';
import { getDriverDetail, verifyDriverDocument } from '../lib/api/admin';

export default function DriverDetailModal({ driverId, onClose }: { driverId: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  // Previously documents only ever showed a static badge — there was
  // no way anywhere in admin to actually flip a document to verified,
  // even though the backend endpoint for it already existed.
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    getDriverDetail(driverId).then(setD).catch(() => {});
  }, [driverId]);

  const toggleVerify = async (docId: string, current: boolean) => {
    setVerifying(docId);
    try {
      await verifyDriverDocument(docId, !current);
      setD((prev: any) => ({
        ...prev,
        documents: prev.documents.map((doc: any) => doc.id === docId ? { ...doc, verified: !current } : doc),
      }));
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {!d ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg text-gray-900">{d.user?.firstName} {d.user?.lastName}</h2>
                <p className="text-xs text-gray-500">{d.user?.phone}</p>
                <p className="text-xs text-gray-400 mt-1">Joined {new Date(d.createdAt).toLocaleDateString()}</p>
              </div>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{d.totalTrips}</p>
                <p className="text-[10px] text-gray-500">Total rides</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900 flex items-center justify-center gap-1"><Star size={12} className="text-amber-400" />{d.rating?.toFixed(1)}</p>
                <p className="text-[10px] text-gray-500">Rating</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${d.onlineStatus === 'ONLINE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{d.onlineStatus}</span>
                <p className="text-[10px] text-gray-500 mt-1">Status</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3 mb-4">
              <Car size={14} /> {d.vehicle} · {d.plate} · {d.serviceType}
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Verification Documents</p>
            <div className="space-y-1.5 mb-4">
              {!d.documents?.length && <p className="text-xs text-gray-400">No documents uploaded.</p>}
              {d.documents?.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 flex-1 min-w-0 hover:underline">
                    <FileText size={13} className="text-gray-400 shrink-0" />
                    <span className="text-gray-700 truncate">{doc.label}</span>
                  </a>
                  <button
                    onClick={() => toggleVerify(doc.id, doc.verified)}
                    disabled={verifying === doc.id}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 disabled:opacity-50 ${doc.verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {doc.verified && <Check size={10} />}
                    {verifying === doc.id ? '…' : doc.verified ? 'Verified' : 'Verify'}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Recent Rides</p>
            <div className="space-y-1.5">
              {!d.trips?.length && <p className="text-xs text-gray-400">No rides yet.</p>}
              {d.trips?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-700">{t.customer?.firstName ?? 'Customer'} · {new Date(t.requestedAt).toLocaleDateString()}</span>
                  <span className="font-semibold text-gray-900">{t.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
