'use client';

import { useState } from 'react';
import { X, ShieldAlert, MapPinOff, TriangleAlert, CircleHelp } from 'lucide-react';
import { reportRide } from '../lib/api/trips';

const reasons = [
  { id: 'safety', label: 'I feel unsafe', icon: ShieldAlert },
  { id: 'route', label: 'Driver went off route', icon: MapPinOff },
  { id: 'behavior', label: 'Driver behavior', icon: TriangleAlert },
  { id: 'other', label: 'Something else', icon: CircleHelp },
];

export default function ReportModal({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      await reportRide(tripId, selected, details.trim() || undefined);
      setSubmitted(true);
      setTimeout(onClose, 1800);
    } catch {
      // A report failing silently is worse than the person just not
      // reporting at all — they'd walk away believing it went through.
      setError('Could not send that. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 animate-fade-slide-up">
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-zana-primary-light flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={24} className="text-zana-primary" />
            </div>
            <p className="font-semibold text-gray-900">Report sent</p>
            <p className="text-sm text-zana-muted mt-1">
              {selected === 'safety'
                ? 'Zana Safety has been notified along with your trip details.'
                : 'Zana has recorded this with your trip details and will follow up.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-lg text-gray-900">Report an issue</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-zana-muted mb-4">Is everything okay? Select what's happening.</p>

            <div className="space-y-2">
              {reasons.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-1.5 text-left transition-colors ${
                    selected === r.id ? 'border-zana-primary bg-zana-primary-light' : 'border-zana-border'
                  }`}
                  style={{ borderWidth: 1.5 }}
                >
                  <r.icon size={19} className={selected === r.id ? 'text-zana-primary' : 'text-gray-700'} />
                  <span className="text-sm text-gray-900">{r.label}</span>
                </button>
              ))}
            </div>

            {selected === 'other' && (
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Tell us what happened"
                rows={3}
                className="w-full mt-3 border-1.5 border-zana-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-zana-primary"
                style={{ borderWidth: 1.5 }}
              />
            )}

            {error && <p className="text-xs text-zana-error mt-3">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={!selected || submitting}
              className="w-full mt-5 bg-zana-error text-white font-semibold py-3 rounded-xl disabled:opacity-40 transition-transform active:scale-[0.98]"
            >
              {submitting ? 'Sending…' : 'Send report to Zana Safety'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
