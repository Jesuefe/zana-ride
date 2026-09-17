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
  return (localStorage.getItem(STORAGE_KEY) as Lang) ?? 'rw';
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
  'You are online': { en: 'You are online', fr: 'Vous êtes en ligne', rw: 'Uri kumurongo' },
  'You are offline': { en: 'You are offline', fr: 'Vous êtes hors ligne', rw: 'Ntabwo uri kumurongo' },
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

// ⚠️ The Kinyarwanda entries below are best-effort machine translations,
// not reviewed by a native speaker — flagged here clearly so whoever
// reviews this knows exactly which block needs a real pass before
// trusting it in front of drivers. The entries above this line (the
// original DRIVER_UI set) were already in the codebase before this and
// are not part of this flag.
export const TRIP_UI: Record<string, Record<Lang, string>> = {
  'Active ride restored': { en: 'Active ride restored', fr: 'Trajet actif restauré', rw: 'Urugendo rukiriho rwagarutse' },
  'Dismiss': { en: 'Dismiss', fr: 'Fermer', rw: 'Funga' },
  'Back from navigation': { en: 'Back from navigation', fr: 'Retour de la navigation', rw: 'Wagarutse uvuye mu nzira' },
  'Ready to continue?': { en: 'Ready to continue?', fr: 'Prêt à continuer?', rw: 'Witeguye gukomeza?' },
  'Pickup': { en: 'Pickup', fr: 'Point de ramassage', rw: 'Aho guterura' },
  'Destination': { en: 'Destination', fr: 'Destination', rw: 'Aho ugiye' },
  'Passenger': { en: 'Passenger', fr: 'Passager', rw: 'Umugenzi' },
  'Get Directions': { en: 'Get Directions', fr: 'Obtenir l\'itinéraire', rw: 'Reba inzira' },
  'Cancel this ride': { en: 'Cancel this ride', fr: 'Annuler ce trajet', rw: 'Kuraho uru rugendo' },
  'Cancel this ride?': { en: 'Cancel this ride?', fr: 'Annuler ce trajet?', rw: 'Kuraho uru rugendo?' },
  'Call passenger': { en: 'Call passenger', fr: 'Appeler le passager', rw: 'Hamagara umugenzi' },
  'Free Call': { en: 'Free Call', fr: 'Appel gratuit', rw: 'Guhamagara ku buntu' },
  'Through Zana — no airtime used': { en: 'Through Zana — no airtime used', fr: 'Via Zana — aucun crédit utilisé', rw: 'Binyuze kuri Zana — nta ma inite akoreshwa' },
  'Call Directly': { en: 'Call Directly', fr: 'Appeler directement', rw: 'Hamagara mu buryo butaziguye' },
  "Using your phone's carrier network": { en: "Using your phone's carrier network", fr: 'Via le réseau de votre opérateur', rw: 'Ukoresheje network ya telefoni yawe' },
  'Tell us why — this goes to the customer and to Zana.': { en: 'Tell us why — this goes to the customer and to Zana.', fr: 'Dites-nous pourquoi — ceci sera envoyé au client et à Zana.', rw: 'Tubwire impamvu — ibi bizajya ku mukiriya no kuri Zana.' },
  'Cancelling…': { en: 'Cancelling…', fr: 'Annulation…', rw: 'Birimo gukurwaho…' },
  'Confirm cancellation': { en: 'Confirm cancellation', fr: 'Confirmer l\'annulation', rw: 'Emeza gukuraho' },
  '⭐ Rate this passenger': { en: '⭐ Rate this passenger', fr: '⭐ Évaluer ce passager', rw: '⭐ Tanga amanota kuri uyu mugenzi' },
  'Ride cancelled': { en: 'Ride cancelled', fr: 'Trajet annulé', rw: 'Urugendo rwahagaritswe' },
  'Back to home': { en: 'Back to home', fr: 'Retour à l\'accueil', rw: 'Subira ahabanza' },
  'Collect payment': { en: 'Collect payment', fr: 'Percevoir le paiement', rw: 'Akira ubwishyu' },
  "Customer's MoMo number": { en: "Customer's MoMo number", fr: 'Numéro Mobile Money du client', rw: 'Numero ya MoMo y\'umukiriya' },
  'Send prompt again': { en: 'Send prompt again', fr: 'Renvoyer la demande', rw: 'Ohereza ubutumwa nanone' },
  'Send payment request': { en: 'Send payment request', fr: 'Envoyer la demande de paiement', rw: 'Ohereza icyifuzo cy\'ubwishyu' },
  'Collect cash instead': { en: 'Collect cash instead', fr: 'Percevoir en espèces', rw: 'Akira amafaranga y\'ikiganza' },
  'Recording cash payment…': { en: 'Recording cash payment…', fr: 'Enregistrement du paiement…', rw: 'Birimo kwandika ubwishyu…' },
  'Sending request...': { en: 'Sending request...', fr: 'Envoi en cours...', rw: 'Birimo koherezwa...' },
  'Waiting for payment': { en: 'Waiting for payment', fr: 'En attente du paiement', rw: 'Bitegereje ubwishyu' },
  'A prompt was sent to': { en: 'A prompt was sent to', fr: 'Une demande a été envoyée à', rw: 'Ubutumwa bwoherejwe kuri' },
  "Ask the customer to enter their PIN": { en: "Ask the customer to enter their PIN", fr: 'Demandez au client de saisir son code PIN', rw: 'Saba umukiriya kwandika PIN ye' },
  'Use a different number': { en: 'Use a different number', fr: 'Utiliser un autre numéro', rw: 'Koresha indi numero' },
  'Payment received': { en: 'Payment received', fr: 'Paiement reçu', rw: 'Ubwishyu bwakiriwe' },
  'Trip complete': { en: 'Trip complete', fr: 'Trajet terminé', rw: 'Urugendo rurangiye' },
  'Incoming call': { en: 'Incoming call', fr: 'Appel entrant', rw: 'Guhamagarwa' },
  'Zana Ride · Free Call': { en: 'Zana Ride · Free Call', fr: 'Zana Ride · Appel gratuit', rw: 'Zana Ride · Guhamagara ku buntu' },
  'Loading trip…': { en: 'Loading trip…', fr: 'Chargement du trajet…', rw: 'Birimo gupakira urugendo…' },
  'Could not cancel. Try again.': { en: 'Could not cancel. Try again.', fr: 'Impossible d\'annuler. Réessayez.', rw: 'Ntibyashobotse gukuraho. Ongera ugerageze.' },
  'This ride was already paid via MoMo — no need to collect cash.': { en: 'This ride was already paid via MoMo — no need to collect cash.', fr: 'Ce trajet a déjà été payé via Mobile Money — pas besoin de percevoir en espèces.', rw: 'Uru rugendo rwarishywe binyuze kuri MoMo — nta bwishyu bw\'ikiganza bukenewe.' },
  'Could not switch to cash. Please try again.': { en: 'Could not switch to cash. Please try again.', fr: 'Impossible de passer en espèces. Réessayez.', rw: 'Ntibyashobotse guhindukira ku bwishyu bw\'ikiganza. Ongera ugerageze.' },
  'Payment not confirmed. Ask the customer to check their phone.': { en: 'Payment not confirmed. Ask the customer to check their phone.', fr: 'Paiement non confirmé. Demandez au client de vérifier son téléphone.', rw: 'Ubwishyu ntibwemejwe. Saba umukiriya areba kuri telefoni ye.' },
  'Could not send the payment request': { en: 'Could not send the payment request', fr: 'Impossible d\'envoyer la demande de paiement', rw: 'Ntibyashobotse kohereza icyifuzo cy\'ubwishyu' },
  'Send a Mobile Money request for': { en: 'Send a Mobile Money request for', fr: 'Envoyer une demande Mobile Money pour', rw: 'Ohereza icyifuzo cya Mobile Money kuri' },
};

export function tt(key: string, lang: Lang): string {
  return TRIP_UI[key]?.[lang] ?? key;
}
