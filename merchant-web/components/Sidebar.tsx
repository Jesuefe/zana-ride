'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PackagePlus, PackageSearch, Wallet, Package, ShoppingBag, Menu, X, LogOut } from 'lucide-react';
import { clearToken } from '../lib/api/client';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { clearToken(); router.push('/login'); };

  const NavContent = () => (
    <>
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zana-primary rounded-lg flex items-center justify-center font-black text-white text-lg">Z</div>
          <span className="font-bold text-white text-sm">Zana Business</span>
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${active ? 'bg-zana-primary text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-4 text-sm text-gray-400 hover:text-white border-t border-gray-800">
        <LogOut size={16} /> Sign out
      </button>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-zana-primary rounded-lg flex items-center justify-center font-black text-white">Z</div>
          <span className="font-bold text-white text-sm">Zana Business</span>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-white">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-56 bg-gray-900 flex flex-col h-full pt-14">
            <NavContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-gray-900 flex-col h-full min-h-screen">
        <NavContent />
      </aside>

      {/* Mobile spacer */}
      <div className="md:hidden h-12" />
    </>
  );
}
