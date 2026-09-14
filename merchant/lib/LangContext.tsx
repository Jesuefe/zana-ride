'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang, getStoredLang, setStoredLang, UI } from './lang';
import { api } from './api/client';

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
    // Same endpoint the customer and driver apps use — it just updates the
    // User row, which a merchant account has too, so nothing new was
    // needed on the backend for this.
    api.patch('/users/language', { language: newLang }).catch(() => {});
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
