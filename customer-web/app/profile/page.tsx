'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Settings, ShieldCheck, FileText, CircleHelp, LogOut, ChevronRight } from 'lucide-react';
import { fetchMe, ApiUser } from '../../lib/api/auth';
import { clearToken } from '../../lib/api/client';

const menuItems = [
  { icon: Settings, label: 'Account settings' },
  { icon: ShieldCheck, label: 'Safety' },
  { icon: FileText, label: 'Payment methods' },
  { icon: CircleHelp, label: 'Help & support' },
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
          <button key={i} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <item.icon size={18} className="text-gray-700" />
            <span className="flex-1 text-sm text-gray-900">{item.label}</span>
            <ChevronRight size={15} className="text-zana-muted" />
          </button>
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
