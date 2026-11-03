'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Settings, ShieldCheck, FileText, CircleHelp, LogOut, ChevronRight, Globe, MapPin, Star, Check, X, LockKeyhole } from 'lucide-react';
import { useLang } from '../../lib/LangContext';
import { Lang, LANG_LABELS } from '../../lib/lang';
import Link from 'next/link';
import { fetchMe, ApiUser } from '../../lib/api/auth';
import { clearToken } from '../../lib/api/client';

const menuItems = [
  { icon: Settings, label: 'Account settings', href: '/profile/settings' },
  { icon: MapPin, label: 'Saved places', href: '/profile/places' },
  { icon: FileText, label: 'Ride history', href: '/history' },
  { icon: Star, label: 'Zana Points', href: '/points' },
  { icon: ShieldCheck, label: 'Safety', href: '/profile/safety' },
  { icon: CircleHelp, label: 'Help & support', href: '/profile/help' },
];
const LANGS: Lang[] = ['en', 'fr', 'rw'];

export default function ProfilePage() {
  const { lang, setLang, t } = useLang();
  const [showLangPicker,setShowLangPicker]=useState(false);
  const [showLogoutConfirm,setShowLogoutConfirm]=useState(false);
  const router=useRouter();
  const [user,setUser]=useState<ApiUser|null>(null);
  useEffect(()=>{fetchMe().then(setUser).catch(()=>{});},[]);
  const handleLogout=()=>{clearToken();router.replace('/login');};

  return <div className="p-5 sm:p-6 pb-10">
    <div className="rounded-[28px] bg-[#063B33] text-white p-6 mb-6 relative overflow-hidden">
      <div className="absolute -right-14 -top-20 w-56 h-56 rounded-full border border-white/10"/><div className="absolute -right-2 -top-8 w-36 h-36 rounded-full border border-white/10"/>
      <div className="relative flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center"><User size={28}/></div>
        <div className="min-w-0"><p className="font-bold text-lg truncate">{user?(`${user.firstName??''} ${user.lastName??''}`.trim()||user.phone):'Your Zana account'}</p><p className="text-xs text-white/60 mt-1">{user?.phone??'Loading account details…'}</p><p className="text-[10px] uppercase tracking-[.18em] text-[#FFC244] mt-2">MOVE KIGALI</p></div>
      </div>
    </div>
    <div className="flex items-center justify-between mb-3"><h1 className="text-xl font-black text-gray-900">Your account</h1><span className="text-[11px] text-gray-400">Manage your Zana experience</span></div>
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
      {menuItems.map(item=>{const Icon=item.icon;return <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition"><span className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center"><Icon size={17} className="text-gray-600"/></span><span className="flex-1 text-sm font-medium text-gray-800">{t(item.label)}</span><ChevronRight size={16} className="text-gray-300"/></Link>;})}
      <button onClick={()=>setShowLangPicker(true)} className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition"><span className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center"><Globe size={17} className="text-gray-600"/></span><span className="flex-1 text-sm font-medium text-gray-800">{t('Language')}</span><span className="text-xs text-gray-500">{LANG_LABELS[lang]}</span><ChevronRight size={16} className="text-gray-300"/></button>
    </div>
    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mt-7 mb-3 px-1">Legal & information</h2>
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
      <Link href="/privacy" className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50"><span className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center"><ShieldCheck size={17} className="text-gray-600"/></span><span className="flex-1 text-sm font-medium text-gray-800">Privacy Policy</span><ChevronRight size={16} className="text-gray-300"/></Link>
      <Link href="/terms" className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50"><span className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center"><FileText size={17} className="text-gray-600"/></span><span className="flex-1 text-sm font-medium text-gray-800">Terms of Service</span><ChevronRight size={16} className="text-gray-300"/></Link>
    </div>
    <button onClick={()=>setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 bg-white border border-red-100 rounded-2xl px-4 py-4 mt-6 text-red-600 hover:bg-red-50 transition"><span className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center"><LogOut size={17}/></span><span className="flex-1 text-left text-sm font-semibold">Log out</span><ChevronRight size={16} className="text-red-300"/></button>
    <p className="text-center text-[11px] text-gray-400 mt-7">Zana · Rides. Deliveries. Shopping.</p>

    {showLangPicker&&<div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" onClick={()=>setShowLangPicker(false)}><div className="absolute inset-0 bg-black/45 backdrop-blur-sm"/><div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-8 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex justify-between items-center mb-4"><div><h3 className="font-black text-lg text-gray-900">Choose language</h3><p className="text-xs text-gray-500 mt-1">Select your preferred language.</p></div><button onClick={()=>setShowLangPicker(false)} className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center"><X size={17}/></button></div>{LANGS.map(l=><button key={l} onClick={()=>{setLang(l);setShowLangPicker(false);}} className="w-full flex items-center justify-between px-4 py-4 rounded-xl hover:bg-gray-50"><span className={lang===l?'font-bold text-zana-primary':'text-sm text-gray-800'}>{LANG_LABELS[l]}</span>{lang===l&&<Check size={17} className="text-zana-primary"/>}</button>)}</div></div>}
    {showLogoutConfirm&&<div className="fixed inset-0 z-[90] flex items-center justify-center px-5" role="dialog" aria-modal="true" aria-labelledby="logout-title"><button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setShowLogoutConfirm(false)} aria-label="Close dialog"/><div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-fade-slide-up"><div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-5"><LockKeyhole size={22}/></div><h3 id="logout-title" className="text-xl font-black text-gray-900">Log out of Zana?</h3><p className="text-sm leading-6 text-gray-500 mt-2">You’ll need to sign in again to book rides, manage deliveries or access your account. Your account information will remain safe.</p><div className="grid grid-cols-2 gap-3 mt-7"><button onClick={()=>setShowLogoutConfirm(false)} className="h-12 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50">Stay signed in</button><button onClick={handleLogout} className="h-12 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700">Log out</button></div></div></div>}
  </div>;
}
