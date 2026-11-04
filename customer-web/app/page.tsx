'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight, ArrowUpRight, Briefcase, CalendarDays, ChevronRight,
  Clock3, Home, MapPin, Navigation, Search, ShieldCheck,
  Wallet, X
} from 'lucide-react';
import { SERVICES } from '../lib/services';
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
        if (last) setRecentPlace({
          address: last.destinationAddress,
          lat: last.destinationLat,
          lng: last.destinationLng,
        });
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
    <main className="zana-home-v3 min-h-[100dvh] pb-28">
      {recoveringRide && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-white/95 px-8">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#e6f5f0] text-xl font-black text-[#008b70]">Z</div>
          <p className="text-center text-lg font-bold text-slate-900">{t('Recovering your ride…')}</p>
          <p className="mt-1 text-center text-sm text-slate-500">{t('Please wait while we reconnect you to your active trip.')}</p>
        </div>
      )}

      <header className="zana-v3-header">
        <div className="zana-v3-header-inner">
          <button onClick={() => router.push('/')} className="flex items-center gap-2.5" aria-label="Zana home">
            <span className="zana-v3-logo">Z</span>
            <span className="text-[18px] font-black tracking-[-.065em] text-slate-950">zana<span className="text-[#00A082]">.</span></span>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/wallet')} className="zana-v3-wallet" aria-label={t('Wallet')}>
              <Wallet size={16} />
              <span>{walletBalance !== null ? `${walletBalance.toLocaleString()} RWF` : '—'}</span>
            </button>
            <button onClick={() => router.push('/profile')} className="zana-v3-avatar" aria-label={t('Profile')}>
              {(user?.firstName?.[0] ?? 'U').toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <div className="zana-v3-layout">
        {loadError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>{t("Couldn't load your info. Check your connection.")}</span>
            <button onClick={loadHomeData} className="font-bold underline">{t('Retry')}</button>
          </div>
        )}

        <section className="zana-v3-intro">
          <div>
            <p className="zana-v3-greeting">{t(greeting())}{user?.firstName ? `, ${user.firstName}` : ''}</p>
            <h1>{t('Where to today?')}</h1>
            <p className="zana-v3-subtitle">{t('Move around Kigali. Send anything. Get what you need.')}</p>
          </div>
          <span className="zana-v3-city"><MapPin size={14} /> {t('Kigali, Rwanda')}</span>
        </section>

        <section className="zana-v3-booking" aria-label={t('Book a ride')}>
          <div className="zana-v3-booking-heading">
            <div>
              <span className="zana-v3-eyebrow">{t('Your next trip')}</span>
              <h2>{t('Plan your journey')}</h2>
            </div>
            <span className="zana-v3-booking-mark"><Navigation size={18} /></span>
          </div>
          <button onClick={() => router.push('/search')} className="zana-v3-destination">
            <span className="zana-v3-origin-dot" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[10px] font-bold uppercase tracking-[.11em] text-slate-400">{t('Pickup location')}</span>
              <span className="mt-0.5 block truncate text-[14px] font-semibold text-slate-800">{t('Choose pickup point')}</span>
            </span>
            <span className="zana-v3-current-label">{t('Current')}</span>
          </button>
          <div className="zana-v3-route-connector"><span /></div>
          <button onClick={() => router.push('/search')} className="zana-v3-destination zana-v3-destination-last">
            <span className="zana-v3-destination-dot" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[10px] font-bold uppercase tracking-[.11em] text-slate-400">{t('Destination')}</span>
              <span className="mt-0.5 block truncate text-[14px] font-semibold text-slate-800">{t('Where would you like to go?')}</span>
            </span>
            <span className="zana-v3-search-action"><Search size={17} /></span>
          </button>
          <div className="zana-v3-shortcuts">
            {shortcuts.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.label} onClick={() => openSavedPlace(item)} className="zana-v3-shortcut">
                  <span className="zana-v3-shortcut-icon"><Icon size={15} /></span>
                  <span className="min-w-0 text-left">
                    <span className="block text-xs font-bold text-slate-800">{t(item.label)}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                      {item.place ? item.place.address.split(',')[0] : t(item.label === 'Recent' ? 'No trips yet' : 'Add a place')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="zana-v3-map-card" aria-label={t('Explore Kigali')}>
          <div className="zana-v3-map-art" aria-hidden="true">
            <div className="zana-v3-map-block zana-v3-map-block-a" />
            <div className="zana-v3-map-block zana-v3-map-block-b" />
            <div className="zana-v3-map-block zana-v3-map-block-c" />
            <div className="zana-v3-map-road zana-v3-map-road-a" />
            <div className="zana-v3-map-road zana-v3-map-road-b" />
            <div className="zana-v3-map-road zana-v3-map-road-c" />
            <div className="zana-v3-map-route"><span /><i /><b /></div>
            <div className="zana-v3-map-marker"><MapPin size={19} fill="currentColor" /></div>
            <span className="zana-v3-map-label zana-v3-map-label-a">KIGALI</span>
            <span className="zana-v3-map-label zana-v3-map-label-b">CITY CENTRE</span>
          </div>
          <div className="zana-v3-map-copy">
            <span className="zana-v3-map-live"><span /> {t('Kigali, Rwanda')}</span>
            <h2>{t('Your city. Your journey.')}</h2>
            <p>{t('A better way to move, send and explore.')}</p>
            <button onClick={() => router.push('/search')}>{t('Explore the map')} <ArrowUpRight size={15} /></button>
          </div>
        </section>

        <section className="zana-v3-services" aria-label={t('Explore Zana services')}>
          <div className="zana-v3-services-intro">
            <div>
              <span className="zana-v3-eyebrow">{t('More than a ride')}</span>
              <h2>{t('Your everyday, all in one app.')}</h2>
              <p>{t('Move around. Send across town. Eat well. Shop with ease.')}</p>
            </div>
            <span className="zana-v3-services-count">{t('7 services')}</span>
          </div>
          <div className="zana-v3-service-groups">
            {[
              { id: 'move', title: 'Move around', description: 'Get there your way.', ids: ['moto', 'car'] },
              { id: 'send', title: 'Send & receive', description: 'Deliveries and thoughtful surprises.', ids: ['package', 'gift'] },
              { id: 'discover', title: 'Food & shopping', description: 'Meals, groceries and everyday finds.', ids: ['food', 'shop', 'market'] },
            ].map(group => (
              <div className={`zana-v3-service-group zana-v3-service-group-${group.id}`} key={group.id}>
                <div className="zana-v3-service-group-heading">
                  <span className={`zana-v3-service-group-symbol zana-v3-service-group-symbol-${group.id}`}>
                    {group.id === 'move' ? <Navigation size={18} /> : group.id === 'send' ? <ArrowUpRight size={18} /> : <Briefcase size={18} />}
                  </span>
                  <div>
                    <h3>{t(group.title)}</h3>
                    <p>{t(group.description)}</p>
                  </div>
                </div>
                <div className="zana-v3-service-group-items">
                  {group.ids.map(id => {
                    const service = SERVICES.find(item => item.id === id);
                    if (!service) return null;
                    return (
                      <button key={service.id} onClick={() => router.push(service.route)} className="zana-v3-service-option">
                        <span className="zana-v3-service-option-art" style={{ background: service.bg }}>
                          <Image src={service.image} alt="" width={42} height={42} className="object-contain" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block">{t(service.title)}</span>
                          <span className="block">{t(service.sub)}</span>
                        </span>
                        <ChevronRight size={16} className="zana-v3-service-option-arrow" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="zana-v3-delivery">
          <div className="zana-v3-delivery-copy">
            <span>{t('Zana Delivery')}</span>
            <h2>{t('Send it across the city.')}</h2>
            <p>{t('From your door to theirs. Fast, simple, reliable.')}</p>
            <button onClick={() => router.push('/deliver')}>{t('Send a package')} <ArrowRight size={15} /></button>
          </div>
          <div className="zana-v3-delivery-art">
            <Image src="/icons/package-box.png" alt={t('Package delivery')} fill className="object-contain" />
          </div>
        </section>

        <section className="zana-v3-extras">
          <button onClick={() => router.push('/schedule')} className="zana-v3-extra">
            <span className="zana-v3-extra-icon"><CalendarDays size={18} /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-bold text-slate-900">{t('Schedule a ride')}</span>
              <span className="mt-1 block text-xs text-slate-500">{t('Plan ahead and travel on your time')}</span>
            </span>
            <ChevronRight size={17} className="text-slate-300" />
          </button>
          <button onClick={() => router.push('/share-location')} className="zana-v3-extra">
            <span className="zana-v3-extra-icon zana-v3-extra-icon-yellow"><ShieldCheck size={18} /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-bold text-slate-900">{t('Share your location')}</span>
              <span className="mt-1 block text-xs text-slate-500">{t('Let someone follow your journey')}</span>
            </span>
            <ChevronRight size={17} className="text-slate-300" />
          </button>
        </section>

        <footer className="zana-v3-footer"><strong>zana.</strong><span>{t('MOVE KIGALI')}</span></footer>
      </div>

      {ridePick && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => setRidePick(null)}>
          <div className="zana-v3-ride-modal w-full max-w-md rounded-t-[26px] bg-white p-5 pb-8 sm:rounded-[26px]" role="dialog" aria-modal="true" aria-label={t('Choose a ride type')} onClick={event => event.stopPropagation()}>
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
