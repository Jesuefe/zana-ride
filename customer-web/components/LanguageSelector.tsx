'use client';

import { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { Lang, LANG_LABELS } from '../lib/lang';
import { useLang } from '../lib/LangContext';

const LANGS: Lang[] = ['en', 'fr', 'rw'];

export default function LanguageSelector({ variant = 'dark' }: { variant?: 'dark' | 'light' | 'floating' }) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);

  const handleSelect = (newLang: Lang) => {
    setLang(newLang);
    setOpen(false);
  };

  if (variant === 'floating') {
    return (
      <div className="fixed top-4 right-4 z-[100]">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={t('Change language')}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-zana-primary shadow-lg transition-transform active:scale-95"
        >
          <Globe size={18} />
          <span className="absolute -bottom-1 -right-1 min-w-[20px] rounded-full bg-zana-primary px-1 py-0.5 text-[9px] font-bold leading-none text-white">
            {lang.toUpperCase()}
          </span>
        </button>
        {open && (
          <div className="absolute right-0 top-14 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
            {LANGS.map(l => (
              <button
                key={l}
                onClick={() => handleSelect(l)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-gray-50"
              >
                <span className={lang === l ? 'font-semibold text-zana-primary' : 'text-gray-700'}>
                  {LANG_LABELS[l]}
                </span>
                {lang === l && <Check size={14} className="text-zana-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={
          variant === 'light'
            ? 'flex items-center gap-1.5 text-sm font-medium bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg'
            : 'flex items-center gap-1.5 text-sm font-medium bg-white/20 text-white px-3 py-1.5 rounded-lg backdrop-blur-sm'
        }
      >
        <Globe size={14} />
        {LANG_LABELS[lang]}
      </button>
      {open && (
        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 w-44">
          {LANGS.map(l => (
            <button
              key={l}
              onClick={() => handleSelect(l)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 text-left"
            >
              <span className={lang === l ? 'font-semibold text-zana-primary' : 'text-gray-700'}>
                {LANG_LABELS[l]}
              </span>
              {lang === l && <Check size={14} className="text-zana-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
