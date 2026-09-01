'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Package, TrendingUp, User } from 'lucide-react';

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/deliveries', label: 'Deliveries', icon: Package },
  { href: '/earnings', label: 'Earnings', icon: TrendingUp },
  { href: '/profile', label: 'Profile', icon: User },
];

const HIDE_ON = ['/login', '/signup', '/trip'];

export default function DriverBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (HIDE_ON.some(p => pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 safe-area-pb">
      <div className="flex items-center max-w-[480px] mx-auto">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5"
            >
              <Icon
                size={22}
                className={active ? 'text-zana-primary' : 'text-gray-400'}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span className={`text-[10px] font-medium ${active ? 'text-zana-primary' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
