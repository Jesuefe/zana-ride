'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Home, ShoppingBag, Truck, Wallet } from 'lucide-react';
import { useLang } from '../lib/LangContext';

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
  const { t } = useLang();

  const isAgent = pathname === '/agent' || pathname.startsWith('/agent/');
  const items = isAgent ? agentItems : merchantItems;
  const currentView = searchParams.get('view') || 'overview';

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-[640px] lg:max-w-[760px] bg-white border-t border-zana-border flex items-center justify-around py-2 z-30">
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
            className={`flex flex-col items-center gap-1 px-3 py-1 ${active ? 'text-zana-primary' : 'text-zana-muted'}`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[11px]">{t(item.label)}</span>
          </a>
        );
      })}
    </nav>
  );
}
