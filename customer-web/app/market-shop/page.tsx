'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ShoppingBag, ShoppingBasket, Store } from 'lucide-react';
import { useLang } from '../../lib/LangContext';

export default function MarketShopPage() {
  const { t } = useLang();
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#F6F8F7] pb-24">
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
          </div>
        </div>
      </section>

      <section className="space-y-3 px-4 pt-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#00A082]">{t('SHOP LOCAL')}</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-gray-900">{t('Where would you like to shop?')}</h2>
          </div>
        </div>

        <button
          onClick={() => router.push('/market')}
          className="flex w-full items-center gap-4 rounded-[24px] border border-gray-100 bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF5D9] text-[#9B6A00]">
            <ShoppingBasket size={27} strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-base font-extrabold text-gray-900">{t('Local Markets')}</strong>
            <span className="mt-1 block text-xs leading-relaxed text-gray-500">{t('Fresh produce and everyday market essentials.')}</span>
          </span>
          <ArrowRight size={19} className="shrink-0 text-gray-400" />
        </button>

        <button
          onClick={() => router.push('/shop')}
          className="flex w-full items-center gap-4 rounded-[24px] border border-gray-100 bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E8F6F1] text-[#00866F]">
            <Store size={27} strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-base font-extrabold text-gray-900">{t('Local Stores')}</strong>
            <span className="mt-1 block text-xs leading-relaxed text-gray-500">{t('Products from shops and registered merchants near you.')}</span>
          </span>
          <ArrowRight size={19} className="shrink-0 text-gray-400" />
        </button>
      </section>
    </main>
  );
}
