'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PackagePlus, PackageSearch, Wallet, Package, ShoppingBag } from 'lucide-react';
import { fetchMyMerchant, ApiMerchant } from '../lib/api/merchant';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/new-delivery', label: 'New Delivery', icon: PackagePlus },
  { href: '/deliveries', label: 'Deliveries', icon: PackageSearch },
  { href: '/products', label: 'My Products', icon: Package },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [merchant, setMerchant] = useState<ApiMerchant | null>(null);

  useEffect(() => {
    fetchMyMerchant()
      .then(setMerchant)
      .catch(() => {});
  }, []);

  return (
    <aside className="w-60 shrink-0 bg-gray-900 text-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-zana-secondary flex items-center justify-center font-extrabold text-gray-900">
            Z
          </div>
          <span className="font-bold tracking-wide">Zana Business</span>
        </div>
        {merchant && (
          <>
            <p className="text-xs text-white/50 mt-2">{merchant.businessName}</p>
            {merchant.branch && <p className="text-xs text-white/40">{merchant.branch}</p>}
          </>
        )}
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? 'bg-white/15 font-semibold' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-white/50 border-t border-white/10">
        Zana Business · v1.0
      </div>
    </aside>
  );
}
