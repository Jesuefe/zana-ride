'use client';

import { useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { COUNTRIES, Country } from '../lib/countries';

/**
 * A tap target showing the current flag and dial code; tapping opens a
 * searchable sheet. Search matches the country name or the digits, so typing
 * "254" finds Kenya as fast as typing "Ken".
 */
export default function CountryCodePicker({
  value,
  onChange,
}: {
  value: Country;
  onChange: (c: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = COUNTRIES.filter(c => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.dial.includes(q);
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border border-zana-border rounded-lg px-3 h-full text-sm shrink-0"
      >
        <span className="text-base leading-none">{value.flag}</span>
        <span className="font-semibold">+{value.dial}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl max-h-[75vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4 shrink-0" />

            <div className="px-4 pb-3 shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3.5 py-2.5">
                <Search size={15} className="text-gray-400 shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search country or code"
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div className="overflow-y-auto pb-8">
              {filtered.map(c => (
                <button
                  key={c.code}
                  onClick={() => { onChange(c); setOpen(false); setQuery(''); }}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50"
                >
                  <span className="text-xl">{c.flag}</span>
                  <span className="flex-1 text-left text-sm font-semibold text-gray-900">{c.name}</span>
                  <span className="text-sm text-gray-400">+{c.dial}</span>
                  {c.code === value.code && <Check size={16} className="text-zana-primary" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No match</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
