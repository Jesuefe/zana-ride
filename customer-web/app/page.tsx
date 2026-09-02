'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Clock, Home, Briefcase, ChevronRight, Search, MapPin, Calendar } from 'lucide-react';
import { fetchMe, ApiUser } from '../lib/api/auth';
import { fetchWallet } from '../lib/api/trips';
import { useLang } from '../lib/LangContext';

const SERVICES = [
  { id: 'car',      title: 'Ride',          sub: 'Affordable & safe',    image: '/icons/car.png',            bg: '#EEF9F6', route: '/search?service=ECONOMY' },
  { id: 'moto',     title: 'Moto Ride',     sub: 'Fast & reliable',      image: '/icons/motorbike.png',      bg: '#FDF6E3', route: '/search?service=BIKE' },
  { id: 'package',  title: 'Delivery',      sub: 'Send anything',        image: '/icons/package-box.png',    bg: '#EEF9F6', route: '/deliver' },
  { id: 'food',     title: 'Order Food',    sub: 'Meals & drinks',       image: '/icons/burger-drink.png',   bg: '#FDF6E3', route: '/food' },
  { id: 'shop',     title: 'Shop',          sub: 'Groceries & goods',    image: '/icons/grocery-bag.png',    bg: '#EEF9F6', route: '/shop' },
  { id: 'gift',     title: 'Send Gift',     sub: 'Roses & surprises',    image: '/icons/flower-bouquet.png', bg: '#FDF6E3', route: '/gifts' },
];

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

  useEffect(() => {
    fetchMe().then(setUser).catch(() => {});
    fetchWallet().then(w => setWalletBalance(w.balance)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white pb-24">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="px-5 pt-12 pb-4 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-500 text-sm">{greeting()}</p>
            <h1 className="text-2xl font-black text-gray-900 mt-0.5">
              {user?.firstName ?? 'Welcome'} 👋
            </h1>
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={12} className="text-zana-primary" />
              <p className="text-xs text-gray-500">Kigali, Rwanda</p>
            </div>
          </div>

          {/* Wallet pill */}
          <button
            onClick={() => router.push('/wallet')}
            className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm"
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

      {/* ── Where to card ───────────────────────────────── */}
      <div className="px-4 mt-2">
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-5">
          <h2 className="text-xl font-black text-gray-900 mb-4">Where to?</h2>

          {/* Search bar */}
          <button
            onClick={() => router.push('/search')}
            className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3.5 mb-3"
          >
            <Search size={18} className="text-gray-400 shrink-0" />
            <span className="text-gray-400 text-sm flex-1 text-left">Search destination</span>
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
              <Clock size={15} className="text-gray-400" />
            </div>
          </button>

          {/* Quick places */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <Home size={14} />, label: 'Home', sub: 'Set location', route: '/profile/places' },
              { icon: <Briefcase size={14} />, label: 'Work', sub: 'Set location', route: '/profile/places' },
              { icon: <Clock size={14} />, label: 'Recent', sub: 'Last ride', route: '/history' },
            ].map(p => (
              <button key={p.label} onClick={() => router.push(p.route)}
                className="flex flex-col items-start gap-1.5 bg-gray-50 rounded-2xl px-3 py-3 text-left">
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-gray-500 shadow-sm">
                  {p.icon}
                </div>
                <p className="text-xs font-bold text-gray-900">{p.label}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{p.sub}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Services ─────────────────────────────────────── */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-gray-900">Services</h2>
          <button onClick={() => router.push('/search')}
            className="text-sm font-semibold text-zana-primary">See all</button>
        </div>

        {/* Row 1 — 4 services */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          {SERVICES.slice(0, 4).map(s => (
            <button key={s.id} onClick={() => router.push(s.route)}
              className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
              <div className="w-full aspect-square rounded-2xl flex items-center justify-center overflow-hidden"
                style={{ background: s.bg }}>
                <Image src={s.image} alt={s.title} width={44} height={44} className="object-contain" />
              </div>
              <p className="text-[11px] font-bold text-gray-900 text-center leading-tight">{s.title}</p>
              <p className="text-[9px] text-gray-400 text-center leading-tight -mt-1">{s.sub}</p>
            </button>
          ))}
        </div>

        {/* Row 2 — 2 services centered */}
        <div className="flex justify-center gap-3">
          {SERVICES.slice(4).map(s => (
            <button key={s.id} onClick={() => router.push(s.route)}
              className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
              style={{ width: 'calc(25% - 6px)' }}>
              <div className="w-full aspect-square rounded-2xl flex items-center justify-center overflow-hidden"
                style={{ background: s.bg }}>
                <Image src={s.image} alt={s.title} width={44} height={44} className="object-contain" />
              </div>
              <p className="text-[11px] font-bold text-gray-900 text-center leading-tight">{s.title}</p>
              <p className="text-[9px] text-gray-400 text-center leading-tight -mt-1">{s.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Promo banner ─────────────────────────────────── */}
      <div className="px-4 mt-6">
        <div
          className="rounded-3xl overflow-hidden p-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #00A082 0%, #007A63 100%)' }}
        >
          <div className="flex-1">
            <p className="text-white font-black text-lg leading-tight">Send packages with<br/>Zana Delivery</p>
            <p className="text-white/70 text-xs mt-1">Fast · Safe · Affordable</p>
            <button onClick={() => router.push('/deliver')}
              className="mt-3 flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-full">
              Book now <ChevronRight size={12} />
            </button>
          </div>
          <div className="w-24 h-24 relative shrink-0">
            <Image src="/icons/package-box.png" alt="delivery" fill className="object-contain" />
          </div>
        </div>
      </div>

      {/* ── Schedule & Location FABs ─────────────────────── */}
      <div className="fixed bottom-20 right-4 flex flex-col gap-2.5 z-30">
        <button onClick={() => router.push('/schedule')}
          className="w-13 h-13 rounded-2xl bg-zana-primary shadow-lg flex flex-col items-center justify-center gap-0.5 px-3 py-2.5">
          <Calendar size={16} className="text-white" />
          <span className="text-[8px] text-white font-bold">Schedule</span>
        </button>
        <button onClick={() => router.push('/share-location')}
          className="w-13 h-13 rounded-2xl bg-white border border-gray-200 shadow-md flex flex-col items-center justify-center gap-0.5 px-3 py-2.5">
          <MapPin size={16} className="text-zana-primary" />
          <span className="text-[8px] text-zana-primary font-bold">Location</span>
        </button>
      </div>

      {/* ── Bottom nav ───────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 z-40">
        <div className="flex items-center justify-around">
          {[
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, label: 'Home', route: '/', active: true },
            { icon: <Clock size={22} />, label: 'Activity', route: '/history', active: false },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="15" rx="3"/><path d="M16 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" fill="currentColor" stroke="none"/><path d="M2 9h20"/></svg>, label: 'Wallet', route: '/wallet', active: false },
            { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label: 'Profile', route: '/profile', active: false },
          ].map(item => (
            <button key={item.label} onClick={() => router.push(item.route)}
              className={`flex flex-col items-center gap-1 ${item.active ? 'text-zana-primary' : 'text-gray-400'}`}>
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
