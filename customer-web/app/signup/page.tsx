'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { register } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    firstName.trim() &&
    lastName.trim() &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.replace(/\D/g, '').length >= 9 &&
    password.length >= 6;

  const handleSignup = async () => {
    setLoading(true);
    setError(null);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: `+250${phone.replace(/\D/g, '')}`,
        password,
      });
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 animate-fade-in">
      <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <ArrowLeft size={16} />
      </button>

      <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
      <p className="text-sm text-zana-muted mt-1">Just the basics to get you moving.</p>

      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="border border-zana-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            autoFocus
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="border border-zana-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
          />
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email address"
          className="w-full border border-zana-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
        />
        <div className="flex gap-2">
          <div className="border border-zana-border rounded-lg px-3 flex items-center text-sm">RW +250</div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="788 123 456"
            inputMode="numeric"
            className="flex-1 border border-zana-border rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
          />
        </div>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password (min. 6 characters)"
          className="w-full border border-zana-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
          onKeyDown={(e) => e.key === 'Enter' && valid && handleSignup()}
        />
      </div>

      {error && <p className="text-xs text-zana-error mt-3">{error}</p>}

      <button
        disabled={!valid || loading}
        onClick={handleSignup}
        className="w-full mt-6 bg-zana-primary text-white font-semibold py-3 rounded-lg disabled:opacity-40 hover:bg-zana-primary-dark transition-colors active:scale-[0.98]"
      >
        {loading ? 'Creating account…' : 'Create Account'}
      </button>

      <p className="text-center text-sm text-zana-muted mt-4">
        Already have an account?{' '}
        <Link href="/login" className="text-zana-primary font-semibold">
          Log in
        </Link>
      </p>
    </div>
  );
}
