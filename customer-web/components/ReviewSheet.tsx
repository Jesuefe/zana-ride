'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '../lib/api/client';

type Props = {
  target: 'DELIVERY' | 'MERCHANT' | 'MARKET';
  deliveryId?: string;
  merchantId?: string;
  marketId?: string;
  orderId?: string;
  title: string;
  subtitle?: string;
  onDone: () => void;
};

export default function ReviewSheet({
  target, deliveryId, merchantId, marketId, orderId, title, subtitle, onDone,
}: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (rating < 1) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/deliveries/reviews', {
        target, rating, comment: comment.trim() || undefined,
        deliveryId, merchantId, marketId, orderId,
      });
      onDone();
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('ALREADY_REVIEWED')) {
        onDone(); // already rated, nothing to fix
      } else if (msg.includes('DELIVERY_NOT_COMPLETE')) {
        setError('You can rate this once the delivery is complete.');
      } else {
        setError('Could not save your rating. Try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const LABELS = ['', 'Poor', 'Not great', 'Fine', 'Good', 'Excellent'];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="w-full bg-white rounded-t-3xl p-5 pb-8">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <p className="font-black text-lg text-gray-900">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}

        <div className="flex justify-center gap-2 my-6">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)} className="active:scale-90 transition-transform">
              <Star
                size={34}
                className={n <= rating ? 'text-amber-400' : 'text-gray-200'}
                fill={n <= rating ? '#FBBF24' : '#E5E7EB'}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-sm font-bold text-zana-primary -mt-3 mb-4">
            {LABELS[rating]}
          </p>
        )}

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Anything you want to add? (optional)"
          rows={3}
          className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm resize-none focus:border-zana-primary focus:outline-none"
        />

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        <button
          onClick={submit}
          disabled={rating < 1 || saving}
          className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl mt-4 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Submit rating'}
        </button>
        <button onClick={onDone} className="w-full text-sm text-gray-400 py-2 mt-1">
          Skip
        </button>
      </div>
    </div>
  );
}
