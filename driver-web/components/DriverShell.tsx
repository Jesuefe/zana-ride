'use client';

import { usePathname } from 'next/navigation';
import DriverBottomNav from './DriverBottomNav';
import SplashGate from './SplashGate';
import AuthGuard from './AuthGuard';
import { ThemeProvider } from '../lib/ThemeContext';
import LanguageSelector from './LanguageSelector';

// Screens reached before a driver has an account. The bottom navigation
// makes no sense on these, and showing it implies the app is usable.
const PRE_LOGIN = [
  '/login', '/signup', '/verify', '/onboarding',
  '/login-code', '/forgot-password',
];

export default function DriverShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const preLogin = PRE_LOGIN.includes(pathname);

  return (
    <AuthGuard>
      <div className="min-h-screen w-full max-w-[480px] mx-auto overflow-x-hidden pb-16">
        <SplashGate>
          <ThemeProvider>{children}</ThemeProvider>
        </SplashGate>
        {!preLogin && (
          <div className="fixed top-3 right-3 z-[60]">
            <LanguageSelector variant="floating" />
          </div>
        )}
      </div>
      {!preLogin && <DriverBottomNav />}
    </AuthGuard>
  );
}
