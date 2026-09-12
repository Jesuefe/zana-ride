'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { api } from '../../lib/api/client';

type RatingItem = {
  id: string;
  rating: number;
  comment: string | null;
  fromName: string;
  createdAt: string;
};

type RatingsResponse = {
  average: number;
  count: number;
  ratings: RatingItem[];
};

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  );
}

export default function RatingsPage() {
  const router = useRouter();
  const [data, setData] = useState<RatingsResponse | null>(null);

  useEffect(() => {
    api.get<RatingsResponse>('/driver/ratings')
      .then(setData)
      .catch(() => setData({ average: 0, count: 0, ratings: [] }));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-black text-gray-900">Your rating</h1>
      </div>

      {data && (
        <div className="px-4 pt-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center mb-4">
            <p className="text-4xl font-black text-gray-900 mb-1">{data.average.toFixed(1)}</p>
            <div className="flex justify-center mb-1">
              <Stars value={data.average} size={20} />
            </div>
            <p className="text-xs text-zana-muted">
              From {data.count} {data.count === 1 ? 'rating' : 'ratings'}
            </p>
          </div>

          {data.ratings.length === 0 && (
            <p className="text-center text-sm text-zana-muted py-8">No ratings yet</p>
          )}

          <div className="space-y-3">
            {data.ratings.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold text-gray-900">{r.fromName}</p>
                  <Stars value={r.rating} />
                </div>
                {r.comment && <p className="text-xs text-gray-600 mb-1.5">{r.comment}</p>}
                <p className="text-[10px] text-zana-muted">
                  {new Date(r.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
