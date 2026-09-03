'use client';

import { useEffect, useState } from 'react';
import ZanaSplash from './ZanaSplash';

// Shows the Zana splash once per browser session (per tab).
export default function SplashGate({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const seen = sessionStorage.getItem('zana_splash_seen');
      if (!seen) {
        setShow(true);
        sessionStorage.setItem('zana_splash_seen', '1');
      }
    } catch {
      // sessionStorage blocked — just skip the splash
    }
    setChecked(true);
  }, []);

  if (!checked) return null;

  return (
    <>
      {show && <ZanaSplash onDone={() => setShow(false)} />}
      {children}
    </>
  );
}
