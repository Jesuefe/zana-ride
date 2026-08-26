'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Menu, Bell, Wallet as WalletIcon, Plus, Car, Bike, Package, UtensilsCrossed, ShoppingBag, ArrowRight, Clock } from 'lucide-react';
import { fetchMe } from '../lib/api/auth';
import { ApiError } from '../lib/api/client';
import { requestLiveLocation } from '../lib/location';

const services = [
  { id: 'car', title: 'Car Ride', subtitle: 'Comfortable rides, any distance', icon: Car, bg: '#E3F5F1', comingSoon: false, service: 'ECONOMY' },
  { id: 'moto', title: 'Moto Ride', subtitle: 'Fast & affordable', icon: Bike, bg: '#FBF1DD', comingSoon: false, service: 'BIKE' },
  { id: 'package', title: 'Send a Package', subtitle: 'Parcels & express drop-offs', icon: Package, bg: '#E3F5F1', comingSoon: true },
  { id: 'food', title: 'Buy Food', subtitle: 'Meals from top kitchens', icon: UtensilsCrossed, bg: '#FBF1DD', comingSoon: true },
  { id: 'shop', title: 'Shop & Deliver', subtitle: 'We shop, you relax', icon: ShoppingBag, bg: '#E3F5F1', comingSoon: true },
];

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('there');
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    fetchMe()
      .then((u) => {
        if (u.firstName) setName(u.firstName);
        setBalance(u.wallet?.balance ?? 0);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
      });
    requestLiveLocation();
  }, [router]);

  const handleServiceClick = (id: string, comingSoon: boolean, service?: string) => {
    if (comingSoon) {
      alert("Coming soon to Zana. We'll notify you when it launches.");
      return;
    }
    if (service) {
      router.push(`/search?service=${service}`);
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-br from-zana-primary-dark to-zana-primary px-4 pt-4 pb-14 rounded-b-3xl animate-fade-in">
        <div className="flex items-center justify-between">
          <button className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white">
            <Menu size={18} />
          </button>
          <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-md">
            <Image src="/logo.png" alt="Zana" width={44} height={44} className="object-cover" priority />
          </div>
          <button
            onClick={() => router.push('/orders')}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white"
          >
            <Bell size={18} />
          </button>
        </div>
        <div className="mt-6">
          <p className="text-white/80 text-sm">Hello, {name}</p>
          <h1 className="text-white text-2xl font-bold mt-1 max-w-[220px]">What do you need today?</h1>
        </div>
      </div>

      <div className="px-4 -mt-8 space-y-4">
        <div className="bg-zana-primary-dark rounded-2xl p-4 flex items-center gap-3 shadow-lg animate-fade-slide-up">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <WalletIcon size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white/75 text-xs">Wallet Balance</p>
            <p className="text-white text-lg font-bold">{balance !== null ? `${balance.toLocaleString()} RWF` : '…'}</p>
          </div>
          <button className="flex items-center gap-1 bg-zana-secondary text-gray-900 text-xs font-bold px-3 py-2 rounded-full transition-transform active:scale-95">
            Top Up <Plus size={12} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => handleServiceClick(s.id, s.comingSoon, s.service)}
                className={`service-card animate-fade-slide-up stagger-${Math.min(i + 1, 6)} bg-white rounded-2xl p-4 text-left shadow-sm relative min-h-[130px]`}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center mb-2"
                  style={{ backgroundColor: s.bg }}
                >
                  <Icon size={22} className="text-zana-primary-dark" />
                </div>
                <p className="font-semibold text-sm text-gray-900">{s.title}</p>
                <p className="text-xs text-zana-muted mt-0.5">{s.subtitle}</p>
                {s.comingSoon ? (
                  <span className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    <Clock size={10} /> Soon
                  </span>
                ) : (
                  <span className="absolute bottom-3 right-3 w-6 h-6 rounded-full bg-zana-primary flex items-center justify-center">
                    <ArrowRight size={13} className="text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="bg-gradient-to-br from-zana-primary-dark to-[#063D31] rounded-2xl p-5 text-white animate-fade-slide-up stagger-6">
          <p className="text-lg font-bold leading-snug">Fast. Reliable.<br />Always with you.</p>
          <p className="text-white/80 text-xs mt-2">One app for all your everyday needs.</p>
          <button className="mt-4 bg-zana-secondary text-gray-900 text-xs font-bold px-4 py-2 rounded-full transition-transform active:scale-95">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
}
