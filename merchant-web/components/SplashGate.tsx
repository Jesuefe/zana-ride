'use client';

import { useCallback, useEffect, useState } from 'react';
import ZanaSplash from './ZanaSplash';

export default function SplashGate({ role }: { role: 'merchant' | 'agent' }) {
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

  if (!show) return null;
  return <ZanaSplash role={role} onDone={done} />;
}
