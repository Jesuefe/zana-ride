'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '../lib/api/client';

const PUBLIC_PATHS = ['/login', '/verify'];

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
      router.replace('/login');
    } else {
      setChecked(true);
    }
  }, [isPublic, router, pathname]);

  if (!checked) return null;
  return <>{children}</>;
}
