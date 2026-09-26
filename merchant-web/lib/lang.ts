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

  'Overview': { en: 'Overview', fr: 'Vue d’ensemble', rw: 'Incamake' },
  'Today’s orders': { en: 'Today’s orders', fr: 'Commandes du jour', rw: 'Ibyatumijwe uyu munsi' },
  'Deliveries': { en: 'Deliveries', fr: 'Livraisons', rw: 'Ibigezwa' },
  'Today’s items': { en: 'Today’s items', fr: 'Articles du jour', rw: 'Ibicuruzwa by’uyu munsi' },
  'Agent wallet': { en: 'Agent wallet', fr: 'Portefeuille de l’agent', rw: 'Umufuka w’umukozi' },
  'Agent earnings': { en: 'Agent earnings', fr: 'Gains de l’agent', rw: 'Amafaranga umukozi yinjije' },
  'Available balance': { en: 'Available balance', fr: 'Solde disponible', rw: 'Amafaranga ahari' },
  'Total earnings': { en: 'Total earnings', fr: 'Gains totaux', rw: 'Amafaranga yose yinjijwe' },
  'Purchasing funds': { en: 'Purchasing funds', fr: 'Fonds d’achat', rw: 'Amafaranga yo kugura' },
  'Authorized': { en: 'Authorized', fr: 'Autorisé', rw: 'Yemejwe' },
  'Withdrawn': { en: 'Withdrawn', fr: 'Retiré', rw: 'Yakuweho' },
  'Actual spend': { en: 'Actual spend', fr: 'Dépense réelle', rw: 'Amafaranga yakoreshejwe' },
  'Customer refund': { en: 'Customer refund', fr: 'Remboursement client', rw: 'Amafaranga asubijwe umukiriya' },
  'Agent debit': { en: 'Agent debit', fr: 'Débit de l’agent', rw: 'Amafaranga akatwa umukozi' },
  'Withdraw': { en: 'Withdraw', fr: 'Retirer', rw: 'Kura amafaranga' },
  'Start shopping': { en: 'Start shopping', fr: 'Commencer les achats', rw: 'Tangira guhaha' },
  'Mark ready for pickup': { en: 'Mark ready for pickup', fr: 'Prêt pour retrait', rw: 'Shyira ku mwanya wo gufatwa' },
  'Ready for rider': { en: 'Ready for rider', fr: 'Prêt pour le coursier', rw: 'Biteguye umukozi ubigeza' },
  'Customer': { en: 'Customer', fr: 'Client', rw: 'Umukiriya' },
  'Location': { en: 'Location', fr: 'Localisation', rw: 'Aho aherereye' },
  'Latitude / Longitude': { en: 'Latitude / Longitude', fr: 'Latitude / Longitude', rw: 'Latitude / Longitude' },
  'Open in Maps': { en: 'Open in Maps', fr: 'Ouvrir dans Maps', rw: 'Fungura muri Maps' },
  'Registered number': { en: 'Registered number', fr: 'Numéro enregistré', rw: 'Numero yanditswe' },
  'Refunded to customer': { en: 'Refunded to customer', fr: 'Remboursé au client', rw: 'Yasubijwe umukiriya' },
  'Recovered from agent': { en: 'Recovered from agent', fr: 'Récupéré auprès de l’agent', rw: 'Yakuwe ku mukozi' },
  'Rider handoff': { en: 'Rider handoff', fr: 'Remise au coursier', rw: 'Guha umukozi ubigeza' },
  'Waiting for rider': { en: 'Waiting for rider', fr: 'En attente du coursier', rw: 'Gutegereza ubigeza' },
  'Picked up': { en: 'Picked up', fr: 'Retiré', rw: 'Byafashwe' },
  'Delivered': { en: 'Delivered', fr: 'Livré', rw: 'Byagejejwe' },
  'Language': { en: 'Language', fr: 'Langue', rw: 'Ururimi' },

};

export function t(key: string, lang: Lang): string {
  return UI[key]?.[lang] ?? key;
}
  'Refresh': { en: 'Refresh', fr: 'Actualiser', rw: 'Ongera usubiremo' },
  'Today’s sales': { en: 'Today’s sales', fr: 'Ventes du jour', rw: 'Ibyagurishijwe uyu munsi' },
  'Pending shopping': { en: 'Pending shopping', fr: 'Achats en attente', rw: 'Ibitegereje kugurwa' },
  'Shopping now': { en: 'Shopping now', fr: 'Achats en cours', rw: 'Birimo kugurwa' },
  'Ready for pickup': { en: 'Ready for pickup', fr: 'Prêt à être retiré', rw: 'Biteguye gufatwa' },
  'View all': { en: 'View all', fr: 'Voir tout', rw: 'Reba byose' },
  'Open any order for the complete receipt and timeline.': { en: 'Open any order for the complete receipt and timeline.', fr: 'Ouvrez une commande pour voir le reçu et la chronologie complète.', rw: 'Fungura icyo wifuza kureba inyemezabuguzi n’amateka yose.' },
  'Item issues': { en: 'Item issues', fr: 'Problèmes d’article', rw: 'Ibibazo by’ibicuruzwa' },
  'Orders today': { en: 'Orders today', fr: 'Commandes du jour', rw: 'Ibyatumijwe uyu munsi' },
  'Shop, resolve unavailable items and prepare packages for pickup.': { en: 'Shop, resolve unavailable items and prepare packages for pickup.', fr: 'Achetez, gérez les articles indisponibles et préparez les colis.', rw: 'Gura, kora ku bicuruzwa bidahari kandi utegure ibyo gutwara.' },
  'Packages a Zana rider has been assigned to or has picked up from your market.': { en: 'Packages a Zana rider has been assigned to or has picked up from your market.', fr: 'Colis attribués à un coursier Zana ou déjà retirés de votre marché.', rw: 'Ibicuruzwa byahawe cyangwa byafashwe n’umukozi wa Zana ku isoko ryawe.' },
  'What you can physically source at the market today.': { en: 'What you can physically source at the market today.', fr: 'Ce que vous pouvez réellement trouver au marché aujourd’hui.', rw: 'Ibyo ushobora kubona ku isoko uyu munsi.' },
  'List item': { en: 'List item', fr: 'Ajouter un article', rw: 'Shyiraho igicuruzwa' },
  'Add to today’s list': { en: 'Add to today’s list', fr: 'Ajouter à la liste du jour', rw: 'Ongeraho ku rutonde rw’uyu munsi' },
  'Recent wallet activity': { en: 'Recent wallet activity', fr: 'Activité récente du portefeuille', rw: 'Ibikorwa biheruka ku mufuka' },

