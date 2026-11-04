'use client';

import { Sun, Moon, Smartphone } from 'lucide-react';
import { useTheme, ThemeChoice } from '../lib/ThemeContext';

const OPTIONS: { id: ThemeChoice; label: string; icon: React.ReactNode; sub: string }[] = [
  { id: 'light',  label: 'Light',  icon: <Sun size={16} />,        sub: 'Always light' },
  { id: 'dark',   label: 'Dark',   icon: <Moon size={16} />,       sub: 'Always dark' },
  { id: 'system', label: 'Auto',   icon: <Smartphone size={16} />, sub: 'Match phone' },
];

export default function ThemePicker() {
  const { choice, setChoice } = useTheme();

  return (
    <div>
      <p id="zana-appearance-label" className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Appearance</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="zana-appearance-label">
        {OPTIONS.map(o => (
          <button
            key={o.id}
            onClick={() => setChoice(o.id)}
            aria-pressed={choice === o.id}
            className={`flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zana-primary focus-visible:ring-offset-2 ${
              choice === o.id
                ? 'border-zana-primary bg-zana-primary-light shadow-sm'
                : 'border-gray-100 bg-white hover:border-zana-primary/40'
            }`}
          >
            <span className={choice === o.id ? 'text-zana-primary' : 'text-gray-400'}>
              {o.icon}
            </span>
            <span className={`text-xs font-bold ${choice === o.id ? 'text-zana-primary' : 'text-gray-700'}`}>
              {o.label}
            </span>
            <span className="text-[9px] text-gray-400 leading-none">{o.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
