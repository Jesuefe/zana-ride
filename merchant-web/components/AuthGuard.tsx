'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '../lib/api/client';

// Registration and password recovery must remain reachable without a session.
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isPublic) {
      setChecked(true);
      return;
    }
    if (!getToken()) {
      setChecked(false);
      router.replace('/login');
      return;
    }
    setChecked(true);
  }, [isPublic, router, pathname]);

  if (!checked) return null;
  return <>{children}</>;
}
