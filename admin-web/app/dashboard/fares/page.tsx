'use client';

import { useEffect } from 'react';

export default function FaresRedirect() {
  useEffect(() => { window.location.replace('/dashboard/settings'); }, []);
  return <div className="p-8 text-sm text-gray-500">Fare controls have moved to Settings.</div>;
}
