'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

export default function OnboardingPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Create your profile</h1>
      <p className="text-sm text-zana-muted mt-1">Just the basics for now.</p>

      <div className="mt-6 space-y-3">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="w-full border border-zana-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
          autoFocus
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="w-full border border-zana-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
        />
      </div>

      {error && <p className="text-xs text-zana-error mt-3">{error}</p>}

      <button
        disabled={!firstName.trim() || !lastName.trim() || saving}
        onClick={handleContinue}
        className="w-full mt-6 bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-40 hover:bg-zana-primary-dark transition-colors"
      >
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
