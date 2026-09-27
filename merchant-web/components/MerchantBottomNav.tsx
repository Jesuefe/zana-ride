'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, ShoppingBag, Truck, Wallet } from 'lucide-react';
import { useLang } from '../lib/LangContext';

const merchantTabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/deliveries', label: 'Deliveries', icon: Truck },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
];

const agentTabs = [
  { href: '/agent?view=overview', label: 'Home', icon: Home },
  { href: '/agent?view=orders', label: 'Orders', icon: ShoppingBag },
  { href: '/agent?view=deliveries', label: 'Deliveries', icon: Truck },
  { href: '/agent?view=wallet', label: 'Wallet', icon: Wallet },
];

export default function MerchantBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();
  const agent = pathname.startsWith('/agent');
  const tabs = agent ? agentTabs : merchantTabs;
  const [agentView, setAgentView] = useState('overview');

  useEffect(() => {
    if (!agent) return;
    const sync = () => setAgentView(new URLSearchParams(window.location.search).get('view') || 'overview');
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [agent]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white safe-area-pb">
      <div className="mx-auto flex w-full max-w-[480px]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const view = href.split('=')[1];
          const active = agent
            ? agentView === view
            : href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <button
              key={href}
              type="button"
              onClick={() => {
                if (agent) setAgentView(view);
                router.push(href);
              }}
              className="relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 transition-colors"
              aria-current={active ? 'page' : undefined}
            >
              {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-zana-primary" />}
              <Icon size={21} strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-zana-primary' : 'text-gray-400'} />
              <span className={active ? 'text-[10px] font-medium text-zana-primary' : 'text-[10px] font-semibold text-gray-400'}>
                {t(label)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
