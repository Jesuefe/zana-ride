'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Wallet, User } from 'lucide-react';

const items = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const hidden = ['/login', '/verify', '/search', '/ride-options', '/tracking'].includes(pathname);
  if (hidden) return null;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-zana-border flex items-center justify-around py-2 z-30">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 px-3 py-1 ${active ? 'text-zana-primary' : 'text-zana-muted'}`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[11px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
