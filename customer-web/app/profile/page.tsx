'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2, ShieldCheck, CircleHelp, LogOut, ChevronRight, Globe2,
  MapPin, Star, Check, Wallet, Package, Clock3, X, Sparkles,
  CreditCard, ArrowUpRight,
} from 'lucide-react';
import { useLang } from '../../lib/LangContext';
import { Lang, LANG_LABELS } from '../../lib/lang';
import Link from 'next/link';
import { fetchMe, ApiUser } from '../../lib/api/auth';
import { clearToken } from '../../lib/api/client';

const LANGS: Lang[] = ['en', 'fr', 'rw'];

const accountItems = [
  { icon: Settings2, label: 'Account settings', href: '/profile/settings', detail: 'Manage your personal details' },
  { icon: MapPin, label: 'Saved places', href: '/profile/places', detail: 'Home, work and favourite places' },
  { icon: CreditCard, label: 'Payment methods', href: '/wallet', detail: 'Wallet and payment options' },
];

const serviceItems = [
  { icon: Clock3, label: 'Ride history', href: '/history', detail: 'Your previous journeys' },
  { icon: Package, label: 'Orders', href: '/orders', detail: 'Deliveries and shopping orders' },
  { icon: Star, label: 'Zana Points', href: '/points', detail: 'Your rewards and benefits' },
];

const supportItems = [
  { icon: ShieldCheck, label: 'Safety', href: '/profile/safety', detail: 'Your safety tools and preferences' },
  { icon: CircleHelp, label: 'Help & support', href: '/profile/help', detail: 'We are here when you need us' },
];

export default function ProfilePage() {
  const { lang, setLang, t } = useLang();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetchMe().then((value) => { if (active) setUser(value); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const displayName = useMemo(() => {
    const name = (user?.firstName ?? '') + ' ' + (user?.lastName ?? '');
    return name.trim() || user?.phone || t('Your Zana account');
  }, [user, t]);

  const initials = useMemo(() => {
    const parts = ((user?.firstName ?? '') + ' ' + (user?.lastName ?? '')).trim().split(/\s+/).filter(Boolean);
    if (parts.length) return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    return user?.phone?.slice(-2) ?? 'Z';
  }, [user]);

  const handleLogout = () => {
    setLoggingOut(true);
    clearToken();
    router.replace('/login');
  };

  const renderSection = (title: string, items: typeof accountItems) => (
    <section className="zana-profile-section">
      <h2 className="zana-profile-section-title">{t(title)}</h2>
      <div className="zana-profile-list">
        {items.map(({ icon: Icon, label, href, detail }) => (
          <Link key={label} href={href} className="zana-profile-row group">
            <span className="zana-profile-row-icon"><Icon size={19} strokeWidth={1.8} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold">{t(label)}</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-[var(--zana-muted)]">{t(detail)}</span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-[var(--zana-muted)] transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <div className="zana-profile-premium zana-page-enter min-h-screen pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
      <header className="zana-profile-cover">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/65">ZANA</p>
            <h1 className="mt-1 text-[25px] font-black tracking-tight text-white">{t('Profile')}</h1>
          </div>
          <Link href="/profile/settings" aria-label={t('Account settings')} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/20">
            <Settings2 size={19} />
          </Link>
        </div>

        <div className="mx-auto mt-7 flex w-full max-w-3xl items-center gap-4 px-5 pb-8">
          <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-[26px] border border-white/25 bg-white/15 text-[23px] font-black tracking-wide text-white shadow-[0_12px_35px_rgba(0,0,0,.18)] backdrop-blur-xl">
            {initials}
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-[3px] border-[#006d58] bg-[#FFC244] text-[#173c32]">
              <Check size={12} strokeWidth={3} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-extrabold tracking-tight text-white">{user ? displayName : '…'}</p>
            <p className="mt-1 truncate text-xs font-medium text-white/70">{user?.phone || t('Your Zana account')}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/90">
              <Sparkles size={11} className="text-[#FFC244]" /> {t('Your account')}
            </div>
          </div>
          <Link href="/profile/settings" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-[11px] font-extrabold text-[#006d58] shadow-sm">
            {t('Edit')} <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      <main className="mx-auto -mt-1 w-full max-w-3xl space-y-6 px-4 pt-5 sm:px-5">
        <section className="grid grid-cols-3 gap-2.5">
          <Link href="/wallet" className="zana-profile-shortcut group">
            <span className="zana-profile-shortcut-icon bg-[#E5F6F1] text-[#00866E]"><Wallet size={20} /></span>
            <span className="mt-3 block text-[12px] font-extrabold">{t('Wallet')}</span>
            <span className="mt-0.5 block text-[10px] text-[var(--zana-muted)]">{t('Balance & payments')}</span>
          </Link>
          <Link href="/orders" className="zana-profile-shortcut group">
            <span className="zana-profile-shortcut-icon bg-[#FFF4D9] text-[#A66B00]"><Package size={20} /></span>
            <span className="mt-3 block text-[12px] font-extrabold">{t('Orders')}</span>
            <span className="mt-0.5 block text-[10px] text-[var(--zana-muted)]">{t('Track your items')}</span>
          </Link>
          <Link href="/points" className="zana-profile-shortcut group">
            <span className="zana-profile-shortcut-icon bg-[#F0EAFE] text-[#7650C8]"><Star size={20} /></span>
            <span className="mt-3 block text-[12px] font-extrabold">{t('Rewards')}</span>
            <span className="mt-0.5 block text-[10px] text-[var(--zana-muted)]">{t('Zana Points')}</span>
          </Link>
        </section>

        {renderSection('Account', accountItems)}
        {renderSection('Your activity', serviceItems)}
        {renderSection('Support & safety', supportItems)}

        <section className="zana-profile-section">
          <h2 className="zana-profile-section-title">{t('Preferences')}</h2>
          <button type="button" onClick={() => setShowLangPicker(true)} className="zana-profile-row w-full text-left">
            <span className="zana-profile-row-icon"><Globe2 size={19} strokeWidth={1.8} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold">{t('Language')}</span>
              <span className="mt-0.5 block text-[11px] text-[var(--zana-muted)]">{t('Choose your preferred language')}</span>
            </span>
            <span className="mr-1 text-[11px] font-bold text-[var(--zana-primary)]">{LANG_LABELS[lang]}</span>
            <ChevronRight size={17} className="text-[var(--zana-muted)]" />
          </button>
        </section>

        <button type="button" onClick={handleLogout} disabled={loggingOut} className="zana-profile-logout">
          <LogOut size={17} />
          <span>{loggingOut ? t('Logging out…') : t('Log out')}</span>
        </button>
        <p className="pb-2 text-center text-[10px] font-semibold tracking-[.12em] text-[var(--zana-muted)]">ZANA · MOVE KIGALI</p>
      </main>

      {showLangPicker && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-5" onClick={() => setShowLangPicker(false)}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" />
          <div className="zana-profile-language-sheet relative w-full max-w-md rounded-t-[28px] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--zana-primary)]">ZANA</p>
                <h2 className="mt-1 text-lg font-extrabold">{t('Choose language')}</h2>
              </div>
              <button type="button" onClick={() => setShowLangPicker(false)} aria-label={t('Close')} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--background)] text-[var(--foreground)]">
                <X size={17} />
              </button>
            </div>
            <div className="space-y-2">
              {LANGS.map((language) => (
                <button key={language} type="button" onClick={() => { setLang(language); setShowLangPicker(false); }}
                  className={'flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ' + (lang === language ? 'border-[var(--zana-primary)] bg-[var(--zana-primary-light)]' : 'border-[var(--zana-border)] bg-[var(--zana-surface)]')}>
                  <span className="text-sm font-bold">{LANG_LABELS[language]}</span>
                  {lang === language ? <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--zana-primary)] text-white"><Check size={14} strokeWidth={3} /></span> : <span className="h-6 w-6 rounded-full border border-[var(--zana-border)]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
