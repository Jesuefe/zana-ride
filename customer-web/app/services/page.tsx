'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { SERVICES } from '../../lib/services';

/**
 * Every Zana service in one grid. The home row only fits what scrolls into
 * view — this is the actual "see all" the button name promised.
 */
export default function ServicesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white pb-10">
      <div className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center"
        >
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-black text-gray-900">All services</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 px-4 pt-2">
        {SERVICES.map(s => (
          <button
            key={s.id}
            onClick={() => router.push(s.route)}
            className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{ background: s.bg }}
            >
              <Image src={s.image} alt={s.title} width={44} height={44} className="object-contain" />
            </div>
            <p className="text-[11px] font-bold text-gray-900 text-center leading-tight">{s.title}</p>
            <p className="text-[9px] text-gray-400 text-center leading-tight -mt-1">{s.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
