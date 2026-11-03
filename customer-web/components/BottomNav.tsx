'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Wallet, User } from 'lucide-react';
import { useLang } from '../lib/LangContext';

const items=[{href:'/',label:'Home',icon:Home},{href:'/orders',label:'Orders',icon:Package},{href:'/wallet',label:'Wallet',icon:Wallet},{href:'/profile',label:'Profile',icon:User}];
const HIDDEN_PATHS=['/login','/signup','/verify','/login-code','/forgot-password','/privacy','/terms','/search','/ride-options','/tracking'];
export default function BottomNav(){
 const pathname=usePathname();const {t}=useLang();
 if(HIDDEN_PATHS.includes(pathname))return null;
 return <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-[640px] lg:max-w-[760px] bg-white/95 backdrop-blur-xl border-t border-zana-border flex items-center justify-around py-2 z-30">
 {items.map(item=>{const active=pathname===item.href;const Icon=item.icon;return <Link key={item.href} href={item.href} className={`flex min-w-0 flex-1 max-w-24 flex-col items-center gap-1 px-2 py-1 transition-colors ${active?'text-zana-primary':'text-zana-muted'}`}><Icon size={20} strokeWidth={active?2.4:2}/><span className="text-[11px]">{t(item.label)}</span></Link>;})}
 </nav>;
}
