'use client';

import { useState } from 'react';
import PasswordField from '../../components/PasswordField';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { login } from '../../lib/api/auth';
import { recoverActiveRide } from '../../lib/api/trips';
import { haptic } from '../../lib/haptics';
import { ApiError } from '../../lib/api/client';
import { useLang } from '../../lib/LangContext';

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = identifier.trim().length > 3 && password.length >= 6;

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      haptic('success');

      // A customer may have lost connectivity, closed the app, or restarted
      // the phone while a ride was still active. Never create a new ride here:
      // ask the server for the authoritative active ride and resume it.
      try {
        const activeRide = await recoverActiveRide();
        if (activeRide) {
          router.replace(activeRide.groupId
            ? `/tracking?groupId=${encodeURIComponent(activeRide.groupId)}`
            : `/tracking?tripId=${encodeURIComponent(activeRide.id)}`);
          return;
        }
      } catch {
        // Login itself succeeded. If recovery is temporarily unavailable,
        // continue to the home screen; the home screen retries recovery.
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="zana-page-enter zana-auth-page zana-login-page flex flex-col min-h-screen">
      <div className="zana-login-hero animate-fade-in">
        <div className="zana-login-topline">
          <Image src="/zana-horizontal.png" alt="Zana" width={116} height={42} className="zana-login-wordmark" priority />
          <span className="zana-login-city">KIGALI · RWANDA</span>
        </div>
        <div className="zana-login-map" aria-hidden="true">
          <span className="zana-map-road zana-map-road-one" />
          <span className="zana-map-road zana-map-road-two" />
          <span className="zana-map-route" />
          <span className="zana-map-pin zana-map-pin-start" />
          <span className="zana-map-pin zana-map-pin-end" />
          <span className="zana-map-vehicle"><span /></span>
          <span className="zana-map-label">YOUR CITY, IN MOTION</span>
        </div>
        <div className="zana-login-hero-copy">
          <p>MOVE WITH ZANA</p>
          <h2>Your city.<br />Your journey.<br /><span>Your Zana.</span></h2>
        </div>
      </div>
      <div className="zana-login-content">
        <div className="zana-login-heading">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('Welcome back')}</h1>
            <p className="text-sm text-zana-muted mt-1">{t('Log in with your email or phone number.')}</p>
          </div>
          <span className="zana-login-lock" aria-hidden="true">↗</span>
        </div>

        <div className="mt-6 space-y-3">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t('Email or phone number')}
            className="zana-login-input w-full border border-zana-border rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            autoFocus
          />
          <PasswordField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('Password')}
            autoComplete="current-password"
            className="zana-login-input border border-zana-border rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            onKeyDown={(e) => e.key === 'Enter' && valid && handleLogin()}
          />
        </div>

        {error && <p className="text-xs text-zana-error mt-3">{error}</p>}

        <button
          disabled={!valid || loading}
          onClick={handleLogin}
          className="zana-login-submit w-full mt-6 bg-zana-primary text-white font-semibold py-3.5 rounded-xl disabled:opacity-40 hover:bg-zana-primary-dark transition-colors active:scale-[0.98]"
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>

        <div className="flex flex-col gap-1 mt-3">
          <button
            onClick={() => router.push('/login-code')}
            className="text-sm font-bold text-zana-primary py-2"
          >
            Sign in with a code instead
          </button>
          <button
            onClick={() => router.push('/forgot-password')}
            className="text-sm text-gray-500 py-1"
          >
            Forgot your password?
          </button>
        </div>
        <p className="text-center text-sm text-zana-muted mt-4">
          New to Zana?{' '}
          <Link href="/signup" className="text-zana-primary font-semibold">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
