'use client';

export type Lang = 'en' | 'fr' | 'rw';

const STORAGE_KEY = 'zana_lang';

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  fr: 'Français',
  rw: 'Ikinyarwanda',
};

export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  return (localStorage.getItem(STORAGE_KEY) as Lang) ?? 'en';
}

export function setStoredLang(lang: Lang) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, lang);
}

// UI strings for the customer app in all three languages.
export const UI: Record<string, Record<Lang, string>> = {
  'What do you need today?': { en: 'What do you need today?', fr: 'Que voulez-vous aujourd\'hui?', rw: 'Ukeneye iki uyu munsi?' },
  'Wallet Balance': { en: 'Wallet Balance', fr: 'Solde du portefeuille', rw: 'Amafaranga afite' },
  'Top Up': { en: 'Top Up', fr: 'Recharger', rw: 'Shyiramo amafaranga' },
  'Send My Location': { en: 'Send My Location', fr: 'Envoyer ma localisation', rw: 'Ohereza aho ndi' },
  'Share a code instead of explaining your address': { en: 'Share a code instead of explaining your address', fr: 'Partagez un code au lieu d\'expliquer votre adresse', rw: 'Ohereza kode aho gusobanura aho uri' },
  'Orders': { en: 'Orders', fr: 'Commandes', rw: 'Ibyagurijwe' },
  'Wallet': { en: 'Wallet', fr: 'Portefeuille', rw: 'Amafaranga' },
  'Profile': { en: 'Profile', fr: 'Profil', rw: 'Umwirondoro' },
  'Home': { en: 'Home', fr: 'Accueil', rw: 'Ahabanza' },
  'Chat': { en: 'Chat', fr: 'Discussion', rw: 'Ganira' },
  'Send': { en: 'Send', fr: 'Envoyer', rw: 'Ohereza' },
  'Type a message…': { en: 'Type a message…', fr: 'Écrivez un message…', rw: 'Andika ubutumwa…' },
  'Language': { en: 'Language', fr: 'Langue', rw: 'Ururimi' },
};

export function t(key: string, lang: Lang): string {
  return UI[key]?.[lang] ?? key;
}

// Driver-specific UI strings
export const DRIVER_UI: Record<string, Record<Lang, string>> = {
  'Go Online': { en: 'Go Online', fr: 'Se connecter', rw: 'Injira kumurongo' },
  'Go Offline': { en: 'Go Offline', fr: 'Se déconnecter', rw: 'Sohoka kumurongo' },
  'Earnings': { en: 'Earnings', fr: 'Revenus', rw: 'Inyungu' },
  'Today': { en: 'Today', fr: 'Aujourd\'hui', rw: 'Uyu munsi' },
  'All time': { en: 'All time', fr: 'Tout le temps', rw: 'Igihe cyose' },
  'Trips': { en: 'Trips', fr: 'Trajets', rw: 'Ingendo' },
  'Accept': { en: 'Accept', fr: 'Accepter', rw: 'Emera' },
  'Decline': { en: 'Decline', fr: 'Refuser', rw: 'Ima' },
  'I\'ve Arrived': { en: 'I\'ve Arrived', fr: 'Je suis arrivé', rw: 'Nashe' },
  'Start Trip': { en: 'Start Trip', fr: 'Démarrer le trajet', rw: 'Tangira urugendo' },
  'Complete Trip': { en: 'Complete Trip', fr: 'Terminer le trajet', rw: 'Rangiza urugendo' },
  'Heading to pickup': { en: 'Heading to pickup', fr: 'En route vers le client', rw: 'Ngiye guterura' },
  'Waiting for passenger': { en: 'Waiting for passenger', fr: 'En attente du passager', rw: 'Ndinda umugeni' },
  'Trip in progress': { en: 'Trip in progress', fr: 'Trajet en cours', rw: 'Urugendo rurakomeza' },
  'New ride request': { en: 'New ride request', fr: 'Nouvelle demande de trajet', rw: 'Gusaba urugendo gushya' },
  'away': { en: 'away', fr: 'de distance', rw: 'hari' },
  'Fare': { en: 'Fare', fr: 'Tarif', rw: 'Igiciro' },
  'What do you want to receive?': { en: 'What do you want to receive?', fr: 'Que voulez-vous recevoir?', rw: 'Urashaka guhabwa iki?' },
  'Rides only': { en: 'Rides only', fr: 'Trajets seulement', rw: 'Ingendo gusa' },
  'Deliveries only': { en: 'Deliveries only', fr: 'Livraisons seulement', rw: 'Kohereza gusa' },
  'Both': { en: 'Both', fr: 'Les deux', rw: 'Byombi' },
};

export function dt(key: string, lang: Lang): string {
  return DRIVER_UI[key]?.[lang] ?? UI[key]?.[lang] ?? key;
}
