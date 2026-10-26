'use client';

import { useEffect, useState } from 'react';
import { ZanaMark, ZanaWordmark } from './ZanaLogo';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Car, Store, Package, MapPin, UserCheck, TrendingUp,
  LogOut, Truck, ShieldCheck, DollarSign, ShoppingBag, Menu, X, Search, Send,
  Sun, Moon, Smartphone, Settings, Image as ImageIcon, ClipboardList, MessageCircle,
  ChevronRight, Bell, Command, Activity
} from 'lucide-react';
import { getToken, clearToken } from '../lib/api/client';
import { useTheme } from '../lib/ThemeContext';

const SENIOR_NAV = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, group: 'Workspace' },
  { label: 'Safety', href: '/safety', icon: ShieldCheck, group: 'Workspace' },
  { label: 'Users', href: '/dashboard/users', icon: Users, group: 'People & partners' },
  { label: 'Drivers', href: '/dashboard/drivers', icon: Car, group: 'People & partners' },
  { label: 'Rider Applications', href: '/dashboard/rider-registrations', icon: ClipboardList, group: 'People & partners' },
  { label: 'Merchants', href: '/dashboard/merchants', icon: Store, group: 'People & partners' },
  { label: 'Merchant Registrations', href: '/dashboard/merchant-registrations', icon: ClipboardList, group: 'People & partners' },
  { label: 'Agents', href: '/dashboard/agents', icon: UserCheck, group: 'People & partners' },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag, group: 'Operations' },
  { label: 'Deliveries', href: '/dashboard/deliveries', icon: Truck, group: 'Operations' },
  { label: 'Rides', href: '/dashboard/rides', icon: TrendingUp, group: 'Operations' },
  { label: 'Dispatch', href: '/dashboard/dispatch', icon: Send, group: 'Operations' },
  { label: 'Tracking', href: '/dashboard/tracking', icon: Search, group: 'Operations' },
  { label: 'Support', href: '/dashboard/support', icon: MessageCircle, group: 'Operations' },
  { label: 'Products', href: '/dashboard/products', icon: Package, group: 'Commerce' },
  { label: 'Markets', href: '/dashboard/markets', icon: MapPin, group: 'Commerce' },
  { label: 'Media Library', href: '/dashboard/media', icon: ImageIcon, group: 'Commerce' },
  { label: 'Financial', href: '/dashboard/financial', icon: DollarSign, group: 'Finance & system' },
  { label: 'Reconciliation', href: '/dashboard/financial/reconciliation', icon: Activity, group: 'Finance & system' },
  { label: 'Expenses', href: '/dashboard/expenses', icon: DollarSign, group: 'Finance & system' },
  { label: 'Staff & Payroll', href: '/dashboard/staff', icon: Users, group: 'Finance & system' },
  { label: 'Security', href: '/dashboard/security', icon: ShieldCheck, group: 'Finance & system' },
  { label: 'System Health', href: '/dashboard/system-health', icon: Activity, group: 'Finance & system' },
  { label: 'Test Lab', href: '/dashboard/test-locations', icon: Smartphone, group: 'Finance & system' },
  { label: 'Test Accounts', href: '/dashboard/test-accounts', icon: Users, group: 'Finance & system' },
  { label: 'Merchant Invites', href: '/dashboard/invites', icon: ShieldCheck, group: 'Finance & system' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, group: 'Finance & system' },
];

const WORKER_NAV = [
  { label: 'Pending Drivers', href: '/dashboard/drivers', icon: Car, group: 'Work queue' },
  { label: 'Pending Products', href: '/dashboard/products', icon: Package, group: 'Work queue' },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag, group: 'Operations' },
  { label: 'Merchants', href: '/dashboard/merchants', icon: Store, group: 'Operations' },
  { label: 'Support', href: '/dashboard/support', icon: MessageCircle, group: 'Operations' },
  { label: 'Dispatch', href: '/dashboard/dispatch', icon: Send, group: 'Operations' },
  { label: 'Tracking', href: '/dashboard/tracking', icon: Search, group: 'Operations' },
  { label: 'Active Deliveries', href: '/dashboard/deliveries', icon: Truck, group: 'Operations' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<'senior' | 'worker'>('senior');
  const { choice, setChoice } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/login'); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const role = payload?.role;
      if (role === 'STAFF') {
        setMode('worker');
        const adminOnly = ['/dashboard/financial', '/dashboard/staff', '/dashboard/expenses', '/dashboard/settings', '/dashboard/test-locations', '/dashboard/test-accounts', '/dashboard/invites'];
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
  const activeItem = nav.find(item => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))) || nav.find(item => item.href === pathname);
  const pageTitle = pathname === '/dashboard' ? 'Overview' : (activeItem?.label || pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Workspace');
  const handleLogout = () => { clearToken(); router.push('/login'); };
  const groupedNav = nav.reduce<Record<string, typeof nav>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  const SidebarContent = () => (
    <>
      <div className="px-5 pt-6 pb-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 mb-5">
          <ZanaMark size={35} />
          <div className="min-w-0"><div className="flex items-center gap-2"><ZanaWordmark size={17} color="#FFFFFF" /><span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70">Admin</span></div><p className="mt-1 text-[10px] tracking-[.16em] uppercase text-white/40">Move Kigali</p></div>
        </Link>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50"/><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"/></span>
          <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-white/80">{mode === 'senior' ? 'Control center' : 'Staff workspace'}</p><p className="mt-0.5 text-[10px] text-white/40">Operations console</p></div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {Object.entries(groupedNav).map(([group, items]) => (
          <div key={group} className="mb-5">
            <p className="px-3 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[.18em] text-white/35">{group}</p>
            <div className="space-y-1">
              {items.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] transition-all duration-150 ${active ? 'bg-[#00A082] text-white shadow-lg shadow-black/10 font-semibold' : 'text-white/60 hover:bg-white/[0.07] hover:text-white'}`}>
                  <Icon size={16} strokeWidth={active ? 2.3 : 1.8} />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {active && <ChevronRight size={14} className="text-white/70" />}
                </Link>;
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mx-4 mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <p className="text-[10px] font-semibold text-white/80">Zana platform</p><p className="mt-1 text-[10px] text-white/40">Mobility · Delivery · Commerce</p>
        <div className="mt-3 flex items-center gap-1.5">
          {([{ id: 'light', icon: Sun }, { id: 'dark', icon: Moon }, { id: 'system', icon: Smartphone }] as const).map(o => <button key={o.id} onClick={() => setChoice(o.id)} className={`flex h-7 flex-1 items-center justify-center rounded-lg transition ${choice === o.id ? 'bg-white text-slate-900' : 'text-white/50 hover:bg-white/10 hover:text-white'}`} aria-label={o.id}><o.icon size={13}/></button>)}
        </div>
      </div>
      <button onClick={handleLogout} className="mx-3 mb-4 flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-medium text-white/50 transition hover:bg-red-500/10 hover:text-red-300"><LogOut size={16}/> Sign out <span className="ml-auto text-[10px] text-white/25">↗</span></button>
    </>
  );

  return (
    <div className="admin-workspace flex min-h-screen bg-[#F5F7F8] text-slate-900">
      <aside className="admin-sidebar hidden w-[252px] shrink-0 flex-col md:flex"><SidebarContent /></aside>
      <div className="min-w-0 flex-1">
        <header className="admin-topbar sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen(o => !o)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 md:hidden" aria-label="Open navigation">{mobileOpen ? <X size={18}/> : <Menu size={18}/>}</button>
            <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400"><span>Zana</span><ChevronRight size={12}/><span className="truncate">{pageTitle}</span></div><h1 className="mt-1 truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">{pageTitle}</h1></div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <label className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-[#00A082] lg:flex"><Search size={15} className="text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && query.trim()) router.push('/dashboard?search=' + encodeURIComponent(query.trim())); }} placeholder="Quick search…" className="w-32 bg-transparent text-xs outline-none placeholder:text-slate-400 xl:w-44"/><span className="flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1 text-[9px] text-slate-400"><Command size={9}/> K</span></label>
            <div className="hidden h-8 w-px bg-slate-200 sm:block"/>
            <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-slate-800">{mode === 'senior' ? 'Administrator' : 'Operations staff'}</p><p className="mt-0.5 text-[10px] text-slate-400">{mode === 'senior' ? 'Full access' : 'Limited access'}</p></div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E3F5F1] text-xs font-extrabold text-[#00806A] ring-1 ring-[#00A082]/15">{mode === 'senior' ? 'AD' : 'ST'}</div>
          </div>
        </header>
        {mobileOpen && <div className="fixed inset-0 z-40 flex md:hidden"><button className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/><aside className="admin-sidebar relative z-10 flex h-full w-[285px] flex-col shadow-2xl"><div className="flex justify-end px-3 pt-3"><button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white/70 hover:bg-white/10" aria-label="Close menu"><X size={18}/></button></div><SidebarContent/></aside></div>}
        <main className="admin-main min-w-0 p-4 sm:p-6 lg:p-8"><div className="mx-auto w-full max-w-[1600px]">{children}</div><footer className="mx-auto mt-10 flex max-w-[1600px] flex-col gap-2 border-t border-slate-200/70 pt-4 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} Zana Ride · Operations platform</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/> Workspace ready</span></footer></main>
      </div>
    </div>
  );
}
