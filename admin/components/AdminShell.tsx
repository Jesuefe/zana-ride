'use client';

import { useEffect, useState } from 'react';
import { ZanaMark, ZanaWordmark } from './ZanaLogo';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, Car, Store, Package, MapPin, Crosshair, UserCheck, TrendingUp, LogOut, Truck, BarChart2, ShieldCheck, DollarSign, ShoppingBag, Headset, Menu, X, Search, Send, Sun, Moon, Smartphone, ClipboardList, Bell, Settings, Sparkles } from 'lucide-react';
import { getToken, clearToken } from '../lib/api/client';
import { getMyProfile } from '../lib/api/admin';
import { useTheme } from '../lib/ThemeContext';
import GlobalSearch from './GlobalSearch';

const SENIOR_NAV = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard }, { label: 'Support', href: '/dashboard/support', icon: Headset }, { label: 'Financial', href: '/dashboard/financial', icon: DollarSign },
  { label: 'Staff & Payroll', href: '/dashboard/staff', icon: Users }, { label: 'Users', href: '/dashboard/users', icon: Users },
  { label: 'Drivers', href: '/dashboard/drivers', icon: Car }, { label: 'Merchants', href: '/dashboard/merchants', icon: Store },
  { label: 'Dispatch', href: '/dashboard/dispatch', icon: Send }, { label: 'Tracking', href: '/dashboard/tracking', icon: Search },
  { label: 'Products', href: '/dashboard/products', icon: Package }, { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
  { label: 'Deliveries', href: '/dashboard/deliveries', icon: Truck }, { label: 'Rides', href: '/dashboard/rides', icon: TrendingUp },
  { label: 'Markets', href: '/dashboard/markets', icon: MapPin }, { label: 'Agents', href: '/dashboard/agents', icon: UserCheck },
  { label: 'Fares', href: '/dashboard/fares', icon: BarChart2 }, { label: 'Merchant Invites', href: '/dashboard/invites', icon: ShieldCheck },
  { label: 'Expenses', href: '/dashboard/expenses', icon: DollarSign }, { label: 'Audit Log', href: '/dashboard/audit-log', icon: ClipboardList },
  { label: 'Test Locations', href: '/dashboard/test-locations', icon: Crosshair }, { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings }, { label: 'AI Settings', href: '/dashboard/settings/ai', icon: Sparkles },
];
const WORKER_NAV = [
  { label: 'Customer Support', href: '/dashboard/support', icon: Headset },
  { label: 'Pending Drivers', href: '/dashboard/drivers', icon: Car }, { label: 'Pending Products', href: '/dashboard/products', icon: Package },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag }, { label: 'Merchants', href: '/dashboard/merchants', icon: Store },
  { label: 'Dispatch', href: '/dashboard/dispatch', icon: Send }, { label: 'Tracking', href: '/dashboard/tracking', icon: Search }, { label: 'Active Deliveries', href: '/dashboard/deliveries', icon: Truck },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const pathname = usePathname();
  const [accountRole, setAccountRole] = useState('');
  const [accessRole, setAccessRole] = useState('OPERATIONS');
  const { choice, setChoice } = useTheme(); const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/login'); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const role = payload?.role;
      if (role !== 'ADMIN' && role !== 'STAFF') {
        clearToken();
        router.replace('/login');
        return;
      }
      const staffAccess = String(payload?.accessRole || 'OPERATIONS');
      setAccountRole(role);
      setAccessRole(staffAccess);
      const adminOnly = ['/dashboard/financial', '/dashboard/staff', '/dashboard/expenses', '/dashboard/settings', '/dashboard/test-locations', '/dashboard/invites', '/dashboard/audit-log', '/dashboard/fares', '/dashboard/settings/ai'];
      if (role === 'STAFF' && adminOnly.some(path => pathname === path || pathname.startsWith(path + '/'))) {
        router.replace(staffAccess === 'CUSTOMER_SUPPORT' ? '/dashboard/support' : staffAccess === 'DRIVER_OPERATIONS' ? '/dashboard/drivers' : staffAccess === 'MARKET_OPERATIONS' ? '/dashboard/markets' : '/dashboard/orders');
      }
    } catch {
      clearToken();
      router.replace('/login');
      return;
    }
    getMyProfile().then(setProfile).catch(() => undefined);
  }, [router, pathname]);

  const supportNav = [
    { label: 'Customer Support', href: '/dashboard/support', icon: Headset },
    { label: 'Customers', href: '/dashboard/users', icon: Users },
    { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
    { label: 'Deliveries', href: '/dashboard/deliveries', icon: Truck },
    { label: 'Rides', href: '/dashboard/rides', icon: TrendingUp },
    { label: 'Merchants', href: '/dashboard/merchants', icon: Store },
  ];
  const driverNav = [
    { label: 'Drivers', href: '/dashboard/drivers', icon: Car },
    { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
    { label: 'Deliveries', href: '/dashboard/deliveries', icon: Truck },
    { label: 'Rides', href: '/dashboard/rides', icon: TrendingUp },
    { label: 'Dispatch', href: '/dashboard/dispatch', icon: Send },
    { label: 'Tracking', href: '/dashboard/tracking', icon: Search },
  ];
  const marketNav = [
    { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
    { label: 'Deliveries', href: '/dashboard/deliveries', icon: Truck },
    { label: 'Merchants', href: '/dashboard/merchants', icon: Store },
    { label: 'Markets', href: '/dashboard/markets', icon: MapPin },
    { label: 'Agents', href: '/dashboard/agents', icon: UserCheck },
  ];
  const operationsNav = [
    { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
    { label: 'Deliveries', href: '/dashboard/deliveries', icon: Truck },
    { label: 'Merchants', href: '/dashboard/merchants', icon: Store },
    { label: 'Dispatch', href: '/dashboard/dispatch', icon: Send },
    { label: 'Tracking', href: '/dashboard/tracking', icon: Search },
  ];
  const nav = accountRole === 'ADMIN' ? SENIOR_NAV :
    accessRole === 'CUSTOMER_SUPPORT' ? supportNav :
    accessRole === 'DRIVER_OPERATIONS' ? driverNav :
    accessRole === 'MARKET_OPERATIONS' ? marketNav : operationsNav;
  const handleLogout = () => { clearToken(); router.push('/login'); };
  const initials = (String(profile?.firstName?.[0] ?? '') + String(profile?.lastName?.[0] ?? '')).toUpperCase() || 'A';

  const Profile = () => (
    <Link href="/dashboard/settings" className="flex items-center gap-2.5 mb-3 p-2 -mx-2 rounded-xl hover:bg-white/10 transition-colors">
      {profile?.photoUrl ? <img src={profile.photoUrl} alt="Admin profile" className="w-9 h-9 rounded-full object-cover border border-white/30 shrink-0" /> :
        <div className="w-9 h-9 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>}
      <div className="min-w-0"><div className="text-white text-sm font-semibold truncate">{[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Administrator'}</div><div className="text-white/50 text-[10px]">{accountRole === 'STAFF' ? 'Staff workspace' : 'Admin profile'}</div></div>
    </Link>
  );

  const SidebarContent = () => (
    <>
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3"><ZanaMark size={32} /><span className="flex items-center gap-2"><ZanaWordmark size={16} color="#FFFFFF" /><span className="text-white font-bold text-sm">Admin</span></span></div>
        <Profile />
        <div className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-semibold text-white/80 text-center">
          {accountRole === 'ADMIN' ? 'ADMIN CONTROL CENTER' : `STAFF · ${accessRole.replaceAll('_', ' ')}`}
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${active ? 'bg-white/15 text-white font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><Icon size={16} />{item.label}</Link>;
        })}
      </nav>
      <div className="px-4 pt-3 pb-1 border-t border-white/10">
        <div className="flex rounded-lg overflow-hidden border border-white/20">
          {([{ id: 'light', icon: Sun }, { id: 'dark', icon: Moon }, { id: 'system', icon: Smartphone }] as const).map(o => (
            <button key={o.id} onClick={() => setChoice(o.id)} className={`flex-1 flex items-center justify-center py-1.5 ${choice === o.id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'}`} aria-label={o.id}><o.icon size={13} /></button>
          ))}
        </div>
      </div>
      <button onClick={handleLogout} className="flex items-center gap-2.5 px-4 py-4 text-sm text-white/60 hover:text-white border-t border-white/10"><LogOut size={16} /> Sign out</button>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-zana-primary-dark flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2"><ZanaMark size={28} /><span className="flex items-center gap-2"><ZanaWordmark size={16} color="#FFFFFF" /><span className="text-white font-bold text-sm">Admin</span></span></div>
        <button onClick={() => setMobileOpen(o => !o)} className="text-white p-1">{mobileOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      {mobileOpen && <div className="md:hidden fixed inset-0 z-30 flex" onClick={() => setMobileOpen(false)}><div className="absolute inset-0 bg-black/50" /><aside className="relative w-64 bg-zana-primary-dark flex flex-col h-full pt-14" onClick={e => e.stopPropagation()}><SidebarContent /></aside></div>}
      <aside className="hidden md:flex w-56 bg-zana-primary-dark flex-col"><SidebarContent /></aside>
      <main className="flex-1 overflow-auto p-4 md:p-6 mt-12 md:mt-0"><div className="hidden md:flex mb-5"><GlobalSearch /></div>{children}</main>
    </div>
  );
}
