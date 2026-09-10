// A curated list rather than the full ISO set — every country Zana's actual
// visitors are likely to carry a SIM from, plus the near neighbours. Kept
// deliberately short so it's a fast scroll on a phone, not a 200-item list.
export type Country = { code: string; dial: string; flag: string; name: string; minDigits: number; maxDigits: number };

export const COUNTRIES: Country[] = [
  { code: 'RW', dial: '250', flag: '🇷🇼', name: 'Rwanda',        minDigits: 9,  maxDigits: 9  },
  { code: 'UG', dial: '256', flag: '🇺🇬', name: 'Uganda',        minDigits: 9,  maxDigits: 9  },
  { code: 'KE', dial: '254', flag: '🇰🇪', name: 'Kenya',         minDigits: 9,  maxDigits: 9  },
  { code: 'TZ', dial: '255', flag: '🇹🇿', name: 'Tanzania',      minDigits: 9,  maxDigits: 9  },
  { code: 'BI', dial: '257', flag: '🇧🇮', name: 'Burundi',       minDigits: 8,  maxDigits: 8  },
  { code: 'CD', dial: '243', flag: '🇨🇩', name: 'DR Congo',      minDigits: 9,  maxDigits: 9  },
  { code: 'NG', dial: '234', flag: '🇳🇬', name: 'Nigeria',       minDigits: 10, maxDigits: 10 },
  { code: 'GH', dial: '233', flag: '🇬🇭', name: 'Ghana',         minDigits: 9,  maxDigits: 9  },
  { code: 'ZA', dial: '27',  flag: '🇿🇦', name: 'South Africa',  minDigits: 9,  maxDigits: 9  },
  { code: 'ET', dial: '251', flag: '🇪🇹', name: 'Ethiopia',      minDigits: 9,  maxDigits: 9  },
  { code: 'GB', dial: '44',  flag: '🇬🇧', name: 'United Kingdom',minDigits: 10, maxDigits: 10 },
  { code: 'US', dial: '1',   flag: '🇺🇸', name: 'United States', minDigits: 10, maxDigits: 10 },
  { code: 'FR', dial: '33',  flag: '🇫🇷', name: 'France',        minDigits: 9,  maxDigits: 9  },
  { code: 'BE', dial: '32',  flag: '🇧🇪', name: 'Belgium',       minDigits: 8,  maxDigits: 9  },
  { code: 'IN', dial: '91',  flag: '🇮🇳', name: 'India',         minDigits: 10, maxDigits: 10 },
  { code: 'AE', dial: '971', flag: '🇦🇪', name: 'UAE',           minDigits: 9,  maxDigits: 9  },
  { code: 'CN', dial: '86',  flag: '🇨🇳', name: 'China',         minDigits: 11, maxDigits: 11 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Rwanda — where almost every rider and driver is
