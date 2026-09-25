import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Lang = 'en' | 'fr' | 'rw';

// Navigation phrases are translated via a hardcoded map — navigation vocabulary
// is limited and repetitive, so this is faster, cheaper, and more reliable than
// an API call for every turn instruction.
const NAV_PHRASES: Record<string, Record<Lang, string>> = {
  'Turn left': { en: 'Turn left', fr: 'Tournez à gauche', rw: 'Hinduka ibumoso' },
  'Turn right': { en: 'Turn right', fr: 'Tournez à droite', rw: 'Hinduka iburyo' },
  'Continue straight': { en: 'Continue straight', fr: 'Continuez tout droit', rw: 'Komeza imbere' },
  'Slight left': { en: 'Slight left', fr: 'Légèrement à gauche', rw: 'Gato ibumoso' },
  'Slight right': { en: 'Slight right', fr: 'Légèrement à droite', rw: 'Gato iburyo' },
  'Sharp left': { en: 'Sharp left', fr: 'Virage serré à gauche', rw: 'Hinduka cyane ibumoso' },
  'Sharp right': { en: 'Sharp right', fr: 'Virage serré à droite', rw: 'Hinduka cyane iburyo' },
  'U-turn': { en: 'U-turn', fr: 'Demi-tour', rw: 'Garuka inyuma' },
  'Keep left': { en: 'Keep left', fr: 'Restez à gauche', rw: 'Komeza ibumoso' },
  'Keep right': { en: 'Keep right', fr: 'Restez à droite', rw: 'Komeza iburyo' },
  'Enter roundabout': { en: 'Enter roundabout', fr: 'Entrez dans le rond-point', rw: 'Injira mu cyunguruzo' },
  'Exit roundabout': { en: 'Exit roundabout', fr: 'Quittez le rond-point', rw: 'Sohoka mu cyunguruzo' },
  'You have arrived': { en: 'You have arrived', fr: 'Vous êtes arrivé', rw: 'Wageze aho ujya' },
  'Destination ahead': { en: 'Destination ahead', fr: 'Destination proche', rw: 'Intego iri imbere' },
  'Head to pickup': { en: 'Head to pickup', fr: 'Allez au point de ramassage', rw: 'Genda guterura' },
  'Arrived at pickup': { en: 'Arrived at pickup', fr: 'Arrivé au point de ramassage', rw: 'Wageze aho uterura' },
  'Trip started': { en: 'Trip started', fr: 'Trajet commencé', rw: 'Urugendo rutangiye' },
  'Trip completed': { en: 'Trip completed', fr: 'Trajet terminé', rw: 'Urugendo rwarangiye' },
  'Online': { en: 'Online', fr: 'En ligne', rw: 'Uri kumurongo' },
  'Offline': { en: 'Offline', fr: 'Hors ligne', rw: 'Nturi kumurongo' },
  'Searching for driver': { en: 'Searching for driver', fr: 'Recherche d\'un chauffeur', rw: 'Gushakisha umushoferi' },
  'Driver assigned': { en: 'Driver assigned', fr: 'Chauffeur assigné', rw: 'Umushoferi abonetse' },
  'Driver arriving': { en: 'Driver arriving', fr: 'Chauffeur en route', rw: 'Umushoferi araza' },
  'Driver arrived': { en: 'Driver arrived', fr: 'Chauffeur arrivé', rw: 'Umushoferi arashe' },
  'Cancel ride': { en: 'Cancel ride', fr: 'Annuler le trajet', rw: 'Hagarika urugendo' },
  'in': { en: 'in', fr: 'dans', rw: 'mu' },
  'meters': { en: 'meters', fr: 'mètres', rw: 'metero' },
  'km': { en: 'km', fr: 'km', rw: 'km' },
  'minutes': { en: 'minutes', fr: 'minutes', rw: 'iminota' },
  'Earnings': { en: 'Earnings', fr: 'Revenus', rw: 'Inyungu' },
  'Rides': { en: 'Rides', fr: 'Trajets', rw: 'Ingendo' },
  'Deliveries': { en: 'Deliveries', fr: 'Livraisons', rw: 'Kohereza' },
  'Go Online': { en: 'Go Online', fr: 'Se connecter', rw: 'Injira kumurongo' },
  'Go Offline': { en: 'Go Offline', fr: 'Se déconnecter', rw: 'Sohoka kumurongo' },
  'Accept': { en: 'Accept', fr: 'Accepter', rw: 'Emera' },
  'Decline': { en: 'Decline', fr: 'Refuser', rw: 'Ima' },
  'I\'ve Arrived': { en: 'I\'ve Arrived', fr: 'Je suis arrivé', rw: 'Nashe' },
  'Start Trip': { en: 'Start Trip', fr: 'Démarrer le trajet', rw: 'Tangira urugendo' },
  'Complete Trip': { en: 'Complete Trip', fr: 'Terminer le trajet', rw: 'Rangiza urugendo' },
  'Chat': { en: 'Chat', fr: 'Discussion', rw: 'Ganira' },
  'Send': { en: 'Send', fr: 'Envoyer', rw: 'Ohereza' },
  'Type a message': { en: 'Type a message', fr: 'Écrivez un message', rw: 'Andika ubutumwa' },
  'Language': { en: 'Language', fr: 'Langue', rw: 'Ururimi' },
  'English': { en: 'English', fr: 'Anglais', rw: 'Icyongereza' },
  'French': { en: 'French', fr: 'Français', rw: 'Igifaransa' },
  'Kinyarwanda': { en: 'Kinyarwanda', fr: 'Kinyarwanda', rw: 'Ikinyarwanda' },
};

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(private config: ConfigService) {}

  private get apiKey() {
    return this.config.get<string>('GOOGLE_TRANSLATE_API_KEY') ?? '';
  }

  // Translates a navigation phrase using the hardcoded map.
  // Falls back to the original text if the phrase isn't found.
  translateNav(phrase: string, lang: Lang): string {
    const entry = NAV_PHRASES[phrase];
    if (entry) return entry[lang];

    // Try partial match for phrases like "Turn left onto KG 11 Ave"
    for (const [key, translations] of Object.entries(NAV_PHRASES)) {
      if (phrase.toLowerCase().startsWith(key.toLowerCase())) {
        const rest = phrase.slice(key.length);
        return translations[lang] + rest;
      }
    }
    return phrase;
  }

  // Translates arbitrary text via Google Translate API.
  async translate(text: string, targetLang: Lang, sourceLang?: Lang): Promise<string> {
    if (!text.trim()) return text;
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_TRANSLATE_API_KEY not set — returning original text');
      return text;
    }

    // Map our lang codes to Google's
    const langMap: Record<Lang, string> = { en: 'en', fr: 'fr', rw: 'rw' };

    try {
      const params = new URLSearchParams({
        q: text,
        target: langMap[targetLang],
        key: this.apiKey,
        format: 'text',
        ...(sourceLang ? { source: langMap[sourceLang] } : {}),
      });

      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?${params}`);
      if (!res.ok) throw new Error(`Translate API error: ${res.status}`);
      const data = await res.json() as any;
      return data.data?.translations?.[0]?.translatedText ?? text;
    } catch (err) {
      this.logger.error(`Translation failed: ${err}`);
      return text;
    }
  }

  // Translates a message into all three languages at once.
  async translateAll(text: string, sourceLang: Lang): Promise<{ en: string; fr: string; rw: string }> {
    const langs: Lang[] = ['en', 'fr', 'rw'];
    const results = await Promise.all(
      langs.map(lang =>
        lang === sourceLang ? Promise.resolve(text) : this.translate(text, lang, sourceLang)
      )
    );
    return { en: results[0], fr: results[1], rw: results[2] };
  }

  getPhrase(key: string, lang: Lang): string {
    return NAV_PHRASES[key]?.[lang] ?? key;
  }

  getAllPhrases(lang: Lang): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, translations] of Object.entries(NAV_PHRASES)) {
      result[key] = translations[lang];
    }
    return result;
  }
}
