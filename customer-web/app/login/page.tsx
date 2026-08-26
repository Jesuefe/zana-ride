'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car } from 'lucide-react';
import { requestOtp } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = phone.replace(/\D/g, '').length >= 9;

  const handleContinue = async () => {
    const fullPhone = `+250${phone.replace(/\D/g, '')}`;
    setLoading(true);
    setError(null);
    try {
      await requestOtp(fullPhone);
      router.push(`/verify?phone=${encodeURIComponent(fullPhone)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-zana-primary-light flex-1 flex items-center justify-center">
        <Car size={80} className="text-zana-primary" strokeWidth={1.25} />
      </div>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">What's your number?</h1>
        <p className="text-sm text-zana-muted mt-1">We'll send a code to verify it's you.</p>

        <div className="flex gap-2 mt-6">
          <div className="border border-zana-border rounded-lg px-3 flex items-center text-sm">RW +250</div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="788 123 456"
            inputMode="numeric"
            className="flex-1 border border-zana-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            autoFocus
          />
        </div>

        {error && <p className="text-xs text-zana-error mt-3">{error}</p>}

        <button
          disabled={!valid || loading}
          onClick={handleContinue}
          className="w-full mt-6 bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-40 hover:bg-zana-primary-dark transition-colors"
        >
          {loading ? 'Sending…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
