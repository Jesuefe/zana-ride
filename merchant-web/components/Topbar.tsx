'use client';

import { Bell } from 'lucide-react';
import { ZanaWordmark } from './ZanaLogo';

export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4 flex items-center justify-between border-b border-zana-border bg-background py-2">
      <div className="min-w-0">
        <ZanaWordmark size={25} color="#00A082" />
        <h1 className="mt-1 truncate text-lg font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="truncate text-xs text-zana-muted">{subtitle}</p>}
      </div>
      <button
        type="button"
        aria-label="Notifications"
        className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zana-primary-light text-zana-primary"
      >
        <Bell size={18} />
      </button>
    </header>
  );
}
