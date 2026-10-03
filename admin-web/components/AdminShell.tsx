'use client';

import { useEffect, useState } from 'react';
import { ZanaMark, ZanaWordmark, ZanaHorizontal } from './ZanaLogo';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Car, Store, Package, MapPin,
  UserCheck, TrendingUp, LogOut, ChevronRight,
  Truck, ShieldCheck, DollarSign, ShoppingBag, Menu, X, Search, Send,
  Sun, Moon, Smartphone, Settings, Image as ImageIcon } from 'lucide-react';
import { getToken, clearToken } from '../lib/api/client';
import { useTheme } from '../lib/ThemeContext';

const SENIOR_NAV = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Safety', href: '/safety', icon: ShieldCheck },
  { label: 'Financial', href: '/dashboard/financial', icon: DollarSign },
  { label: 'Staff & Payroll', href: '/dashboard/staff', icon: Users },
  { label: 'Users', href: '/dashboard/users', icon: Users },
  { label: 'Drivers', href: '/dashboard/drivers', icon: Car },
  { label: 'Merchants', href: '/dashboard/merchants', icon: Store },
  { label: 'Dispatch', href: '/dashboard/dispatch', icon: Send },
  { label: 'Tracking', href: '/dashboard/tracking', icon: Search },
  { label: 'Test Lab', href: '/dashboard/test-locations', icon: Smartphone },
  { label: 'Products', href: '/dashboard/products', icon: Package },
  { label: 'Media Library', href: '/dashboard/media', icon: ImageIcon },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
  { label: 'Deliveries', href: '/dashboard/deliveries', icon: Truck },
  { label: 'Rides', href: '/dashboard/rides', icon: TrendingUp },
  { label: 'Markets', href: '/dashboard/markets', icon: MapPin },
  { label: 'Agents', href: '/dashboard/agents', icon: UserCheck },
  { label: 'Merchant Invites', href: '/dashboard/invites', icon: ShieldCheck },
  { label: 'Expenses', href: '/dashboard/expenses', icon: DollarSign },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const WORKER_NAV = [
  { label: 'Pending Drivers', href: '/dashboard/drivers', icon: Car },
  { label: 'Pending Products', href: '/dashboard/products', icon: Package },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
  { label: 'Merchants', href: '/dashboard/merchants', icon: Store },
  { label: 'Dispatch', href: '/dashboard/dispatch', icon: Send },
  { label: 'Tracking', href: '/dashboard/tracking', icon: Search },
  { label: 'Active Deliveries', href: '/dashboard/deliveries', icon: Truck },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<'senior' | 'worker'>('senior');
  const { choice, setChoice } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/login'); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload?.role;
      if (role === 'STAFF') {
        setMode('worker');
        const adminOnly = ['/dashboard/financial', '/dashboard/staff', '/dashboard/expenses', '/dashboard/settings', '/dashboard/test-locations', '/dashboard/invites'];
        if (adminOnly.some(path => pathname === path || pathname.startsWith(path + '/'))) router.replace('/dashboard');
      } else if (role === 'ADMIN') {
        setMode('senior');
      } else {
        clearToken();
        router.replace('/login');
      }
    } catch {
      clearToken();
      router.replace('/login');
    }
  }, [router, pathname]);

  const nav = mode === 'senior' ? SENIOR_NAV : WORKER_NAV;
  const handleLogout = () => { clearToken(); router.push('/login'); };

  const SidebarContent = () => (
    <>
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <ZanaMark size={32} />
          <span className="flex items-center gap-2"><ZanaWordmark size={16} color="#FFFFFF" /><span className="text-white font-bold text-sm">Admin</span></span>
        </div>
        <div className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-semibold text-white/80 text-center">
          {mode === 'senior' ? 'ADMIN CONTROL CENTER' : 'STAFF WORKSPACE'}
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
      <div className="px-4 pt-3 pb-1 border-t border-white/10">
        <div className="flex rounded-lg overflow-hidden border border-white/20">
          {([
            { id: 'light', icon: Sun },
            { id: 'dark', icon: Moon },
            { id: 'system', icon: Smartphone },
          ] as const).map(o => (
            <button
              key={o.id}
              onClick={() => setChoice(o.id)}
              className={`flex-1 flex items-center justify-center py-1.5 ${choice === o.id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'}`}
              aria-label={o.id}
            >
              <o.icon size={13} />
            </button>
          ))}
        </div>
      </div>
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
          <ZanaMark size={28} />
          <span className="flex items-center gap-2"><ZanaWordmark size={16} color="#FFFFFF" /><span className="text-white font-bold text-sm">Admin</span></span>
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
