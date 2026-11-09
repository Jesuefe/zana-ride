'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Home, ShoppingBag, Truck, Wallet, LogOut } from 'lucide-react';
import { useLang } from '../lib/LangContext';
import { clearToken } from '../lib/api/client';

const merchantItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/deliveries', label: 'Deliveries', icon: Truck },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
];

const agentItems = [
  { href: '/agent?view=overview', label: 'Home', icon: Home },
  { href: '/agent?view=orders', label: 'Orders', icon: ShoppingBag },
  { href: '/agent?view=deliveries', label: 'Deliveries', icon: Truck },
  { href: '/agent?view=wallet', label: 'Wallet', icon: Wallet },
];

export default function MerchantBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLang();

  // Do not show authenticated navigation on sign-in or onboarding screens.
  if (['/login', '/register', '/forgot-password'].includes(pathname)) return null;

  const isAgent = pathname === '/agent' || pathname.startsWith('/agent/');
  const items = isAgent ? agentItems : merchantItems;
  const currentView = searchParams.get('view') || 'overview';

  const handleLogout = () => {
    clearToken();
    router.replace('/login');
    router.refresh();
  };

  return (
    <nav aria-label="Merchant navigation" className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-[640px] lg:max-w-[760px] bg-white border-t border-zana-border flex items-center justify-around px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-30">
      {items.map((item) => {
        const Icon = item.icon;
        const view = item.href.includes('?view=') ? item.href.split('?view=')[1] : null;
        const active = isAgent
          ? currentView === (view || 'overview')
          : pathname === item.href;

        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 px-2 py-1 min-w-0 ${active ? 'text-zana-primary' : 'text-zana-muted'}`}
          >
            <Icon size={19} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[10px]">{t(item.label)}</span>
          </a>
        );
      })}
      <button
        type="button"
        onClick={handleLogout}
        className="flex flex-col items-center gap-1 px-2 py-1 min-w-0 text-red-600 hover:text-red-700"
        aria-label="Sign out of Zana Business"
      >
        <LogOut size={19} />
        <span className="text-[10px]">Sign out</span>
      </button>
    </nav>
  );
}
