'use client';

import { useEffect, useState } from 'react';
import {
  Users, Car, Store, Package, Truck, TrendingUp, AlertCircle, ShieldAlert,
  ArrowUpRight, Activity, Clock3, Wallet, CheckCircle2, ArrowRight, RefreshCw,
  CircleDot, Zap, ClipboardList, Radio
} from 'lucide-react';
import Link from 'next/link';
import AdminShell from '../../components/AdminShell';
import { getOverview, getLiveOperations } from '../../lib/api/admin';
import { getToken } from '../../lib/api/client';

type Overview = {
  totalUsers: number; customers: number; merchants: number; drivers: number; agents: number;
  activeRides: number; activeDeliveries: number;
  pendingDrivers: number; pendingMerchants: number; pendingProducts: number;
  totalRevenue: number;
};

function MetricCard({ icon: Icon, label, value, hint, accent = 'teal', href }: any) {
  const accents: Record<string, string> = {
    teal: 'bg-[#E3F5F1] text-[#00806A]',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    red: 'bg-rose-50 text-rose-700',
  };
  const card = <div className={`group h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_28px_rgba(15,23,42,.06)] sm:p-5 ${href ? 'cursor-pointer' : ''}`}>
    <div className="flex items-start justify-between gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accents[accent] || accents.teal}`}><Icon size={19} strokeWidth={1.9}/></div>
      {href && <ArrowUpRight size={15} className="text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#00A082]"/>}
    </div>
    <p className="mt-5 text-[11px] font-semibold tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-[27px] font-bold leading-tight tracking-[-.04em] text-slate-900 tabular-nums">{value?.toLocaleString?.() ?? value ?? '—'}</p>
    {hint && <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{hint}</p>}
  </div>;
  return href ? <Link href={href}>{card}</Link> : card;
}

function Panel({ title, eyebrow, icon: Icon, action, children }: any) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600"><Icon size={17}/></div><div>{eyebrow && <p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-400">{eyebrow}</p>}<h2 className="mt-0.5 text-sm font-bold text-slate-900">{title}</h2></div></div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>;
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [staffOps, setStaffOps] = useState<any>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let staff = false;
    try {
      const token = getToken();
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        staff = payload?.role === 'STAFF';
      }
    } catch {}
    setIsStaff(staff);
    const load = () => {
      if (staff) getLiveOperations().then(value => { setStaffOps(value); setLastUpdated(new Date()); }).catch(() => {});
      else getOverview().then(value => { setData(value); setLastUpdated(new Date()); }).catch(() => {});
    };
    load();
    const interval = setInterval(load, staff ? 5000 : 15000);
    return () => clearInterval(interval);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      if (isStaff) setStaffOps(await getLiveOperations());
      else setData(await getOverview());
      setLastUpdated(new Date());
    } catch {} finally { setRefreshing(false); }
  };

  const pendingTotal = (data?.pendingDrivers || 0) + (data?.pendingMerchants || 0) + (data?.pendingProducts || 0);
  const timeLabel = lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Connecting…';

  if (isStaff) {
    const k = staffOps?.kpis ?? {};
    return <AdminShell><div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#00806A]"><span className="h-2 w-2 rounded-full bg-[#00A082]"/> Operations live</div><h2 className="text-3xl font-bold tracking-[-.04em] text-slate-900">Good work starts here.</h2><p className="mt-2 text-sm text-slate-500">Your live operational picture, refreshed every five seconds.</p></div><button onClick={refresh} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/> Refresh data</button></div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><MetricCard icon={Radio} label="Online drivers" value={k.onlineDrivers} accent="teal" hint="Currently connected"/><MetricCard icon={Car} label="Busy drivers" value={k.busyDrivers} accent="blue" hint="On an active job"/><MetricCard icon={TrendingUp} label="Active rides" value={k.activeRides} accent="violet" hint="In progress"/><MetricCard icon={Truck} label="Active deliveries" value={k.activeDeliveries} accent="amber" hint="Out for delivery"/></div>
      <Panel title="Your operational tools" eyebrow="Quick access" icon={Zap}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[{label:'Dispatch',desc:'Coordinate live jobs',href:'/dashboard/dispatch',icon:Activity},{label:'Orders',desc:'Review and process orders',href:'/dashboard/orders',icon:ClipboardList},{label:'Support inbox',desc:'Help customers and riders',href:'/dashboard/support',icon:Users},{label:'Driver operations',desc:'Review driver status',href:'/dashboard/drivers',icon:Car},{label:'Delivery tracking',desc:'Follow active deliveries',href:'/dashboard/tracking',icon:Truck},{label:'Merchant network',desc:'Manage partner activity',href:'/dashboard/merchants',icon:Store}].map(item=><Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-[#B9E9DF] hover:bg-[#F6FCFA]"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 group-hover:bg-[#E3F5F1] group-hover:text-[#00806A]"><item.icon size={18}/></div><div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-800">{item.label}</p><p className="mt-1 text-[10px] text-slate-400">{item.desc}</p></div><ArrowRight size={14} className="text-slate-300 group-hover:text-[#00806A]"/></Link>)}</div></Panel>
      <p className="text-right text-[10px] text-slate-400">Last updated {timeLabel}</p>
    </div></AdminShell>;
  }

  return <AdminShell><div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#00806A]"><span className="h-2 w-2 rounded-full bg-[#00A082]"/> Platform pulse <span className="text-slate-300">/</span> Kigali, Rwanda</div><h2 className="text-3xl font-bold tracking-[-.045em] text-slate-950 sm:text-[34px]">Good morning. Here’s Zana.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Your operating picture at a glance — people, mobility, commerce and the actions that need attention.</p></div>
      <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Last synced</p><p className="mt-1 text-xs font-semibold text-slate-700">{timeLabel}</p></div><button onClick={refresh} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/> Refresh</button></div>
    </div>

    <Link href="/safety" className="group relative block overflow-hidden rounded-2xl bg-[#111B24] p-5 shadow-[0_8px_24px_rgba(15,23,42,.09)] transition hover:shadow-[0_12px_30px_rgba(15,23,42,.14)] sm:p-6">
      <div className="absolute -right-8 -top-20 h-56 w-56 rounded-full border border-white/[.06]"/><div className="absolute -right-2 -top-12 h-40 w-40 rounded-full border border-white/[.06]"/>
      <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-300/20"><ShieldAlert size={22}/></div><div><div className="flex items-center gap-2"><p className="text-sm font-bold text-white">Safety command center</p><span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-300">Priority</span></div><p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">Monitor SOS incidents, respond to emergencies and keep the network safe.</p></div></div><span className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/[.06] px-3.5 py-2.5 text-xs font-semibold text-white transition group-hover:bg-white/10 sm:self-auto">Open safety <ArrowUpRight size={15}/></span></div>
    </Link>

    {data && pendingTotal > 0 && <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-[#FFFBEB] p-4 sm:flex-row sm:items-center"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><AlertCircle size={19}/></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-amber-950">Your attention is needed</p><p className="mt-1 text-xs leading-relaxed text-amber-800">{[data.pendingDrivers > 0 && `${data.pendingDrivers} driver applications`,data.pendingMerchants > 0 && `${data.pendingMerchants} merchant applications`,data.pendingProducts > 0 && `${data.pendingProducts} products to review`].filter(Boolean).join(' · ')} waiting for review.</p></div><div className="flex flex-wrap gap-2">{data.pendingDrivers > 0 && <Link href="/dashboard/drivers" className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-[11px] font-bold text-amber-900 hover:bg-amber-50">Review drivers</Link>}{data.pendingMerchants > 0 && <Link href="/dashboard/merchant-registrations" className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-[11px] font-bold text-amber-900 hover:bg-amber-50">Review merchants</Link>}{data.pendingProducts > 0 && <Link href="/dashboard/products" className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-[11px] font-bold text-amber-900 hover:bg-amber-50">Review products</Link>}</div></div>}

    <div><div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-bold uppercase tracking-[.13em] text-slate-700">Live operations</h3><p className="mt-1 text-[10px] text-slate-400">What is happening across the network right now</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/> LIVE</span></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><MetricCard icon={TrendingUp} label="Active rides" value={data?.activeRides} accent="teal" hint="Trips in progress" href="/dashboard/rides"/><MetricCard icon={Truck} label="Active deliveries" value={data?.activeDeliveries} accent="blue" hint="Orders on the move" href="/dashboard/deliveries"/><MetricCard icon={Car} label="Drivers to review" value={data?.pendingDrivers} accent="amber" hint="Waiting for approval" href="/dashboard/drivers"/><MetricCard icon={Package} label="Products to review" value={data?.pendingProducts} accent="violet" hint="Pending moderation" href="/dashboard/products"/></div></div>

    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Panel title="Platform overview" eyebrow="Network & community" icon={Users} action={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-500">ALL TIME</span>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[{label:'Total users',value:data?.totalUsers,icon:Users,color:'text-slate-700',bg:'bg-slate-100'},{label:'Customers',value:data?.customers,icon:Users,color:'text-blue-700',bg:'bg-blue-50'},{label:'Drivers',value:data?.drivers,icon:Car,color:'text-[#00806A]',bg:'bg-[#E3F5F1]'},{label:'Merchants',value:data?.merchants,icon:Store,color:'text-violet-700',bg:'bg-violet-50'}].map(item=><div key={item.label} className="rounded-xl border border-slate-100 p-3"><div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${item.bg} ${item.color}`}><item.icon size={15}/></div><p className="text-[10px] font-medium text-slate-500">{item.label}</p><p className="mt-1 text-xl font-bold tracking-tight text-slate-900 tabular-nums">{item.value?.toLocaleString() ?? '—'}</p></div>)}
        </div>
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><Link href="/dashboard/agents" className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3 transition hover:bg-slate-100"><div className="flex items-center gap-2.5"><div className="rounded-lg bg-white p-2 text-slate-500"><Users size={15}/></div><span className="text-xs font-semibold text-slate-700">Platform agents</span></div><span className="text-sm font-bold text-slate-900">{data?.agents?.toLocaleString() ?? '—'}</span></Link><Link href="/dashboard/merchant-registrations" className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3 transition hover:bg-slate-100"><div className="flex items-center gap-2.5"><div className="rounded-lg bg-white p-2 text-amber-600"><Clock3 size={15}/></div><span className="text-xs font-semibold text-slate-700">Merchant applications</span></div><span className="text-sm font-bold text-slate-900">{data?.pendingMerchants?.toLocaleString() ?? '—'}</span></Link></div>
      </Panel>
      <Panel title="Revenue snapshot" eyebrow="Financial performance" icon={Wallet} action={<Link href="/dashboard/financial" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#00806A] hover:text-[#006A58]">View finance <ArrowRight size={12}/></Link>}>
        <div className="rounded-xl bg-gradient-to-br from-[#007E69] to-[#00A082] p-5 text-white"><div className="flex items-center justify-between"><span className="text-xs font-medium text-white/75">Total ride revenue</span><div className="rounded-lg bg-white/15 p-2"><Wallet size={16}/></div></div><p className="mt-4 text-3xl font-bold tracking-[-.04em] tabular-nums">{data ? data.totalRevenue.toLocaleString() : '—'} <span className="text-sm font-semibold text-white/75">RWF</span></p><div className="mt-4 flex items-center gap-2 border-t border-white/20 pt-3 text-[10px] text-white/75"><CheckCircle2 size={13}/> Data reported by the platform</div></div>
        <div className="mt-4 space-y-3"><Link href="/dashboard/financial/reconciliation" className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-[#B9E9DF] hover:bg-[#F6FCFA]"><div className="rounded-lg bg-slate-50 p-2 text-slate-600 group-hover:bg-[#E3F5F1] group-hover:text-[#00806A]"><Activity size={16}/></div><div className="flex-1"><p className="text-xs font-bold text-slate-800">Reconciliation</p><p className="mt-1 text-[10px] text-slate-400">Review payment records</p></div><ArrowUpRight size={14} className="text-slate-300"/></Link><Link href="/dashboard/expenses" className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-[#B9E9DF] hover:bg-[#F6FCFA]"><div className="rounded-lg bg-slate-50 p-2 text-slate-600 group-hover:bg-[#E3F5F1] group-hover:text-[#00806A]"><Wallet size={16}/></div><div className="flex-1"><p className="text-xs font-bold text-slate-800">Operating expenses</p><p className="mt-1 text-[10px] text-slate-400">Manage business spending</p></div><ArrowUpRight size={14} className="text-slate-300"/></Link></div>
      </Panel>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      {[{title:'Review applications',desc:'Keep rider onboarding moving',href:'/dashboard/rider-registrations',icon:ClipboardList,tag:'PEOPLE'},{title:'Manage commerce',desc:'Merchants, products and orders',href:'/dashboard/merchant-registrations',icon:Store,tag:'COMMERCE'},{title:'Resolve support',desc:'Stay on top of customer issues',href:'/dashboard/support',icon:Users,tag:'CUSTOMER CARE'}].map(item=><Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] transition hover:-translate-y-0.5 hover:border-[#B9E9DF] hover:shadow-md"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition group-hover:bg-[#E3F5F1] group-hover:text-[#00806A]"><item.icon size={18}/></div><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">{item.tag}</p><p className="mt-1 text-xs font-bold text-slate-800">{item.title}</p><p className="mt-1 text-[10px] text-slate-400">{item.desc}</p></div><ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#00806A]"/></Link>)}
    </div>
    <p className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400"><CircleDot size={10} className="text-emerald-500"/> Dashboard refreshes automatically every 15 seconds</p>
  </div></AdminShell>;
}
