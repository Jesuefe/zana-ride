'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyOtp } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get('phone') ?? '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await verifyOtp(phone, code);
      if (user.firstName && user.lastName) {
        router.push('/');
      } else {
        router.push('/onboarding');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Enter the code</h1>
      <p className="text-sm text-zana-muted mt-1">Sent via SMS to {phone}</p>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••••"
        inputMode="numeric"
        className="w-full mt-6 border border-zana-border rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
        autoFocus
      />

      {error && <p className="text-xs text-zana-error mt-3">{error}</p>}

      <button
        disabled={code.length !== 6 || loading}
        onClick={handleVerify}
        className="w-full mt-6 bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-40 hover:bg-zana-primary-dark transition-colors"
      >
        {loading ? 'Verifying…' : 'Verify'}
      </button>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
