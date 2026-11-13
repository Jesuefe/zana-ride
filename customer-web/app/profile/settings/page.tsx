'use client';
import { useEffect, useState } from 'react';
import { useLang } from '../../../lib/LangContext';
import ThemePicker from '../../../components/ThemePicker';
import LanguageSelector from '../../../components/LanguageSelector';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, Mail, Save, Loader2 } from 'lucide-react';
import { fetchMe, ApiUser } from '../../../lib/api/auth';
import { api, clearToken } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/client';

export default function AccountSettingsPage() {
  const { t } = useLang();
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      setError(err instanceof ApiError ? err.message : t('Could not save changes.'));
    } finally { setSaving(false); }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true); setDeleteError('');
    try {
      await api.delete('/users/me');
      clearToken();
      router.replace('/login');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t('Could not delete your account. Please contact support.'));
      setDeleting(false);
    }
  };

  return (
    <div className="zana-page-enter zana-settings-page p-4">
      <div className="mb-6"><ThemePicker /></div>
      <div className="mb-6">
        <label className="text-xs font-medium text-gray-500 block mb-2">{t("Language")}</label>
        <LanguageSelector variant="light" />
      </div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">{t('Account Settings')}</h1>
      </div>

      <div className="space-y-4">
        <button onClick={() => router.push('/change-password')} className="w-full rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-sm"><span className="block text-sm font-semibold text-gray-900">Change password</span><span className="mt-1 block text-xs text-gray-500">Update your account sign-in password</span></button>
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">{t('Personal Info')}</h2>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('First Name')}</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
              <User size={15} className="text-gray-400" />
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className="flex-1 text-sm outline-none" placeholder={t("First name")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('Last Name')}</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
              <User size={15} className="text-gray-400" />
              <input value={lastName} onChange={e => setLastName(e.target.value)} className="flex-1 text-sm outline-none" placeholder={t("Last name")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('Phone')}</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50">
              <Phone size={15} className="text-gray-400" />
              <span className="text-sm text-gray-500">{user?.phone ?? '—'}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{t('Phone number cannot be changed.')}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('Email')}</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
              <Mail size={15} className="text-gray-400" />
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="flex-1 text-sm outline-none" placeholder={t("Email address")} />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button onClick={handleSave} disabled={saving} className="w-full bg-zana-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <><Save size={16} /> {t('Saved!')}</> : <><Save size={16} /> {t('Save Changes')}</>}
        </button>

        <div className="mt-6 rounded-2xl border border-red-200 bg-white p-4">
          <h2 className="text-sm font-bold text-red-600">{t('Delete account')}</h2>
          <p className="mt-1 text-xs text-gray-500">{t('Permanently removes your personal details and signs you out. Ride and payment records are kept only as required by law. This cannot be undone.')}</p>
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="mt-3 w-full rounded-xl border border-red-300 py-3 text-sm font-semibold text-red-600">{t('Delete my account')}</button>
          ) : (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700">{t('Cancel')}</button>
              <button type="button" onClick={handleDeleteAccount} disabled={deleting} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-40">{deleting ? t('Deleting…') : t('Yes, delete')}</button>
            </div>
          )}
          {deleteError && <p className="mt-2 text-xs text-red-600">{deleteError}</p>}
        </div>
      </div>
    </div>
  );
}
