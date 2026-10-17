'use client';

import { useEffect, useState } from 'react';
import { SERVICES } from '../lib/services';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Clock, Home, Briefcase, ChevronRight, Search, MapPin, Calendar, Package, Wallet } from 'lucide-react';
import { fetchMe, ApiUser } from '../lib/api/auth';
import { fetchWallet, recoverActiveRide } from '../lib/api/trips';
import { haptic } from '../lib/haptics';
import { api } from '../lib/api/client';
import { useLang } from '../lib/LangContext';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
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
    fetchWallet().then((w: any) => setWalletBalance(w.balance)).catch(noteFailure);

    // Saved Home / Work
    api.get<any[]>('/users/saved-places')
      .then(list => setSavedPlaces(Array.isArray(list) ? list : []))
      .catch(noteFailure);

    // Most recent place the customer actually travelled to
    api.get<any[]>('/rides/history')
      .then(trips => {
        const last = Array.isArray(trips) ? trips.find(t => t?.destinationAddress) : null;
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

  // Previously every one of these silently swallowed its own failure —
  // on a slow or flaky connection, this being the very first screen a
  // customer sees, the whole page would just quietly show "Welcome"
  // with no name, a blank wallet, and empty everything, with no way to
  // tell that from a genuinely new, empty account, and no way to retry
  // short of reloading the entire app. Only surfaces something when
  // every single call fails, not one flaky field — that's the actual
  // signal of a real connectivity problem, not just normal empty data.
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
        // Offline/temporary failure: stay on home and allow the next app
        // lifecycle or retry to recover from the server.
      } finally {
        if (!cancelled) setRecoveringRide(false);
      }
    };

    loadHomeData();
    recover();
    return () => { cancelled = true; };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="zana-home zana-page-enter min-h-[100dvh] pb-28 overflow-x-hidden">
      {recoveringRide && (
        <div className="fixed inset-0 z-[80] bg-white/95 flex flex-col items-center justify-center px-8">
          <div className="w-16 h-16 rounded-full bg-zana-primary-light flex items-center justify-center mb-4 animate-pulse">
            <span className="text-xl font-extrabold text-zana-primary">Z</span>
          </div>
          <p className="text-lg font-black text-gray-900 text-center">Recovering your ride…</p>
          <p className="text-sm text-gray-500 text-center mt-1">Please wait while we reconnect you to your active trip.</p>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────── */}
      <div className="zana-home-top px-5 pt-8 pb-5">
        <div className="flex items-start justify-between gap-3 max-[399px]:flex-col">
          <div>
            <div className="mb-2 flex items-center gap-2"><span className="zana-brand-mark">Z</span><span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/75">ZANA · MOVE KIGALI</span></div><p className="text-white/70 text-sm">{t(greeting())}</p>
            <h1 className="text-3xl font-black tracking-tight text-white mt-0.5">
              {user?.firstName ?? t('Welcome')}
            </h1>
            <div className="flex items-center gap-1.5 mt-2 text-white/75">
              <MapPin size={12} className="text-zana-primary" />
              <p className="text-xs font-medium text-white/75">{t('Kigali, Rwanda')}</p>
            </div>
          </div>

          {/* Wallet pill */}
          <button
            onClick={() => router.push('/wallet')}
            className="zana-wallet-chip flex min-w-0 shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 max-[399px]:w-full max-[399px]:justify-between"
          >
            <div className="w-7 h-7 rounded-xl bg-zana-primary-light flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="15" rx="3" stroke="#00A082" strokeWidth="2"/>
                <path d="M16 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" fill="#00A082"/>
                <path d="M2 9h20" stroke="#00A082" strokeWidth="2"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">
              {walletBalance !== null ? `${walletBalance.toLocaleString()} RWF` : '—'}
            </span>
            <ChevronRight size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mx-4 mb-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-800">{t("Couldn't load your info. Check your connection.")}</p>
          <button onClick={loadHomeData} className="text-xs font-bold text-amber-800 shrink-0">{t('Retry')}</button>
        </div>
      )}

      {/* ── Where to card ───────────────────────────────── */}
      <div className="zana-destination-wrap px-4 mt-2">
        <div className="zana-destination-card rounded-[28px] border p-5">
          <h2 className="text-2xl font-black tracking-tight text-gray-950 mb-4">{t('Where to?')}</h2>

          {/* Search bar */}
          <button
            onClick={() => router.push('/search')}
            className="zana-search-trigger w-full flex items-center gap-3 rounded-2xl px-3 py-3.5 mb-3"
          >
            <Search size={18} className="text-gray-400 shrink-0" />
            <span className="text-gray-400 text-sm flex-1 text-left">{t('Search destination')}</span>
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
              <Clock size={15} className="text-gray-400" />
            </div>
          </button>

          {/* Quick places — tap a saved place to pick a ride type */}
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              const findSaved = (name: string) =>
                savedPlaces.find(p => (p?.label ?? '').toLowerCase() === name);
              const home = findSaved('home');
              const work = findSaved('work');

              const tiles = [
                {
                  key: 'Home',
                  icon: <Home size={14} />,
                  place: home
                    ? { label: 'Home', address: home.address, lat: home.lat, lng: home.lng }
                    : null,
                },
                {
                  key: 'Work',
                  icon: <Briefcase size={14} />,
                  place: work
                    ? { label: 'Work', address: work.address, lat: work.lat, lng: work.lng }
                    : null,
                },
                {
                  key: 'Recent',
                  icon: <Clock size={14} />,
                  place: recentPlace
                    ? { label: 'Recent', address: recentPlace.address, lat: recentPlace.lat, lng: recentPlace.lng }
                    : null,
                },
              ];

              return tiles.map(tile => (
                <button
                  key={tile.key}
                  onClick={() => {
                    if (tile.place) setRidePick(tile.place);
                    else router.push('/profile/places');
                  }}
                  className="zana-place-chip flex flex-col items-start gap-1.5 rounded-2xl px-3 py-3 text-left active:scale-95 transition-transform"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm ${
                    tile.place ? 'bg-zana-primary-light text-zana-primary' : 'bg-white text-gray-400'
                  }`}>
                    {tile.icon}
                  </div>
                  <p className="text-xs font-bold text-gray-900">{t(tile.key)}</p>
                  <p className="text-[10px] text-gray-400 leading-tight line-clamp-1 w-full">
                    {tile.place
                      ? tile.place.address.split(',')[0]
                      : tile.key === 'Recent' ? t('No trips yet') : t('Set location')}
                  </p>
                </button>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* ── Services ─────────────────────────────────────── */}
      <div className="zana-home-section px-4 mt-7">
        <div className="mb-4">
          <h2 className="text-xl font-black tracking-tight text-gray-950">{t('Explore services')}</h2>
        </div>

        <div className="zana-service-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SERVICES.map(s => (
            <button
              key={s.id}
              onClick={() => router.push(s.route)}
              className="zana-service-tile flex flex-col items-start gap-2 active:scale-[0.98] transition-transform"
            >
              <div
                className="zana-service-icon w-16 h-16 rounded-[20px] flex items-center justify-center overflow-hidden"
                style={{ background: s.bg }}
              >
                <Image
                  src={s.image}
                  alt={t(s.title)}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>

              <p className="text-sm font-extrabold text-gray-900 text-left leading-tight">
                {t(s.title)}
              </p>

              <p className="text-[11px] text-gray-500 text-left leading-tight">
                {t(s.sub)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Promo banner ─────────────────────────────────── */}
      <div className="px-4 mt-7">
        <div
          className="zana-promo-panel rounded-[28px] overflow-hidden p-5 flex items-center justify-between relative"
          style={{ background: 'linear-gradient(135deg, #00A082 0%, #007A63 100%)' }}
        >
          <div className="flex-1">
            <p className="text-white font-black text-lg leading-tight">{t('Send packages with')}<br/>{t('Zana Delivery')}</p>
            <p className="text-white/70 text-xs mt-1">{t('Fast · Safe · Affordable')}</p>
            <button onClick={() => router.push('/deliver')}
              className="mt-3 flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-full">
              {t('Book now')} <ChevronRight size={12} />
            </button>
          </div>
          <div className="w-24 h-24 relative shrink-0">
            <Image src="/icons/package-box.png" alt={t('delivery')} fill className="object-contain" />
          </div>
        </div>
      </div>

      {/* Encourage wallet — it is the cheapest way to pay */}
      {walletBalance !== null && (
        <div className="px-4 mt-4">
          <button
            onClick={() => router.push('/wallet')}
            className="zana-wallet-tip w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-zana-primary-light flex items-center justify-center shrink-0">
              <Wallet size={18} className="text-zana-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-gray-900">{t('Pay with your Zana Wallet')}</p>
              <p className="text-[11px] text-gray-500 leading-snug">
                {t('Lower fees than Mobile Money, and no waiting for a payment prompt.')}
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        </div>
      )}

      {/* ── Schedule & Location FABs ─────────────────────── */}
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 flex flex-col gap-2.5 z-30 max-[359px]:right-2">
        <button onClick={() => router.push('/schedule')}
          className="w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-zana-primary shadow-lg flex flex-col items-center justify-center gap-0.5 px-3 py-2.5">
          <Calendar size={16} className="text-white" />
          <span className="text-[8px] text-white font-bold">{t('Schedule')}</span>
        </button>
        <button onClick={() => router.push('/share-location')}
          className="w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-white border border-gray-200 shadow-md flex flex-col items-center justify-center gap-0.5 px-3 py-2.5">
          <MapPin size={16} className="text-zana-primary" />
          <span className="text-[8px] text-zana-primary font-bold">{t('Location')}</span>
        </button>
      </div>

      {/* ── Ride type picker for a saved place ────────────────────────── */}
      {ridePick && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50"
          role="presentation"
          onClick={() => setRidePick(null)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-5 pb-8"
            role="dialog"
            aria-modal="true"
            aria-label={t('Choose a ride type')}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('Going to')} {ridePick.label}</p>
            <p className="text-lg font-black text-gray-900 mt-0.5 mb-5 line-clamp-2">{ridePick.address}</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const q = new URLSearchParams({
                    service: 'BIKE',
                    destLat: String(ridePick.lat),
                    destLng: String(ridePick.lng),
                    destAddress: ridePick.address,
                  });
                  router.push(`/search?${q.toString()}`);
                }}
                className="flex flex-col items-center gap-2 py-5 rounded-2xl border-2 border-gray-100 active:scale-95 transition-transform"
                style={{ background: '#FDF6E3' }}
              >
                <Image src="/icons/motorbike.png" alt={t('Moto')} width={44} height={44} className="object-contain" />
                <p className="text-sm font-black text-gray-900">{t('Moto')}</p>
                <p className="text-[10px] text-gray-500 -mt-1">{t('Fast & cheap')}</p>
              </button>

              <button
                onClick={() => {
                  const q = new URLSearchParams({
                    destLat: String(ridePick.lat),
                    destLng: String(ridePick.lng),
                    destAddress: ridePick.address,
                  });
                  router.push(`/ride-options?${q.toString()}`);
                }}
                className="flex flex-col items-center gap-2 py-5 rounded-2xl border-2 border-gray-100 active:scale-95 transition-transform"
                style={{ background: '#EEF9F6' }}
              >
                <Image src="/icons/car.png" alt={t('Car')} width={44} height={44} className="object-contain" />
                <p className="text-sm font-black text-gray-900">{t('Car')}</p>
                <p className="text-[10px] text-gray-500 -mt-1">{t('Comfortable')}</p>
              </button>
            </div>

            <button
              onClick={() => { setRidePick(null); router.push('/profile/places'); }}
              className="w-full text-center text-xs text-gray-400 mt-5 py-1"
            >
              {t('Change this saved place')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
