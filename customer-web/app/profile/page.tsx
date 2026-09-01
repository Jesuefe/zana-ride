'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Settings, ShieldCheck, FileText, CircleHelp, LogOut, ChevronRight, Globe, MapPin, Star } from 'lucide-react';
import Link from 'next/link';
import LanguageSelector from '../../components/LanguageSelector';
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

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    fetchMe().then(setUser).catch(() => {});
  }, []);

  const handleLogout = () => {
    clearToken();
    router.replace('/login');
  };

  return (
    <div className="p-6">
      <div className="flex flex-col items-center gap-1 mb-6">
        <div className="w-16 h-16 rounded-full bg-zana-primary-light flex items-center justify-center mb-2">
          <User size={26} className="text-zana-primary" />
        </div>
        <p className="font-semibold text-gray-900">
          {user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.phone : '…'}
        </p>
        <p className="text-xs text-zana-muted">{user?.phone}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
        {menuItems.map((item, i) => (
          <Link key={i} href={item.href} className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-white rounded-xl shadow-sm">
            <item.icon size={18} className="text-gray-700" />
            <span className="flex-1 text-sm text-gray-900">{item.label}</span>
            <ChevronRight size={15} className="text-zana-muted" />
          </Link>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 bg-white rounded-2xl shadow-sm px-4 py-3.5 mt-4 text-zana-error"
      >
        <LogOut size={18} />
        <span className="text-sm font-medium">Log out</span>
      </button>
    </div>
  );
}
