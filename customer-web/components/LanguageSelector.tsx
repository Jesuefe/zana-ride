'use client';

import { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { Lang, LANG_LABELS } from '../lib/lang';
import { useLang } from '../lib/LangContext';

const LANGS: Lang[] = ['en', 'fr', 'rw'];

export default function LanguageSelector() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);

  const handleSelect = (newLang: Lang) => {
    setLang(newLang);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-medium bg-white/20 text-white px-3 py-1.5 rounded-lg backdrop-blur-sm"
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
