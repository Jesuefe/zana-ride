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
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Appearance</p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(o => (
          <button
            key={o.id}
            onClick={() => setChoice(o.id)}
            className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border-2 transition-all ${
              choice === o.id
                ? 'border-zana-primary bg-zana-primary-light'
                : 'border-gray-100 bg-white'
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
