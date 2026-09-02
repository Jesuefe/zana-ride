'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MapPin, Calendar } from 'lucide-react';
import { fetchMe, ApiUser } from '../lib/api/auth';
import { fetchWallet } from '../lib/api/trips';
import LanguageSelector from '../components/LanguageSelector';
import { useLang } from '../lib/LangContext';

type Service = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  bg: string;
  comingSoon?: boolean;
  route?: string;
};

const services: Service[] = [
  { id: 'car', title: 'Car Ride', subtitle: 'Comfortable rides, any distance', image: '/icons/car.png', bg: '#E3F5F1', route: '/search?service=ECONOMY' },
  { id: 'moto', title: 'Moto Ride', subtitle: 'Fast & affordable', image: '/icons/motorbike.png', bg: '#FBF1DD', route: '/search?service=BIKE' },
  { id: 'package', title: 'Send a Package', subtitle: 'Parcels & express drop-offs', image: '/icons/package-box.png', bg: '#E3F5F1', route: '/deliver' },
  { id: 'food', title: 'Order Food', subtitle: 'Meals from top kitchens', image: '/icons/burger-drink.png', bg: '#E3F5F1', route: '/food' },
  { id: 'shop', title: 'Shop & Deliver', subtitle: 'Supermarket & goods delivered', image: '/icons/grocery-bag.png', bg: '#FBF1DD', route: '/shop' },
  { id: 'gift', title: 'Send a Gift', subtitle: 'Roses & surprises', image: '/icons/flower-bouquet.png', bg: '#E3F5F1', route: '/gifts' },
];

export default function HomePage() {
  const router = useRouter();
  const { t } = useLang();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    fetchMe().then(setUser).catch(() => {});
    fetchWallet().then(w => setWalletBalance(w.balance)).catch(() => {});
  }, []);

  const handleService = (s: Service) => {
    if (s.comingSoon) return;
    if (s.route) router.push(s.route);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-zana-primary px-4 pt-10 pb-16 relative overflow-hidden">
        <Image src="/icons/kigali-building.png" alt="" width={120} height={120}
          className="absolute right-0 top-0 opacity-20" />
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-white/70 text-sm">
              {t('What do you need today?')}
            </p>
            <p className="text-white font-bold text-xl">
              Hello, {user?.firstName ?? 'there'}
            </p>
          </div>
          <LanguageSelector />
        </div>

        {/* Wallet card */}
        <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="15" rx="3" stroke="white" strokeWidth="2"/>
                <path d="M16 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" fill="white"/>
                <path d="M2 9h20" stroke="white" strokeWidth="2"/>
              </svg>
            </div>
            <div>
              <p className="text-white/60 text-[10px] font-medium uppercase tracking-wide">Wallet Balance</p>
              <p className="text-white font-bold text-lg">
                {walletBalance !== null ? `${walletBalance.toLocaleString()} RWF` : '0 RWF'}
              </p>
            </div>
          </div>
          <button onClick={() => router.push('/wallet')}
            className="bg-zana-secondary text-gray-900 font-bold text-xs px-4 py-2 rounded-xl">
            Top Up +
          </button>
        </div>
      </div>

      {/* Service grid */}
      <div className="px-4 -mt-8">
        <div className="grid grid-cols-2 gap-3">
          {services.map(s => (
            <button key={s.id} onClick={() => handleService(s)}
              className="bg-white rounded-2xl p-4 text-left shadow-sm relative overflow-hidden active:scale-[0.98] transition-transform">
              <div className="w-14 h-14 rounded-2xl mb-3 flex items-center justify-center overflow-hidden"
                style={{ background: s.bg }}>
                <Image src={s.image} alt={s.title} width={48} height={48} className="object-contain" />
              </div>
              <p className="font-bold text-sm text-gray-900">{s.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{s.subtitle}</p>
              {s.comingSoon && (
                <div className="absolute top-3 right-3 bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke="white" strokeWidth="2" fill="none"/>
                  </svg>
                  Soon
                </div>
              )}
              {!s.comingSoon && (
                <div className="absolute bottom-4 right-4 w-7 h-7 rounded-full bg-zana-primary flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Floating action buttons — Schedule and Share Location */}
      <div className="fixed bottom-20 right-4 flex flex-col gap-3 z-30">
        {/* Schedule a ride */}
        <button onClick={() => router.push('/schedule')}
          className="w-14 h-14 rounded-full bg-zana-primary shadow-lg flex flex-col items-center justify-center gap-0.5">
          <Calendar size={18} className="text-white" />
          <span className="text-[8px] text-white font-bold leading-tight">Schedule</span>
        </button>
        {/* Share location */}
        <button onClick={() => router.push('/share-location')}
          className="w-14 h-14 rounded-full bg-white border-2 border-zana-primary shadow-lg flex flex-col items-center justify-center gap-0.5">
          <MapPin size={18} className="text-zana-primary" />
          <span className="text-[8px] text-zana-primary font-bold leading-tight">Location</span>
        </button>
      </div>
    </div>
  );
}
