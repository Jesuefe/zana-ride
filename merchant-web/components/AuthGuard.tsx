'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { getToken } from '../lib/api/client';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (isLoginPage) { setChecked(true); return; }
    if (!getToken()) { router.replace('/login'); } else { setChecked(true); }
  }, [isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;
  if (!checked) return null;

  return (
    <div className="min-h-screen flex overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto p-4 md:p-6 bg-gray-50 pt-16 md:pt-6">
        {children}
      </main>
    </div>
  );
}
