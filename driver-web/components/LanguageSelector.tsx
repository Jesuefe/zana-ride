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
export default function LanguageSelector({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);

  const handleSelect = (newLang: Lang) => {
    setLang(newLang);
    setOpen(false);
  };

  const trigger = variant === 'light'
    ? 'flex items-center gap-1.5 text-sm font-medium bg-gray-50 text-gray-700 px-3 py-2 rounded-lg w-full justify-between'
    : 'flex items-center gap-1.5 text-sm font-medium bg-white/20 text-white px-3 py-1.5 rounded-lg backdrop-blur-sm';

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={trigger}>
        <span className="flex items-center gap-1.5">
          <Globe size={14} />
          {LANG_LABELS[lang]}
        </span>
        {variant === 'light' && <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
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
