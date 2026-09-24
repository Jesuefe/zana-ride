'use client';

import { useState } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { Lang, LANG_LABELS } from '../lib/lang';
import { useLang } from '../lib/LangContext';

const LANGS: Lang[] = ['en', 'fr', 'rw'];

/**
 * 'dark' fits a colored/dark background (a header banner, a brand sidebar).
 * 'light' fits sitting directly on a white surface — a drawer, a card.
 */
export default function LanguageSelector({ variant = 'dark' }: { variant?: 'dark' | 'light' | 'floating' }) {
  const { lang, setLang, dt } = useLang();
  const [open, setOpen] = useState(false);

  const handleSelect = (newLang: Lang) => {
    setLang(newLang);
    setOpen(false);
  };

  const trigger = variant === 'light'
    ? 'flex items-center gap-1.5 text-sm font-medium bg-gray-50 text-gray-700 px-3 py-2 rounded-lg w-full justify-between'
    : variant === 'floating'
      ? 'zana-language-floating relative flex items-center justify-center w-11 h-11 rounded-full bg-white text-zana-primary shadow-lg border border-gray-100 hover:scale-105 active:scale-95 transition-transform'
      : 'flex items-center gap-1.5 text-sm font-medium bg-white/20 text-white px-3 py-1.5 rounded-lg backdrop-blur-sm';

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={trigger}>
        <span className="flex items-center gap-1.5">
          <Globe size={14} />
          {variant === 'floating' ? <span className="sr-only">{LANG_LABELS[lang]}</span> : LANG_LABELS[lang]}
        </span>
        {variant === 'light' && <ChevronDown size={14} className="text-gray-400" />}
        {variant === 'floating' && <span className="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 px-0.5 rounded-full bg-zana-primary text-white text-[8px] font-black flex items-center justify-center border-2 border-white">{lang.toUpperCase()}</span>}
      </button>
      {open && (
        <div className={`${variant === 'floating' ? 'fixed top-[4.75rem] right-4 w-44' : 'absolute left-0 right-0 top-full mt-1'} bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-[70]`}>
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
