'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyPhone, resendVerification } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { useLang } from '../../lib/LangContext';

function VerifyForm() {
  const { t } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get('phone') ?? '';
  const email = params.get('email') ?? '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Previously the only delivery channel was SMS — a traveller on a
  // foreign SIM that Africa's Talking's African-carrier routing can't
  // reliably reach had no way in at all. Switches the code's delivery
  // channel to the same email already given at signup.
  const [usingEmail, setUsingEmail] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      await verifyPhone(code);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Invalid code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (viaEmail: boolean) => {
    setUsingEmail(viaEmail);
    setResendNotice('');
    try {
      await resendVerification(viaEmail);
      setResendNotice(viaEmail ? `${t('Code sent to')} ${email || t('your email')}.` : `${t('Code sent to')} ${phone}.`);
      setCooldown(30);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Could not send a new code.'));
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('Enter the code')}</h1>
      <p className="text-sm text-zana-muted mt-1">
        {usingEmail ? `${t('Sent by email to')} ${email || t('your email')}` : `${t('Sent via SMS to')} ${phone}`}
      </p>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••••"
        inputMode="numeric"
        autoFocus
        className="w-full mt-6 border border-zana-border rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
      />

      {error && <p className="text-xs text-zana-error mt-3">{error}</p>}
      {resendNotice && <p className="text-xs text-green-600 mt-3">{resendNotice}</p>}

      <button
        disabled={code.length !== 6 || loading}
        onClick={handleVerify}
        className="w-full mt-6 bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-40 hover:bg-zana-primary-dark transition-colors"
      >
        {loading ? t('Verifying…') : t('Verify')}
      </button>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => handleResend(usingEmail)}
          disabled={cooldown > 0}
          className="text-xs text-gray-400 disabled:opacity-50"
        >
          {cooldown > 0 ? `${t('Resend in')} ${cooldown}s` : t('Resend code')}
        </button>
        {email && !usingEmail && (
          <button onClick={() => handleResend(true)} className="text-xs font-semibold text-zana-primary">
            {t("Didn’t get it? Send to email instead")}
          </button>
        )}
      </div>
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
