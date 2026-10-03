'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Wallet, User } from 'lucide-react';
import { useLang } from '../lib/LangContext';

const items = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLang();
  const hidden = ['/login', '/verify', '/search', '/ride-options', '/tracking'].includes(pathname);
  if (hidden) return null;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-[640px] lg:max-w-[760px] bg-white border-t border-zana-border flex items-center justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-30">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-w-0 flex-1 max-w-24 flex-col items-center gap-1 px-2 py-1 ${active ? 'text-zana-primary' : 'text-zana-muted'}`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[11px]">{t(item.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
