'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Clock, MapPin, Package, Send, X } from 'lucide-react';
import { api } from '../../../lib/api/client';

type Waiting = {
  id: string;
  trackingCode?: string | null;
  itemDescription: string;
  pickupAddress: string;
  dropoffAddress: string;
  fee: number;
  waitingMinutes: number;
  severity: 'WAITING' | 'OVERDUE' | 'CRITICAL';
  customer?: { firstName?: string; phone?: string } | null;
};

type Candidate = {
  id: string;
  name: string;
  phone?: string;
  onlineStatus: string;
  carrying: number;
  atCapacity: boolean;
  distanceKm: number | null;
  locationFresh: boolean;
};

const SEVERITY = {
  CRITICAL: { label: 'Critical', cls: 'bg-red-100 text-red-700 border-red-200' },
  OVERDUE: { label: 'Overdue', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  WAITING: { label: 'Waiting', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export default function DispatchPage() {
  const [items, setItems] = useState<Waiting[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<Waiting | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    api.get<Waiting[]>('/admin/deliveries/unassigned')
      .then(r => setItems(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // Unattended parcels are time-sensitive, so keep this current.
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const openPicker = async (d: Waiting) => {
    setPicking(d);
    setCandidates([]);
    setLoadingCandidates(true);
    try {
      const r = await api.get<Candidate[]>(`/admin/deliveries/${d.id}/candidates`);
      setCandidates(Array.isArray(r) ? r : []);
    } catch {
      setNote('Could not load drivers.');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const assign = async (driverId: string) => {
    if (!picking) return;
    setAssigning(driverId);
    setNote('');
    try {
      await api.post(`/admin/deliveries/${picking.id}/assign`, { driverId });
      setPicking(null);
      load();
    } catch (e: any) {
      setNote(
        e?.message?.includes('ALREADY_ASSIGNED')
          ? 'Another rider just took that delivery.'
          : 'Could not assign that driver.',
      );
      load();
    } finally {
      setAssigning(null);
    }
  };

  const critical = items.filter(i => i.severity === 'CRITICAL').length;

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-black text-gray-900 mb-1">Dispatch</h1>
      <p className="text-sm text-gray-500 mb-6">
        Deliveries no rider has accepted. Riders only see jobs near them, so a parcel
        in a quiet area can sit here unnoticed.
      </p>

      {critical > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            <b>{critical}</b> {critical === 1 ? 'delivery has' : 'deliveries have'} been
            waiting over 20 minutes. Assign someone manually.
          </p>
        </div>
      )}

      {note && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-amber-800">{note}</p>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500 py-8">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16">
          <Package size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Every delivery has a rider</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map(d => {
          const sev = SEVERITY[d.severity];
          return (
            <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sev.cls}`}>
                      {sev.label}
                    </span>
                    {d.trackingCode && (
                      <span className="font-mono text-[11px] font-bold text-zana-primary">
                        {d.trackingCode}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-gray-900">{d.itemDescription}</p>
                  <p className="text-xs text-gray-500">
                    {d.customer?.firstName ?? 'Customer'}
                    {d.customer?.phone ? ` · ${d.customer.phone}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-black text-zana-primary">{d.fee?.toLocaleString()} RWF</p>
                  <p className="flex items-center gap-1 justify-end text-[11px] text-gray-400 mt-0.5">
                    <Clock size={10} /> {d.waitingMinutes} min
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 py-2.5 border-y border-gray-50 mb-3">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-zana-primary mt-1.5 shrink-0" />
                  <p className="text-xs text-gray-600">{d.pickupAddress}</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-gray-600">{d.dropoffAddress}</p>
                </div>
              </div>

              <button
                onClick={() => openPicker(d)}
                className="flex items-center gap-2 bg-zana-primary text-white text-sm font-bold px-4 py-2.5 rounded-xl"
              >
                <Send size={14} /> Send a rider
              </button>
            </div>
          );
        })}
      </div>

      {/* Driver picker */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setPicking(null)}>
          <div className="w-full max-w-lg bg-white rounded-3xl p-5 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="font-black text-lg text-gray-900">Choose a rider</p>
                <p className="text-xs text-gray-500">{picking.itemDescription}</p>
              </div>
              <button onClick={() => setPicking(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={15} className="text-gray-600" />
              </button>
            </div>

            <p className="text-[11px] text-gray-400 mb-4 mt-2">
              Assigning here overrides the route and capacity rules — use it when you
              know something the system does not.
            </p>

            {loadingCandidates && <p className="text-sm text-gray-500 py-6">Finding riders…</p>}

            {!loadingCandidates && candidates.length === 0 && (
              <p className="text-sm text-gray-500 py-6">No approved drivers found.</p>
            )}

            <div className="space-y-2">
              {candidates.map(c => (
                <div key={c.id}
                  className="flex items-center gap-3 border border-gray-100 rounded-2xl px-4 py-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    c.onlineStatus === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900">{c.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {c.distanceKm != null ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={9} /> {c.distanceKm} km
                          {!c.locationFresh && ' (stale)'}
                        </span>
                      ) : 'No location'}
                      {' · '}
                      {c.carrying > 0 ? `carrying ${c.carrying}` : 'free'}
                      {' · '}
                      {c.onlineStatus.toLowerCase()}
                    </p>
                  </div>
                  <button
                    onClick={() => assign(c.id)}
                    disabled={assigning === c.id}
                    className={`text-xs font-bold px-4 py-2 rounded-xl shrink-0 ${
                      c.atCapacity
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-zana-primary text-white'
                    } disabled:opacity-50`}
                  >
                    {assigning === c.id ? 'Sending…' : c.atCapacity ? 'Send anyway' : 'Send'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
