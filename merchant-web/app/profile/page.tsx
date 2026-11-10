'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, LogOut, Mail, Phone, ShieldCheck, UserRound, Loader2 } from 'lucide-react';
import { api, clearToken } from '../../lib/api/client';
import { fetchMyMerchant } from '../../lib/api/merchant';
import Topbar from '../../components/Topbar';

type AccountUser = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const account = await api.get<AccountUser>('/users/me');
        if (!active) return;
        setUser(account);
        if (account.role === 'MERCHANT') {
          const business = await fetchMyMerchant();
          if (active) setMerchant(business);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load your profile.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const signOut = () => {
    clearToken();
    router.replace('/login');
    router.refresh();
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account holder';

  return (
    <div>
      <Topbar title="Profile" subtitle="Your account and business details" />
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" /> Loading profile…</div>
      ) : (
        <>
          {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zana-primary-light text-zana-primary"><UserRound size={22} /></div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-gray-900">{fullName}</h2>
                <p className="mt-0.5 text-xs text-gray-500">{user?.role === 'AGENT' ? 'Zana market agent' : 'Zana merchant account'}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-3 text-sm"><Phone size={16} className="text-gray-400" /><span className="text-gray-700">{user?.phone || 'No phone number on file'}</span></div>
              {user?.email && <div className="flex items-center gap-3 text-sm"><Mail size={16} className="text-gray-400" /><span className="break-all text-gray-700">{user.email}</span></div>}
            </div>
          </section>

          {merchant && (
            <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Building2 size={18} className="text-zana-primary" /><h2 className="text-sm font-bold text-gray-900">Business details</h2></div>
              <p className="mt-3 text-lg font-bold text-gray-900">{merchant.businessName || 'Your business'}</p>
              {merchant.branch && <p className="mt-1 text-sm text-gray-500">{merchant.branch}</p>}
              <div className="mt-4 flex items-center gap-2">
                <ShieldCheck size={17} className={merchant.status === 'APPROVED' ? 'text-emerald-600' : 'text-amber-600'} />
                <span className="text-xs font-bold text-gray-700">Account status: {String(merchant.status || 'UNDER REVIEW').replaceAll('_', ' ')}</span>
              </div>
              {merchant.status === 'PENDING' && <p className="mt-2 text-xs leading-5 text-gray-500">We’re verifying your business. Verification usually takes 24–48 hours.</p>}
            </section>
          )}

          <section className="mt-4 rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><LogOut size={18} /></div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-gray-900">Sign out</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">Sign out of this Zana Business account on this device.</p>
                <button type="button" onClick={signOut} className="mt-3 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700">Sign out</button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
