'use client';

import { Package } from 'lucide-react';

export default function OrdersPage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Orders</h1>
      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className="w-14 h-14 rounded-full bg-zana-primary-light flex items-center justify-center mb-3">
          <Package size={22} className="text-zana-primary" />
        </div>
        <p className="text-sm text-zana-muted">Your ride and delivery history will show up here.</p>
      </div>
    </div>
  );
}
