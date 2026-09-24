'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Lang, getStoredLang, setStoredLang, UI, DRIVER_UI } from './lang';
import { getToken } from './api/client';

type LangContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  dt: (key: string) => string;
};

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
  dt: (key) => key,
});

export function LangProvider({ children }: { children: ReactNode }) {
  // Resolve the cached/browser language during the first client render so
  // the app does not briefly render English before restoring the preference.
  const [lang, setLangState] = useState<Lang>(() => getStoredLang(getToken()));

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    setStoredLang(newLang, getToken());
  };

  const t = (key: string) => UI[key]?.[lang] ?? key;
  const dt = (key: string) => DRIVER_UI[key]?.[lang] ?? UI[key]?.[lang] ?? key;

  return (
    <LangContext.Provider value={{ lang, setLang, t, dt }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
