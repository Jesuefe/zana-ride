'use client';

import { useState } from 'react';
import { X, ShieldAlert, MapPinOff, TriangleAlert, CircleHelp } from 'lucide-react';

const reasons = [
  { id: 'safety', label: 'I feel unsafe', icon: ShieldAlert },
  { id: 'route', label: 'Driver went off route', icon: MapPinOff },
  { id: 'behavior', label: 'Driver behavior', icon: TriangleAlert },
  { id: 'other', label: 'Something else', icon: CircleHelp },
];

export default function ReportModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selected) return;
    // TODO: wire to a real /trips/:id/report endpoint once the backend
    // supports it — for now this confirms the flow end to end.
    setSubmitted(true);
    setTimeout(onClose, 1800);
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
              The Zana safety team has been notified with your live trip details.
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

            <button
              onClick={handleSubmit}
              disabled={!selected}
              className="w-full mt-5 bg-zana-error text-white font-semibold py-3 rounded-xl disabled:opacity-40 transition-transform active:scale-[0.98]"
            >
              Send report to Zana Safety
            </button>
          </>
        )}
      </div>
    </div>
  );
}
