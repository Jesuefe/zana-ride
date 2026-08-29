'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Car, Store, Package, MapPin,
  UserCheck, TrendingUp, LogOut, ChevronRight,
  Truck, BarChart2, ShieldCheck, DollarSign, ShoppingBag
} from 'lucide-react';
import { getToken, clearToken } from '../lib/api/client';

const SENIOR_NAV = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Financial', href: '/dashboard/financial', icon: DollarSign },
  { label: 'Staff & Payroll', href: '/dashboard/staff', icon: Users },
  { label: 'Users', href: '/dashboard/users', icon: Users },
  { label: 'Drivers', href: '/dashboard/drivers', icon: Car },
  { label: 'Merchants', href: '/dashboard/merchants', icon: Store },
  { label: 'Products', href: '/dashboard/products', icon: Package },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
  { label: 'Deliveries', href: '/dashboard/deliveries', icon: Truck },
  { label: 'Rides', href: '/dashboard/rides', icon: TrendingUp },
  { label: 'Markets', href: '/dashboard/markets', icon: MapPin },
  { label: 'Agents', href: '/dashboard/agents', icon: UserCheck },
  { label: 'Fares', href: '/dashboard/fares', icon: BarChart2 },
];

const WORKER_NAV = [
  { label: 'Pending Drivers', href: '/dashboard/drivers', icon: Car },
  { label: 'Pending Products', href: '/dashboard/products', icon: Package },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
  { label: 'Merchants', href: '/dashboard/merchants', icon: Store },
  { label: 'Active Deliveries', href: '/dashboard/deliveries', icon: Truck },
];

export default function AdminShell({ children, workerMode = false }: { children: React.ReactNode; workerMode?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<'senior' | 'worker'>('senior');

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const nav = mode === 'senior' ? SENIOR_NAV : WORKER_NAV;

  const handleLogout = () => { clearToken(); router.push('/login'); };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-zana-primary-dark flex flex-col">
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-white" />
            <span className="text-white font-bold text-sm">Zana Admin</span>
          </div>
          {/* Mode toggle */}
          <div className="flex mt-3 rounded-lg overflow-hidden border border-white/20">
            <button onClick={() => setMode('senior')} className={`flex-1 text-[10px] font-semibold py-1 ${mode === 'senior' ? 'bg-white text-zana-primary-dark' : 'text-white/70'}`}>Senior</button>
            <button onClick={() => setMode('worker')} className={`flex-1 text-[10px] font-semibold py-1 ${mode === 'worker' ? 'bg-white text-zana-primary-dark' : 'text-white/70'}`}>Worker</button>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${active ? 'bg-white/15 text-white font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                <Icon size={16} />
                {item.label}
                {active && <ChevronRight size={12} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <button onClick={handleLogout} className="flex items-center gap-2.5 px-4 py-4 text-sm text-white/60 hover:text-white border-t border-white/10">
          <LogOut size={16} /> Sign out
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
