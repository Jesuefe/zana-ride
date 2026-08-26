'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Car,
  Users,
  Route,
  Map,
  DollarSign,
  LifeBuoy,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/drivers', label: 'Drivers', icon: Car },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/trips', label: 'Trips', icon: Route },
  { href: '/live-map', label: 'Live Map', icon: Map },
  { href: '/pricing', label: 'Pricing & Zones', icon: DollarSign },
  { href: '/support', label: 'Support', icon: LifeBuoy },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-zana-primary-dark text-white flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-extrabold text-zana-primary-dark">
          Z
        </div>
        <span className="font-bold tracking-wide">Zana Admin</span>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? 'bg-white/15 font-semibold' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-white/50 border-t border-white/10">
        Zana Ride Admin · v1.0
      </div>
    </aside>
  );
}
