'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin, Store, ShoppingBasket } from 'lucide-react';
import { useLang } from '../../../lib/LangContext';

export default function BrowseShoppingPage() {
  const { t } = useLang();
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#F6F8F7] pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur">
        <button onClick={() => router.back()} aria-label={t('Go back')} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800">
          <ArrowLeft size={19} />
        </button>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#00A082]">ZANA MARKETPLACE</p>
          <h1 className="text-xl font-black tracking-tight text-gray-900">{t('Browse Local Shops')}</h1>
        </div>
      </header>

      <section className="space-y-4 px-4 pt-6">
        <p className="text-sm text-gray-500">{t('Choose where you want to shop.')}</p>

        <button
          onClick={() => router.push('/market')}
          className="flex w-full items-center gap-4 rounded-[24px] border border-gray-100 bg-white p-5 text-left shadow-sm transition-transform active:scale-[0.99]"
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
          className="flex w-full items-center gap-4 rounded-[24px] border border-gray-100 bg-white p-5 text-left shadow-sm transition-transform active:scale-[0.99]"
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
