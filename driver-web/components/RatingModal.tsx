'use client';

import { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api/client';

export default function RatingModal({
  tripId,
  driverName,
  onClose,
}: {
  tripId: string;
  driverName: string;
  onClose: () => void;
}) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const QUICK = ['Great driver!', 'Very punctual', 'Safe driving', 'Friendly', 'Clean vehicle'];

  const handleSubmit = async () => {
    if (score === 0) return;
    setSubmitting(true);
    try {
      await api.post(`/ratings/trip/${tripId}`, { score, comment, raterRole: 'CUSTOMER' });
      setDone(true);
      setTimeout(onClose, 1500);
    } catch {
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="w-full bg-white rounded-t-2xl p-6 animate-fade-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Rate your ride</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={15} />
          </button>
        </div>

        {done ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-2">🎉</p>
            <p className="font-semibold text-gray-900">Thanks for rating {driverName}!</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4 text-center">How was your ride with <strong>{driverName}</strong>?</p>

            {/* Stars */}
            <div className="flex justify-center gap-3 mb-5">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => setScore(s)}>
                  <Star
                    size={36}
                    className={`transition-colors ${s <= (hover || score) ? 'text-zana-secondary fill-zana-secondary' : 'text-gray-200'}`}
                  />
                </button>
              ))}
            </div>

            {score > 0 && (
              <>
                {/* Quick tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {QUICK.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setComment(c => c.includes(tag) ? c.replace(tag, '').trim() : `${c} ${tag}`.trim())}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        comment.includes(tag) ? 'bg-zana-primary text-white border-zana-primary' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add a comment (optional)"
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none resize-none mb-4"
                />
              </>
            )}

            <button
              onClick={handleSubmit}
              disabled={score === 0 || submitting}
              className="w-full bg-zana-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {submitting ? 'Submitting…' : 'Submit Rating'}
            </button>

            <button onClick={onClose} className="w-full text-center text-sm text-gray-400 mt-3">
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
