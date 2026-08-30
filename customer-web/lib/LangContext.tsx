'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang, getStoredLang, setStoredLang, LANG_LABELS, UI } from './lang';
import { updateLanguage } from './api/chat';

type LangContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    setLangState(getStoredLang());
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    setStoredLang(newLang);
    updateLanguage(newLang).catch(() => {});
  };

  const t = (key: string) => UI[key]?.[lang] ?? key;

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
