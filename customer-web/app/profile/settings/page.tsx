'use client';
import { useEffect, useState } from 'react';
import ThemePicker from '../../../components/ThemePicker';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, Mail, Save, Loader2 } from 'lucide-react';
import { fetchMe, ApiUser } from '../../../lib/api/auth';
import { api } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/client';

export default function AccountSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMe().then(u => {
      setUser(u);
      setFirstName(u.firstName ?? '');
      setLastName(u.lastName ?? '');
      setEmail(u.email ?? '');
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.patch('/users/me', { firstName, lastName, email });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4">
      <div className="mb-6"><ThemePicker /></div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Account Settings</h1>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Personal Info</h2>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">First Name</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
              <User size={15} className="text-gray-400" />
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className="flex-1 text-sm outline-none" placeholder="First name" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Last Name</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
              <User size={15} className="text-gray-400" />
              <input value={lastName} onChange={e => setLastName(e.target.value)} className="flex-1 text-sm outline-none" placeholder="Last name" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Phone</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50">
              <Phone size={15} className="text-gray-400" />
              <span className="text-sm text-gray-500">{user?.phone ?? '—'}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Phone number cannot be changed.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
              <Mail size={15} className="text-gray-400" />
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="flex-1 text-sm outline-none" placeholder="Email address" />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button onClick={handleSave} disabled={saving} className="w-full bg-zana-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <><Save size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
        </button>
      </div>
    </div>
  );
}
