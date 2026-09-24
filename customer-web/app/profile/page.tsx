'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Settings, ShieldCheck, FileText, CircleHelp, LogOut, ChevronRight, Globe, MapPin, Star, Check } from 'lucide-react';
import { useLang } from '../../lib/LangContext';
import { Lang, LANG_LABELS } from '../../lib/lang';
import Link from 'next/link';
import { fetchMe, ApiUser } from '../../lib/api/auth';
import { clearToken } from '../../lib/api/client';

const menuItems = [
  { icon: Settings, label: 'Account settings', href: '/profile/settings' },
  { icon: MapPin, label: 'Saved places', href: '/profile/places' },
  { icon: FileText, label: 'Ride history', href: '/history' },
  { icon: Star, label: 'Zana Points', href: '/points' },
  { icon: ShieldCheck, label: 'Safety', href: '/profile/safety' },
  { icon: CircleHelp, label: 'Help & support', href: '/profile/help' },
];

const LANGS: Lang[] = ['en', 'fr', 'rw'];

export default function ProfilePage() {
  const { lang, setLang, t } = useLang();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    fetchMe().then(setUser).catch(() => {});
  }, []);

  const handleLogout = () => {
    clearToken();
    router.replace('/login');
  };

  return (
    <div className="p-6">
      <div className="flex flex-col items-center gap-1 mb-6">
        <div className="w-16 h-16 rounded-full bg-zana-primary-light flex items-center justify-center mb-2">
          <User size={26} className="text-zana-primary" />
        </div>
        <p className="font-semibold text-gray-900">
          {user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.phone : '…'}
        </p>
        <p className="text-xs text-zana-muted">{user?.phone}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
        {menuItems.map((item, i) => (
          <Link key={i} href={item.href} className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-white rounded-xl shadow-sm">
            <item.icon size={18} className="text-gray-700" />
            <span className="flex-1 text-sm text-gray-900">{t(item.label)}</span>
            <ChevronRight size={15} className="text-zana-muted" />
          </Link>
        ))}
        <button
          onClick={() => setShowLangPicker(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        >
          <Globe size={18} className="text-gray-700" />
          <span className="flex-1 text-sm text-gray-900">{t('Language')}</span>
          <span className="text-xs text-zana-muted">{LANG_LABELS[lang]}</span>
          <ChevronRight size={15} className="text-zana-muted" />
        </button>
      </div>

      {showLangPicker && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowLangPicker(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl p-2 pb-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto my-3" />
            {LANGS.map(l => (
              <button
                key={l}
                onClick={() => { setLang(l); setShowLangPicker(false); }}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left rounded-xl active:bg-gray-50"
              >
                <span className={`text-sm ${lang === l ? 'font-bold text-zana-primary' : 'text-gray-900'}`}>
                  {LANG_LABELS[l]}
                </span>
                {lang === l && <Check size={16} className="text-zana-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 bg-white rounded-2xl shadow-sm px-4 py-3.5 mt-4 text-zana-error"
      >
        <LogOut size={18} />
        <span className="text-sm font-medium">{t('Log out')}</span>
      </button>
    </div>
  );
}
