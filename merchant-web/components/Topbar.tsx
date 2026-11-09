'use client';

import Link from 'next/link';
import { Bell, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clearToken } from '../lib/api/client';
import { ZanaWordmark } from './ZanaLogo';

export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const handleLogout = () => { clearToken(); router.replace('/login'); router.refresh(); };

  return (
    <header className="mb-4 flex items-center justify-between border-b border-gray-100 bg-white py-2">
      <div className="min-w-0">
        <ZanaWordmark size={25} color="#00A082" />
        <h1 className="mt-1 truncate text-lg font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="truncate text-xs text-zana-muted">{subtitle}</p>}
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-2">
        <Link
          href="/orders"
          aria-label="Orders and notifications"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zana-primary-light text-zana-primary"
        >
          <Bell size={18} />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out of Zana Business"
          className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 text-xs font-bold text-red-600"
        >
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
