'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { useLang } from '../../lib/LangContext';

export default function MarketShopPage() {
  const { t } = useLang();
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#F6F8F7]">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur">
        <button onClick={() => router.back()} aria-label={t('Go back')} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800">
          <ArrowLeft size={19} />
        </button>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#00A082]">ZANA MARKETPLACE</p>
          <h1 className="text-xl font-black tracking-tight text-gray-900">{t('Market & Shop')}</h1>
        </div>
      </header>

      <section className="px-4 pt-6">
        <div className="relative overflow-hidden rounded-[28px] bg-[#073F36] p-6 text-white shadow-lg shadow-emerald-950/10">
          <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full border-[22px] border-white/5" />
          <div className="absolute -right-1 bottom-[-34px] h-32 w-32 rounded-full bg-[#00A082]/30 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">
              <ShoppingBag size={12} /> ZANA SHOPPING
            </span>
            <h2 className="mt-5 max-w-[290px] text-[28px] font-black leading-[1.08] tracking-tight">{t('Everything you need, nearby.')}</h2>
            <p className="mt-3 max-w-[300px] text-sm leading-relaxed text-emerald-50/75">{t('Shop from local markets and stores in one place.')}</p>
            <button
              onClick={() => router.push('/shop/browse')}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-extrabold text-[#06483D] transition-transform active:scale-[0.98]"
            >
              {t('Browse Local Shops')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
