'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Phone, AlertTriangle, UserRound, Plus, Trash2, CheckCircle2, MapPin, Clock3 } from 'lucide-react';
import { useLang } from '../../../lib/LangContext';

type EmergencyContact = { name: string; phone: string };

const STORAGE_KEY = 'zana_emergency_contact';

export default function SafetyPage() {
  const { t } = useLang();
  const router = useRouter();
  const [contact, setContact] = useState<EmergencyContact | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as EmergencyContact;
        setContact(parsed);
        setName(parsed.name);
        setPhone(parsed.phone);
      }
    } catch {}
  }, []);

  const saveContact = () => {
    const next = { name: name.trim(), phone: phone.trim() };
    if (!next.name || !next.phone) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setContact(next);
    setEditing(false);
  };

  const removeContact = () => {
    localStorage.removeItem(STORAGE_KEY);
    setContact(null);
    setName('');
    setPhone('');
    setEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="px-4 pt-4">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
      </div>

      <div className="px-4 pt-5 pb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-zana-primary">{t('Safety')}</p>
        <h1 className="text-2xl font-black text-gray-900 mt-1">{t('Stay safer with ZANA')}</h1>
        <p className="text-sm text-gray-500 mt-2">{t('Add someone you trust. If you trigger SOS, ZANA can send them an emergency alert with your time and location.')}</p>
      </div>

      <div className="px-4 space-y-4">
        <div className="rounded-3xl bg-zana-primary p-5 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
                <Shield size={23} />
              </div>
              <p className="text-lg font-extrabold">{t('Emergency Contact')}</p>
              <p className="text-sm text-white/75 mt-1">{t('Your trusted contact receives the SOS alert when the feature is activated.')}</p>
            </div>
            <CheckCircle2 size={22} className="text-white/90" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center">
                <UserRound size={19} className="text-gray-700" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{t('Trusted contact')}</h2>
                <p className="text-xs text-gray-500">{contact ? t('Ready for SOS alerts') : t('No contact added yet')}</p>
              </div>
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-sm font-bold text-zana-primary">
                {contact ? t('Edit') : t('Add')}
              </button>
            )}
          </div>

          {contact && !editing && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="font-bold text-gray-900">{contact.name}</p>
              <p className="text-sm text-gray-500 mt-1">{contact.phone}</p>
              <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                <CheckCircle2 size={14} className="text-zana-primary" />
                {t('Emergency SMS will be sent when SOS is triggered')}
              </div>
              <button onClick={removeContact} className="mt-4 flex items-center gap-2 text-xs font-bold text-red-600">
                <Trash2 size={14} /> {t('Remove contact')}
              </button>
            </div>
          )}

          {!contact && !editing && (
            <button onClick={() => setEditing(true)} className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-6 flex flex-col items-center justify-center gap-2 text-gray-500">
              <Plus size={20} />
              <span className="text-sm font-semibold">{t('Add emergency contact')}</span>
            </button>
          )}

          {editing && (
            <div className="space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Contact name')} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-zana-primary" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('Phone number')} inputMode="tel" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-zana-primary" />
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditing(false)} className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700">{t('Cancel')}</button>
                <button onClick={saveContact} disabled={!name.trim() || !phone.trim()} className="flex-1 rounded-2xl bg-zana-primary py-3 text-sm font-bold text-white disabled:opacity-40">{t('Save contact')}</button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={20} className="text-red-500" />
            <h2 className="font-bold text-gray-900">{t('What happens when you trigger SOS?')}</h2>
          </div>
          <div className="space-y-4">
            <div className="flex gap-3"><Clock3 size={17} className="text-gray-400 mt-0.5" /><p className="text-sm text-gray-600">{t('ZANA captures the exact date and time.')}</p></div>
            <div className="flex gap-3"><MapPin size={17} className="text-gray-400 mt-0.5" /><p className="text-sm text-gray-600">{t('ZANA captures and sends your current location.')}</p></div>
            <div className="flex gap-3"><Phone size={17} className="text-gray-400 mt-0.5" /><p className="text-sm text-gray-600">{t('Your emergency contact can receive an SMS alert.')}</p></div>
          </div>
        </div>

        <a href="tel:112" className="flex items-center justify-center gap-2 bg-red-50 text-red-600 font-bold px-4 py-4 rounded-2xl text-sm">
          <Phone size={17} /> {t('Call Emergency (112)')}
        </a>
      </div>
    </div>
  );
}
