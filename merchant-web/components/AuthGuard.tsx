'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '../lib/api/client';
import MerchantBottomNav from './MerchantBottomNav';

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
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <main className="mx-auto min-h-screen w-full max-w-[480px] overflow-x-hidden bg-background px-4 pb-[88px] pt-4">
        {children}
      </main>
      <MerchantBottomNav />
    </div>
  );
}
