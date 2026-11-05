'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Briefcase, CalendarClock, ChevronDown, ChevronUp, Clock3,
  Home, Search, Share2, Wallet
} from 'lucide-react';
import BrandedMap from '../components/BrandedMap';
import { SERVICES } from '../lib/services';
import { fetchMe, ApiUser } from '../lib/api/auth';
import { fetchWallet, recoverActiveRide } from '../lib/api/trips';
import { haptic } from '../lib/haptics';
import { api } from '../lib/api/client';
import { useLang } from '../lib/LangContext';
import { getStoredPickup } from '../lib/location';
import './zana-city-home.css';

type SheetState = 'peek' | 'half' | 'full';
type Place = { label: string; address: string; lat: number; lng: number };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function ServiceGlyph({ kind }: { kind: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 36 32" aria-hidden="true" {...common}>
      {kind === 'car' && <><path d="M5 20l2-8q1-3 4-3h14q3 0 4 3l2 8" /><path d="M4 19h28v6H4zM8 25v3m20-3v3M8 19h20" /><circle cx="10" cy="22" r="1.6" fill="#FFC244" stroke="none" /><circle cx="26" cy="22" r="1.6" fill="#FFC244" stroke="none" /></>}
      {kind === 'moto' && <><circle cx="8" cy="23" r="5" /><circle cx="28" cy="23" r="5" /><path d="M8 23l6-11h6l8 11m-14-11-3-4h7m5 4h5l2 5m-12-5 4 11" /><path d="M21 8h5" stroke="#FFC244" strokeWidth="2.5" /></>}
      {kind === 'delivery' && <><path d="M5 11l13-7 13 7v15l-13 5-13-5zM5 11l13 7 13-7M18 18v13" /><path d="M24 7l-4 2" stroke="#FFC244" strokeWidth="2.5" /></>}
      {kind === 'food' && <><path d="M6 16h24l-2 13H8zM5 12q4-6 8 0t8 0t8 0" /><path d="M18 6V3" stroke="#FFC244" strokeWidth="2.5" /></>}
      {kind === 'shop' && <><path d="M6 12h24l-2 17H8zM11 12V8a7 7 0 0114 0v4" /><path d="M18 18v5" stroke="#FFC244" strokeWidth="2.5" /></>}
      {kind === 'gift' && <><path d="M4 13h28v16H4zM3 8h30v6H3zM18 8v21" /><path d="M18 8c-9 0-10-7-5-7 4 0 5 7 5 7zm0 0c0-7 6-9 9-6 2 3-2 6-9 6z" stroke="#FFC244" /></>}
      {kind === 'market' && <><path d="M6 12h24l-2 17H8zM5 12l4-8h18l4 8" /><path d="M12 12v6m6-6v6m6-6v6" stroke="#FFC244" strokeWidth="2" /></>}
    </svg>
  );
}

const SECONDARY_SERVICES = [
  { id: 'package', label: 'Delivery', kind: 'delivery' },
  { id: 'food', label: 'Order Food', kind: 'food' },
  { id: 'market', label: 'Market & Shop', kind: 'market' },
  { id: 'gift', label: 'Send a Gift', kind: 'gift' },
];

export default function HomePage() {
  const router = useRouter();
  const { t } = useLang();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [recentPlace, setRecentPlace] = useState<Place | null>(null);
  const [pickup, setPickup] = useState({ lat: -1.9536, lng: 30.0605 });
  const [loadError, setLoadError] = useState(false);
  const [recoveringRide, setRecoveringRide] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>('half');
  const [placeHint, setPlaceHint] = useState(false);
  const dragStart = useRef<{ y: number; time: number } | null>(null);

  const loadHomeData = () => {
    setLoadError(false);
    let failures = 0;
    const noteFailure = () => { failures += 1; if (failures >= 3) setLoadError(true); };
    fetchMe().then(setUser).catch(noteFailure);
    fetchWallet().then((wallet: any) => setWalletBalance(Number(wallet.balance ?? 0))).catch(noteFailure);
    api.get<any[]>('/users/saved-places')
      .then(list => setSavedPlaces(Array.isArray(list) ? list : []))
      .catch(noteFailure);
    api.get<any[]>('/rides/history')
      .then(trips => {
        const last = Array.isArray(trips) ? trips.find(trip => trip?.destinationAddress && Number.isFinite(Number(trip.destinationLat)) && Number.isFinite(Number(trip.destinationLng))) : null;
        if (last) setRecentPlace({ label: 'Recent', address: last.destinationAddress, lat: Number(last.destinationLat), lng: Number(last.destinationLng) });
      })
      .catch(noteFailure);
  };

  useEffect(() => {
    let cancelled = false;
    setPickup(getStoredPickup());
    loadHomeData();
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
    recover();
    try {
      if (!sessionStorage.getItem('zana-home-place-hint-seen')) setPlaceHint(true);
    } catch { /* Storage may be unavailable in private browsing. */ }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savedHome = savedPlaces.find(place => (place?.label ?? '').toLowerCase() === 'home');
  const savedWork = savedPlaces.find(place => (place?.label ?? '').toLowerCase() === 'work');
  const secondaryServices = SECONDARY_SERVICES
    .map(item => ({ ...item, service: SERVICES.find(service => service.id === item.id) }))
    .filter(item => !!item.service);

  const openDestination = () => router.push('/search');
  const openSavedPlace = (place: any, label: string) => {
    if (!place) {
      router.push('/profile/places');
      return;
    }
    const params = new URLSearchParams({
      name: label,
      address: place.address,
      lat: String(place.lat),
      lng: String(place.lng),
      pickupLat: String(pickup.lat),
      pickupLng: String(pickup.lng),
      pickupAddress: 'Current location',
    });
    router.push(`/ride-options?${params.toString()}`);
  };
  const openRecent = () => {
    if (!recentPlace) return;
    const params = new URLSearchParams({
      name: recentPlace.label,
      address: recentPlace.address,
      lat: String(recentPlace.lat),
      lng: String(recentPlace.lng),
      pickupLat: String(pickup.lat),
      pickupLng: String(pickup.lng),
      pickupAddress: 'Current location',
    });
    router.push(`/ride-options?${params.toString()}`);
  };
  const snapFromGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const delta = dragStart.current.y - event.clientY;
    const elapsed = Math.max(1, Date.now() - dragStart.current.time);
    const velocity = Math.abs(delta) / elapsed;
    if (delta > 48 || (delta > 18 && velocity > 0.45)) {
      setSheetState(current => current === 'peek' ? 'half' : 'full');
    } else if (delta < -48 || (delta < -18 && velocity > 0.45)) {
      setSheetState(current => current === 'full' ? 'half' : 'peek');
    }
    dragStart.current = null;
  };

  return (
    <main className="zana-city-home" data-sheet={sheetState}>
      <div className="zana-city-map" aria-label={t('Map of Kigali')}>
        <BrandedMap origin={pickup} height="100%" />
        <div className="zana-city-contours" aria-hidden="true" />
        <div className="zana-city-map-label zana-city-label-kacyiru">KACYIRU</div>
        <div className="zana-city-map-label zana-city-label-kimihurura">KIMIHURURA</div>
        <div className="zana-city-map-label zana-city-label-centre">KIGALI CITY CENTRE</div>
        <div className="zana-city-signature-pin" aria-hidden="true"><span /></div>
      </div>

      <header className="zana-city-topbar">
        <button className="zana-city-wordmark" onClick={() => router.push('/')} aria-label={t('Zana home')}>
          <img src="/zana-mark.svg" alt="" className="zana-city-logo-image" /><span>ZANA</span>
        </button>
        <button className="zana-city-wallet" onClick={() => router.push('/wallet')} aria-label={`${t('Wallet')}: ${walletBalance === null ? '—' : `${walletBalance.toLocaleString()} RWF`}`}>
          <Wallet size={15} /><span>{t('Wallet')}</span><strong>{walletBalance === null ? '—' : `${walletBalance.toLocaleString()} RWF`}</strong>
        </button>
      </header>

      <div className="zana-city-greeting">
        <span>{t(greeting())}{user?.firstName ? `, ${user.firstName}` : ''}</span>
        <strong>{t('Muraho.')}</strong>
      </div>

      {recoveringRide && (
        <div className="zana-city-recovering" role="status">
          <img src="/zana-mark.svg" alt="" className="zana-city-logo-image" />
          <strong>{t('Recovering your ride…')}</strong>
          <span>{t('Please wait while we reconnect you to your active trip.')}</span>
        </div>
      )}

      <section className="zana-city-sheet" aria-label={t('Ride booking and services')}>
        <div
          className="zana-city-sheet-handle"
          role="button"
          tabIndex={0}
          aria-label={t('Expand or collapse booking panel')}
          aria-expanded={sheetState === 'full'}
          onPointerDown={event => {
            dragStart.current = { y: event.clientY, time: Date.now() };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={snapFromGesture}
          onKeyDown={event => {
            if (event.key === 'ArrowUp') setSheetState(current => current === 'peek' ? 'half' : 'full');
            if (event.key === 'ArrowDown') setSheetState(current => current === 'full' ? 'half' : 'peek');
            if (event.key === 'Enter' || event.key === ' ') setSheetState(current => current === 'full' ? 'half' : 'full');
          }}
        ><span /></div>

        <div className="zana-city-sheet-scroll">
          <div className="zana-city-booking-heading">
            <h1>{t('Where to today?')}</h1>
            <span className="zana-city-locating"><i />{t('Current location')}</span>
          </div>

          <div className="zana-city-route-card">
            <button className="zana-city-route-row" onClick={openDestination} aria-label={t('Change pickup location')}>
              <span className="zana-city-route-dot" />
              <span className="zana-city-route-text"><small>{t('PICKUP')}</small><strong>{t('Current location')}</strong></span>
              <span className="zana-city-route-action">{t('Change')}</span>
            </button>
            <button className="zana-city-route-row zana-city-destination-row" onClick={openDestination}>
              <span className="zana-city-route-dot destination" />
              <span className="zana-city-route-text"><small>{t('DESTINATION')}</small><strong>{t('Where would you like to go?')}</strong></span>
              <Search size={18} />
            </button>
          </div>

          <div className="zana-city-place-row">
            <button className="zana-city-place-chip" onClick={() => openSavedPlace(savedHome, 'Home')}>
              <Home size={15} />{savedHome?.address ? <span className="zana-city-place-copy"><strong>{t('Home')}</strong><small>{savedHome.address.split(',')[0]}</small></span> : <span>{t('Add a place')}</span>}
            </button>
            <button className="zana-city-place-chip" onClick={() => openSavedPlace(savedWork, 'Work')}>
              <Briefcase size={15} />{savedWork?.address ? <span className="zana-city-place-copy"><strong>{t('Work')}</strong><small>{savedWork.address.split(',')[0]}</small></span> : <span>{t('Add a place')}</span>}
            </button>
            {placeHint && !savedHome && !savedWork && (
              <div className="zana-city-place-hint" role="status">
                {t('Add a place for faster bookings.')}
                <button onClick={() => {
                  setPlaceHint(false);
                  try { sessionStorage.setItem('zana-home-place-hint-seen', '1'); } catch {}
                }} aria-label={t('Dismiss hint')}>×</button>
              </div>
            )}
          </div>

          <div className="zana-city-recents">
            <div className="zana-city-section-label"><strong>{t('Recent places')}</strong><span>{recentPlace ? t('Last trip') : ''}</span></div>
            {recentPlace ? (
              <button className="zana-city-recent-row" onClick={openRecent}>
                <span className="zana-city-recent-icon"><Clock3 size={15} /></span>
                <span><strong>{recentPlace.address.split(',')[0]}</strong><small>{recentPlace.address}</small></span>
                <ArrowRight size={15} />
              </button>
            ) : (
              <div className="zana-city-recent-empty">{t('Your recent destinations will appear here.')}</div>
            )}
          </div>

          <div className="zana-city-services-block">
            <div className="zana-city-service-strip">
              {secondaryServices.map(item => (
                <button key={item.id} className={'zana-city-service compact zana-city-service-' + item.kind} onClick={() => router.push(item.service!.route)} aria-label={t(item.label)}>
                  <span className="zana-city-service-glyph"><ServiceGlyph kind={item.kind} /></span><strong>{t(item.label)}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="zana-city-sheet-secondary">
            <section className="zana-city-delivery-promo">
              <div className="zana-city-delivery-copy">
                <span>{t('ZANA DELIVERY')}</span>
                <h2>{t('Send it across the city.')}</h2>
                <button onClick={() => router.push('/deliver')}>{t('Send a package')} <ArrowRight size={15} /></button>
              </div>
              <svg className="zana-city-parcel-art" viewBox="0 0 150 110" aria-hidden="true">
                <path d="M27 38 76 13l48 24-49 26z" fill="#EBC58B" />
                <path d="M27 38v43l48 22V63z" fill="#C9904D" />
                <path d="M75 63l49-26v44l-49 22z" fill="#A96F38" />
                <path d="M76 13v29l-49-4z" fill="#F4D9A8" />
                <path d="m54 25 48 24" stroke="#FFF1D4" strokeWidth="5" />
                <path d="M75 63v40" stroke="#E9B96F" strokeWidth="2" />
                <path d="M12 82q14-18 29-5" stroke="#76C7A7" strokeWidth="3" fill="none" />
                <circle cx="12" cy="82" r="4" fill="#FFC244" />
              </svg>
            </section>
            <div className="zana-city-shortcuts">
              <button onClick={() => router.push('/schedule')}><CalendarClock size={17} /><span>{t('Schedule a ride')}</span><ArrowRight size={14} /></button>
              <button onClick={() => router.push('/share-location')}><Share2 size={17} /><span>{t('Share your location')}</span><ArrowRight size={14} /></button>
            </div>
            {loadError && (
              <div className="zana-city-error" role="alert">
                <span>{t("Couldn't load your information. Check your connection.")}</span>
                <button onClick={loadHomeData}>{t('Retry')}</button>
              </div>
            )}
          </div>
        </div>
        <div className="zana-city-sheet-snap-controls">
          <button onClick={() => setSheetState('peek')} aria-label={t('Collapse panel')}><ChevronDown size={15} /></button>
          <button onClick={() => setSheetState('full')} aria-label={t('Expand panel')}><ChevronUp size={15} /></button>
        </div>
      </section>
    </main>
  );
}
