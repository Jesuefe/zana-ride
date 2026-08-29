'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestOtp, verifyOtp } from '../../lib/api/merchant';
import { ApiError } from '../../lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+250700000002');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      await requestOtp(phone);
      setStage('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await verifyOtp(phone, code);
      if (user.role !== 'MERCHANT') {
        setError('This account is not a merchant. Use the seeded merchant phone number.');
        return;
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm bg-white border border-zana-border rounded-xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-zana-secondary flex items-center justify-center font-extrabold text-gray-900">Z</div>
          <span className="font-bold text-gray-900">Zana Business</span>
        </div>

        {stage === 'phone' ? (
          <>
            <label className="text-xs font-medium text-zana-muted block mb-1.5">Business phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zana-border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
            <button
              onClick={handleRequestOtp}
              disabled={loading}
              className="w-full bg-zana-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-zana-primary-dark disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <p className="text-xs text-zana-muted mt-3">
              Demo seeded merchant: +250700000002. Check the API container logs for the OTP code.
            </p>
          </>
        ) : (
          <>
            <label className="text-xs font-medium text-zana-muted block mb-1.5">6-digit code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 text-sm border border-zana-border rounded-lg mb-4 tracking-widest focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full bg-zana-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-zana-primary-dark disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify & sign in'}
            </button>
          </>
        )}

        {error && <p className="text-xs text-zana-error mt-3">{error}</p>}
      </div>
    </div>
  );
}
