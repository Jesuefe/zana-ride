'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

type Ctx = {
  choice: ThemeChoice;          // what the user picked
  resolved: 'light' | 'dark';   // what is actually showing
  setChoice: (c: ThemeChoice) => void;
};

const ThemeContext = createContext<Ctx>({
  choice: 'system',
  resolved: 'light',
  setChoice: () => {},
});

const STORAGE_KEY = 'zana_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  // Load the saved preference once on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setChoiceState(saved);
      }
    } catch {}
  }, []);

  // Resolve the choice against the OS setting, and keep following it
  // while the user is on "system".
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const next: 'light' | 'dark' =
        choice === 'system' ? (mq.matches ? 'dark' : 'light') : choice;
      setResolved(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.style.colorScheme = next;
    };

    apply();

    // Only track the OS while the user hasn't overridden it.
    if (choice === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [choice]);

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ choice, resolved, setChoice }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
