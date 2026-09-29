'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ZanaSplash from './ZanaSplash';

export default function SplashGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const role = pathname.startsWith('/agent') ? 'agent' : 'merchant';
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const seen = window.sessionStorage.getItem('zana-business-splash-v1');
      if (!seen) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const done = useCallback(() => {
    try {
      window.sessionStorage.setItem('zana-business-splash-v1', '1');
    } catch {}
    setShow(false);
  }, []);

  return (
    <>
      {children}
      {show && <ZanaSplash role={role} onDone={done} />}
    </>
  );
}
