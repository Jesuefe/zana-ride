'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin, Store, ShoppingBasket } from 'lucide-react';
import { useLang } from '../../lib/LangContext';

export default function MarketShopPage() {
  const { t } = useLang();
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#F6F8F7] pb-12">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur">
        <button onClick={() => router.back()} aria-label={t('Go back')} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800">
          <ArrowLeft size={19} />
        </button>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#00A082]">ZANA MARKETPLACE</p>
          <h1 className="text-xl font-black tracking-tight text-gray-900">{t('Market & Shop')}</h1>
        </div>
      </header>

      <section className="px-4 pt-5">
        <button
          onClick={() => router.push('/market')}
          className="group relative block w-full overflow-hidden rounded-[28px] bg-[#073F36] p-5 text-left text-white shadow-lg shadow-emerald-950/10"
        >
          <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full border-[22px] border-white/5" />
          <div className="absolute -right-1 bottom-[-34px] h-32 w-32 rounded-full bg-[#00A082]/30 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">
              <MapPin size={11} /> {t('Around you')}
            </span>
            <div className="mt-5 flex items-end justify-between gap-3">
              <div className="max-w-[250px]">
                <h2 className="text-[26px] font-black leading-[1.08] tracking-tight">{t('Buy from your local market')}</h2>
                <p className="mt-2 text-sm leading-relaxed text-emerald-50/75">{t('Explore nearby markets and get fresh everyday essentials delivered to you.')}</p>
              </div>
              <span className="mb-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFC244] text-[#173E35] shadow-md">
                <ShoppingBasket size={27} strokeWidth={1.8} />
              </span>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-extrabold text-[#06483D] transition-transform group-active:scale-[0.98]">
              {t('Explore local markets')} <ArrowRight size={16} />
            </span>
          </div>
        </button>

        <div className="mb-3 mt-8">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#00A082]">{t('More ways to shop')}</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-gray-900">{t('Shop from local stores')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('Browse products from stores and merchants near you.')}</p>
        </div>

        <button
          onClick={() => router.push('/shop')}
          className="flex w-full items-center gap-4 rounded-[24px] border border-gray-100 bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E8F6F1] text-[#00866F]">
            <Store size={26} strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-base font-extrabold text-gray-900">{t('Browse local shops')}</strong>
            <span className="mt-1 block text-xs leading-relaxed text-gray-500">{t('Find groceries, household goods and everyday essentials.')}</span>
          </span>
          <ArrowRight size={19} className="shrink-0 text-gray-400" />
        </button>
      </section>
    </main>
  );
}
