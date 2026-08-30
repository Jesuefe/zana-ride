'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Car, Store, Package, MapPin,
  UserCheck, TrendingUp, LogOut, ChevronRight,
  Truck, BarChart2, ShieldCheck, DollarSign, ShoppingBag, Menu, X
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

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<'senior' | 'worker'>('senior');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const nav = mode === 'senior' ? SENIOR_NAV : WORKER_NAV;
  const handleLogout = () => { clearToken(); router.push('/login'); };

  const SidebarContent = () => (
    <>
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-zana-primary-dark text-lg">Z</div>
          <span className="text-white font-bold text-sm">Zana Admin</span>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-white/20">
          <button onClick={() => setMode('senior')} className={`flex-1 text-[10px] font-semibold py-1.5 ${mode === 'senior' ? 'bg-white text-zana-primary-dark' : 'text-white/70'}`}>Senior</button>
          <button onClick={() => setMode('worker')} className={`flex-1 text-[10px] font-semibold py-1.5 ${mode === 'worker' ? 'bg-white text-zana-primary-dark' : 'text-white/70'}`}>Worker</button>
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${active ? 'bg-white/15 text-white font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button onClick={handleLogout} className="flex items-center gap-2.5 px-4 py-4 text-sm text-white/60 hover:text-white border-t border-white/10">
        <LogOut size={16} /> Sign out
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-zana-primary-dark flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center font-black text-zana-primary-dark">Z</div>
          <span className="text-white font-bold text-sm">Zana Admin</span>
        </div>
        <button onClick={() => setMobileOpen(o => !o)} className="text-white p-1">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="relative w-64 bg-zana-primary-dark flex flex-col h-full pt-14" onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-zana-primary-dark flex-col">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 md:p-6 mt-12 md:mt-0">
        {children}
      </main>
    </div>
  );
}
