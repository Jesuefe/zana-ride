'use client';

import { useEffect, useState } from 'react';
import { SERVICES } from '../lib/services';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight, ArrowUpRight, Briefcase, CalendarDays, ChevronRight,
  Clock3, Home, MapPin, Search, ShieldCheck, Wallet, X
} from 'lucide-react';
import { fetchMe, ApiUser } from '../lib/api/auth';
import { fetchWallet, recoverActiveRide } from '../lib/api/trips';
import { haptic } from '../lib/haptics';
import { api } from '../lib/api/client';
import { useLang } from '../lib/LangContext';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useLang();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [recentPlace, setRecentPlace] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [ridePick, setRidePick] = useState<{ label: string; address: string; lat: number; lng: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [recoveringRide, setRecoveringRide] = useState(false);

  const loadHomeData = () => {
    setLoadError(false);
    let failures = 0;
    const noteFailure = () => { failures += 1; if (failures === 4) setLoadError(true); };

    fetchMe().then(setUser).catch(noteFailure);
    fetchWallet().then((wallet: any) => setWalletBalance(wallet.balance)).catch(noteFailure);
    api.get<any[]>('/users/saved-places')
      .then(list => setSavedPlaces(Array.isArray(list) ? list : []))
      .catch(noteFailure);
    api.get<any[]>('/rides/history')
      .then(trips => {
        const last = Array.isArray(trips) ? trips.find(trip => trip?.destinationAddress) : null;
        if (last) {
          setRecentPlace({
            address: last.destinationAddress,
            lat: last.destinationLat,
            lng: last.destinationLng,
          });
        }
      })
      .catch(noteFailure);
  };

  useEffect(() => {
    let cancelled = false;
    const recover = async () => {
      try {
        setRecoveringRide(true);
        const activeRide = await recoverActiveRide();
        if (cancelled || !activeRide) return;
        haptic('success');
        router.replace(activeRide.groupId
          ? `/tracking?groupId=${encodeURIComponent(activeRide.groupId)}`
          : `/tracking?tripId=${encodeURIComponent(activeRide.id)}`);
      } catch {
        // A temporary connection failure should not block the home screen.
      } finally {
        if (!cancelled) setRecoveringRide(false);
      }
    };

    loadHomeData();
    recover();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savedHome = savedPlaces.find(place => (place?.label ?? '').toLowerCase() === 'home');
  const savedWork = savedPlaces.find(place => (place?.label ?? '').toLowerCase() === 'work');
  const shortcuts = [
    { label: 'Home', icon: Home, place: savedHome ? { label: 'Home', address: savedHome.address, lat: savedHome.lat, lng: savedHome.lng } : null },
    { label: 'Work', icon: Briefcase, place: savedWork ? { label: 'Work', address: savedWork.address, lat: savedWork.lat, lng: savedWork.lng } : null },
    { label: 'Recent', icon: Clock3, place: recentPlace ? { label: 'Recent', address: recentPlace.address, lat: recentPlace.lat, lng: recentPlace.lng } : null },
  ];

  const openSavedPlace = (item: typeof shortcuts[number]) => {
    if (item.place) setRidePick(item.place);
    else router.push('/profile/places');
  };

  const goToRide = (service: 'BIKE' | 'CAR') => {
    if (!ridePick) return;
    const params = new URLSearchParams({
      destLat: String(ridePick.lat),
      destLng: String(ridePick.lng),
      destAddress: ridePick.address,
    });
    if (service === 'BIKE') params.set('service', 'BIKE');
    router.push(service === 'BIKE' ? `/search?${params.toString()}` : `/ride-options?${params.toString()}`);
  };

  return (
    <main className="zana-home-v2 min-h-[100dvh] pb-28">
      {recoveringRide && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-white/95 px-8">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#e6f5f0] text-2xl font-black text-[#008b70]">Z</div>
          <p className="text-center text-lg font-bold text-slate-900">{t('Recovering your ride…')}</p>
          <p className="mt-1 text-center text-sm text-slate-500">{t('Please wait while we reconnect you to your active trip.')}</p>
        </div>
      )}

      <header className="zana-v2-header">
        <div className="zana-v2-header-inner">
          <button onClick={() => router.push('/')} className="flex items-center gap-2.5" aria-label="Zana home">
            <span className="zana-v2-logo">Z</span>
            <span className="text-[17px] font-black tracking-[-0.06em] text-slate-950">zana<span className="text-[#00A082]">.</span></span>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/wallet')} className="zana-v2-wallet" aria-label={t('Wallet')}>
              <Wallet size={16} />
              <span>{walletBalance !== null ? `${walletBalance.toLocaleString()} RWF` : '—'}</span>
            </button>
            <button onClick={() => router.push('/profile')} className="zana-v2-avatar" aria-label={t('Profile')}>
              {(user?.firstName?.[0] ?? 'U').toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <div className="zana-v2-container">
        {loadError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>{t("Couldn't load your info. Check your connection.")}</span>
            <button onClick={loadHomeData} className="font-bold underline">{t('Retry')}</button>
          </div>
        )}

        <section className="zana-v2-hero">
          <div className="zana-v2-hero-copy">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-white/65">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ffc244]" />
              {t('Kigali, Rwanda')}
            </div>
            <p className="text-sm font-medium text-white/70">{t(greeting())}{user?.firstName ? `, ${user.firstName}` : ''}</p>
            <h1>{t('Where would you like to go?')}</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/70">{t('Your city, connected. Get there, send something, or get what you need.')}</p>
          </div>
          <div className="zana-v2-hero-mark" aria-hidden="true">
            <div className="zana-v2-orbit zana-v2-orbit-one" />
            <div className="zana-v2-orbit zana-v2-orbit-two" />
            <div className="zana-v2-route-line" />
            <div className="zana-v2-map-pin"><MapPin size={25} fill="currentColor" /></div>
            <span className="zana-v2-map-dot zana-v2-dot-a" />
            <span className="zana-v2-map-dot zana-v2-dot-b" />
          </div>
        </section>

        <section className="zana-v2-search-section" aria-label={t('Book a ride')}>
          <button onClick={() => router.push('/search')} className="zana-v2-search">
            <span className="zana-v2-search-icon"><Search size={19} /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{t('Plan your journey')}</span>
              <span className="mt-0.5 block truncate text-[15px] font-semibold text-slate-800">{t('Enter destination')}</span>
            </span>
            <span className="zana-v2-search-arrow"><ArrowUpRight size={18} /></span>
          </button>
          <div className="zana-v2-quick-row">
            {shortcuts.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.label} onClick={() => openSavedPlace(item)} className="zana-v2-quick-place">
                  <span className="zana-v2-quick-icon"><Icon size={15} /></span>
                  <span className="min-w-0 text-left">
                    <span className="block text-xs font-bold text-slate-800">{t(item.label)}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                      {item.place ? item.place.address.split(',')[0] : t(item.label === 'Recent' ? 'No trips yet' : 'Add a place')}
                    </span>
                  </span>
                  <ChevronRight size={13} className="ml-auto shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>
        </section>

        <section className="zana-v2-services-section">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="zana-v2-eyebrow">{t('Everything in one place')}</p>
              <h2>{t('Explore Zana')}</h2>
            </div>
            <span className="text-xs font-medium text-slate-400">{t('4 services')}</span>
          </div>
          <div className="zana-v2-services-grid">
            {SERVICES.map((service, index) => (
              <button key={service.id} onClick={() => router.push(service.route)} className={`zana-v2-service-card zana-v2-service-${index}`}>
                <span className="zana-v2-service-art" style={{ background: service.bg }}>
                  <Image src={service.image} alt={t(service.title)} width={52} height={52} className="object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-extrabold text-slate-900">{t(service.title)}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">{t(service.sub)}</span>
                </span>
                <ArrowUpRight size={16} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </section>

        <section className="zana-v2-promo">
          <div className="relative z-[1] max-w-[62%]">
            <span className="zana-v2-promo-label">{t('Zana Delivery')}</span>
            <h2>{t('Send it across the city.')}</h2>
            <p>{t('Packages picked up and delivered with care.')}</p>
            <button onClick={() => router.push('/deliver')} className="zana-v2-promo-button">
              {t('Send a package')} <ArrowRight size={15} />
            </button>
          </div>
          <div className="zana-v2-promo-art">
            <Image src="/icons/package-box.png" alt={t('Package delivery')} fill className="object-contain" />
          </div>
        </section>

        <section className="zana-v2-bottom-grid">
          <button onClick={() => router.push('/schedule')} className="zana-v2-feature-row">
            <span className="zana-v2-feature-icon"><CalendarDays size={19} /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-bold text-slate-900">{t('Schedule a ride')}</span>
              <span className="mt-1 block text-xs text-slate-500">{t('Plan ahead and travel on your time')}</span>
            </span>
            <ChevronRight size={17} className="text-slate-300" />
          </button>
          <button onClick={() => router.push('/share-location')} className="zana-v2-feature-row">
            <span className="zana-v2-feature-icon zana-v2-feature-icon-yellow"><ShieldCheck size={19} /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-bold text-slate-900">{t('Share your location')}</span>
              <span className="mt-1 block text-xs text-slate-500">{t('Let someone follow your journey')}</span>
            </span>
            <ChevronRight size={17} className="text-slate-300" />
          </button>
        </section>

        <footer className="zana-v2-footer">
          <span className="font-extrabold tracking-[-.04em] text-slate-400">zana.</span>
          <span>{t('MOVE KIGALI')}</span>
        </footer>
      </div>

      {ridePick && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => setRidePick(null)}>
          <div className="zana-v2-ride-modal w-full max-w-md rounded-t-[28px] bg-white p-5 pb-8 sm:rounded-[28px]" role="dialog" aria-modal="true" aria-label={t('Choose a ride type')} onClick={event => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">{t('Going to')} {t(ridePick.label)}</span>
              <button onClick={() => setRidePick(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500" aria-label={t('Close')}><X size={17} /></button>
            </div>
            <h2 className="mb-5 text-xl font-extrabold tracking-tight text-slate-950">{ridePick.address}</h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => goToRide('BIKE')} className="flex flex-col items-center gap-2 rounded-2xl border border-[#f0dfb5] bg-[#fff9eb] px-4 py-5 transition-transform active:scale-[.98]">
                <Image src="/icons/motorbike.png" alt={t('Moto')} width={48} height={48} className="object-contain" />
                <span className="text-sm font-extrabold text-slate-900">{t('Moto')}</span>
                <span className="text-[11px] text-slate-500">{t('Fast & affordable')}</span>
              </button>
              <button onClick={() => goToRide('CAR')} className="flex flex-col items-center gap-2 rounded-2xl border border-[#d8eee7] bg-[#f1faf7] px-4 py-5 transition-transform active:scale-[.98]">
                <Image src="/icons/car.png" alt={t('Car')} width={48} height={48} className="object-contain" />
                <span className="text-sm font-extrabold text-slate-900">{t('Car')}</span>
                <span className="text-[11px] text-slate-500">{t('Comfortable')}</span>
              </button>
            </div>
            <button onClick={() => { setRidePick(null); router.push('/profile/places'); }} className="mt-5 w-full py-2 text-center text-xs font-semibold text-slate-500">{t('Edit saved places')}</button>
          </div>
        </div>
      )}
    </main>
  );
}
