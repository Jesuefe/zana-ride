'use client';

import { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { Lang, LANG_LABELS, getStoredLang, setStoredLang } from '../lib/lang';
import { updateLanguage } from '../lib/api/chat';

const LANGS: Lang[] = ['en', 'fr', 'rw'];

export default function LanguageSelector({ onChange }: { onChange?: (lang: Lang) => void }) {
  const [current, setCurrent] = useState<Lang>(getStoredLang());
  const [open, setOpen] = useState(false);

  const handleSelect = async (lang: Lang) => {
    setCurrent(lang);
    setStoredLang(lang);
    setOpen(false);
    onChange?.(lang);
    // Persist to backend so messages arrive pre-translated.
    updateLanguage(lang).catch(() => {});
    // Reload page so all UI text reflects the new language immediately.
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg"
      >
        <Globe size={14} />
        {LANG_LABELS[current]}
      </button>
      {open && (
        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 w-44">
          {LANGS.map(lang => (
            <button
              key={lang}
              onClick={() => handleSelect(lang)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 text-left"
            >
              <span className={current === lang ? 'font-semibold text-zana-primary' : 'text-gray-700'}>
                {LANG_LABELS[lang]}
              </span>
              {current === lang && <Check size={14} className="text-zana-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
