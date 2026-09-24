'use client';

export type Lang = 'en' | 'fr' | 'rw';

const STORAGE_KEY = 'zana_lang';

function accountStorageKey(accountToken?: string | null): string {
  if (!accountToken) return STORAGE_KEY;
  let hash = 2166136261;
  for (let i = 0; i < accountToken.length; i += 1) {
    hash ^= accountToken.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return STORAGE_KEY + ':' + (hash >>> 0).toString(16);
}

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  fr: 'Français',
  rw: 'Ikinyarwanda',
};

export function getStoredLang(accountToken?: string | null): Lang {
  if (typeof window === 'undefined') return 'en';

  const key = accountStorageKey(accountToken);
  const stored = localStorage.getItem(key);
  const legacyStored = stored ? null : localStorage.getItem(STORAGE_KEY);
  const saved = stored ?? legacyStored;
  if (saved === 'en' || saved === 'fr' || saved === 'rw') {
    if (!stored && accountToken) localStorage.setItem(key, saved);
    return saved;
  }

  // First visit: use the browser/device language when ZANA supports it.
  // English is the safe fallback for all other languages.
  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  const detected: Lang =
    browserLanguages.some((value) => value.toLowerCase().startsWith('rw'))
      ? 'rw'
      : browserLanguages.some((value) => value.toLowerCase().startsWith('fr'))
        ? 'fr'
        : 'en';

  localStorage.setItem(key, detected);
  return detected;
}

export function setStoredLang(lang: Lang, accountToken?: string | null) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(accountStorageKey(accountToken), lang);
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
  'Go Offline': { en: 'Go Offline', fr: 'Se déconnecter', rw: 'Jya hanze y’umurongo' },
  'You are online': { en: 'You are online', fr: 'Vous êtes en ligne', rw: 'Uri kumurongo' },
  'You are offline': { en: 'You are offline', fr: 'Vous êtes hors ligne', rw: 'Ntabwo uri kumurongo' },
  'Earnings': { en: 'Earnings', fr: 'Revenus', rw: 'Inyungu' },
  'Today': { en: 'Today', fr: 'Aujourd\'hui', rw: 'Uyu munsi' },
  'All time': { en: 'All time', fr: 'Tout le temps', rw: 'Igihe cyose' },
  'Trips': { en: 'Trips', fr: 'Trajets', rw: 'Ingendo' },
  'Accept': { en: 'Accept', fr: 'Accepter', rw: 'Emera' },
  'Decline': { en: 'Decline', fr: 'Refuser', rw: 'Wanga' },
  'I\'ve Arrived': { en: 'I\'ve Arrived', fr: 'Je suis arrivé', rw: 'Nageze' },
  'Start Trip': { en: 'Start Trip', fr: 'Démarrer le trajet', rw: 'Tangira urugendo' },
  'Complete Trip': { en: 'Complete Trip', fr: 'Terminer le trajet', rw: 'Rangiza urugendo' },
  'Heading to pickup': { en: 'Heading to pickup', fr: 'En route vers le client', rw: 'Ngiye guterura' },
  'Waiting for passenger': { en: 'Waiting for passenger', fr: 'En attente du passager', rw: 'Ntegereje umugenzi' },
  'Trip in progress': { en: 'Trip in progress', fr: 'Trajet en cours', rw: 'Urugendo rurakomeza' },
  'New ride request': { en: 'New ride request', fr: 'Nouvelle demande de trajet', rw: 'Ubusabe bushya bw’urugendo' },
  'away': { en: 'away', fr: 'de distance', rw: 'hari' },
  'Fare': { en: 'Fare', fr: 'Tarif', rw: 'Igiciro' },
  'Details': { en: 'Details', fr: 'Détails', rw: 'Ibisobanuro' },
  "You're online and ready to receive requests": { en: "You're online and ready to receive requests", fr: 'Vous êtes en ligne et prêt à recevoir des demandes', rw: 'Uri kumurongo kandi witeguye kwakira ubusabe' },
  'Go online to start receiving ride requests': { en: 'Go online to start receiving ride requests', fr: 'Connectez-vous pour commencer à recevoir des demandes de trajets', rw: 'Jya kumurongo utangire kwakira ubusabe bw’ingendo' },
  'What do you want to receive?': { en: 'What do you want to receive?', fr: 'Que voulez-vous recevoir?', rw: 'Urashaka guhabwa iki?' },
  'Rides only': { en: 'Rides only', fr: 'Trajets seulement', rw: 'Ingendo gusa' },
  'Deliveries only': { en: 'Deliveries only', fr: 'Livraisons seulement', rw: 'Kohereza gusa' },
  'Both': { en: 'Both', fr: 'Les deux', rw: 'Byombi' },

  'Earnings & Wallet': { en: 'Earnings & Wallet', fr: 'Revenus et portefeuille', rw: 'Inyungu n\'Amafaranga' },
  '15% platform commission applies to all earnings': { en: '15% platform commission applies to all earnings', fr: 'Une commission de 15% s\'applique à tous les revenus', rw: '15% by amafaranga yose ni komisiyo ya Zana' },
  'Balance owed to Zana': { en: 'Balance owed to Zana', fr: 'Solde dû à Zana', rw: 'Amafaranga ubereyemo Zana' },
  'Available to withdraw': { en: 'Available to withdraw', fr: 'Disponible pour retrait', rw: 'Ushobora gukura' },
  'in wallet': { en: 'in wallet', fr: 'dans le portefeuille', rw: 'mu mafaranga afite' },
  'owed from cash rides': { en: 'owed from cash rides', fr: 'dû des trajets en espèces', rw: 'ubereyemo ku ngendo z\'amafaranga y\'ikiganza' },
  'After 15% Zana commission deducted': { en: 'After 15% Zana commission deducted', fr: 'Après déduction de la commission Zana de 15%', rw: 'Nyuma yo gukurwamo 15% ya komisiyo ya Zana' },
  'Pay now with MoMo': { en: 'Pay now with MoMo', fr: 'Payer maintenant avec MoMo', rw: 'Ishyura ubu na MoMo' },
  'Today\'s earnings': { en: 'Today\'s earnings', fr: 'Revenus d\'aujourd\'hui', rw: 'Inyungu z\'uyu munsi' },
  'Cash collected today': { en: 'Cash collected today', fr: 'Espèces collectées aujourd\'hui', rw: 'Amafaranga y\'ikiganza yakiriwe uyu munsi' },
  'This week': { en: 'This week', fr: 'Cette semaine', rw: 'Iki cyumweru' },
  'Total earned': { en: 'Total earned', fr: 'Total gagné', rw: 'Byose winjije' },
  'Recent Zana due': { en: 'Recent Zana due', fr: 'Dettes Zana récentes', rw: 'Amafaranga ubereyemo Zana vuba' },
  'Activity': { en: 'Activity', fr: 'Activité', rw: 'Ibikorwa' },
  'Rides': { en: 'Rides', fr: 'Trajets', rw: 'Ingendo' },
  'Deliveries': { en: 'Deliveries', fr: 'Livraisons', rw: 'Ibyoherejwe' },
  'Withdraw to Mobile Money': { en: 'Withdraw to Mobile Money', fr: 'Retirer vers Mobile Money', rw: 'Kura amafaranga kuri Mobile Money' },
  'Withdrawal sent! Check your phone.': { en: 'Withdrawal sent! Check your phone.', fr: 'Retrait envoyé! Vérifiez votre téléphone.', rw: 'Gukura amafaranga byoherejwe! Reba kuri telefoni yawe.' },
  'Amount (RWF)': { en: 'Amount (RWF)', fr: 'Montant (RWF)', rw: 'Amafaranga (RWF)' },
  'Min 1,000 RWF': { en: 'Min 1,000 RWF', fr: 'Min 1 000 RWF', rw: 'Nibura 1,000 RWF' },
  'MTN / Airtel number': { en: 'MTN / Airtel number', fr: 'Numéro MTN / Airtel', rw: 'Numero ya MTN / Airtel' },
  'Processing…': { en: 'Processing…', fr: 'Traitement en cours…', rw: 'Birimo gukorwa…' },
  'Withdraw': { en: 'Withdraw', fr: 'Retirer', rw: 'Kura amafaranga' },
  'Withdrawals are processed via Paypack MoMo': { en: 'Withdrawals are processed via Paypack MoMo', fr: 'Les retraits sont traités via Paypack MoMo', rw: 'Gukura amafaranga bikorwa binyuze kuri Paypack MoMo' },
  'Pay Zana': { en: 'Pay Zana', fr: 'Payer Zana', rw: 'Ishyura Zana' },
  'the full amount currently due': { en: 'the full amount currently due', fr: 'le montant total actuellement dû', rw: 'amafaranga yose asigaye ubu' },
  'Pay now': { en: 'Pay now', fr: 'Payer maintenant', rw: 'Ishyura ubu' },
  'Check your phone': { en: 'Check your phone', fr: 'Vérifiez votre téléphone', rw: 'Reba kuri telefoni yawe' },
  'Approve the MoMo prompt to complete payment': { en: 'Approve the MoMo prompt to complete payment', fr: 'Approuvez la demande MoMo pour terminer le paiement', rw: 'Emeza ubutumwa bwa MoMo kugira ngo urangize kwishyura' },
  'Payment received': { en: 'Payment received', fr: 'Paiement reçu', rw: 'Ubwishyu bwakiriwe' },
  'Your Zana due balance is now settled': { en: 'Your Zana due balance is now settled', fr: 'Votre solde dû à Zana est maintenant réglé', rw: 'Amafaranga wari ubereyemo Zana yarishyuwe' },
  'Done': { en: 'Done', fr: 'Terminé', rw: 'Byarangiye' },
  'Payment didn\'t go through': { en: 'Payment didn\'t go through', fr: 'Le paiement n\'a pas abouti', rw: 'Ubwishyu ntibwagenze neza' },
  'Try again': { en: 'Try again', fr: 'Réessayer', rw: 'Ongera ugerageze' },
  'Minimum withdrawal is 10,000 RWF': { en: 'Minimum withdrawal is 10,000 RWF', fr: 'Le retrait minimum est de 10 000 RWF', rw: 'Ubuke bwo gukura ni 10,000 RWF' },
  'Insufficient balance': { en: 'Insufficient balance', fr: 'Solde insuffisant', rw: 'Amafaranga ntahagije' },
  'Enter a valid phone number': { en: 'Enter a valid phone number', fr: 'Entrez un numéro de téléphone valide', rw: 'Andika numero ya telefoni nyayo' },
  'Withdrawal failed. Try again.': { en: 'Withdrawal failed. Try again.', fr: 'Le retrait a échoué. Réessayez.', rw: 'Gukura amafaranga byanze. Ongera ugerageze.' },
  'Could not reach the payment provider.': { en: 'Could not reach the payment provider.', fr: 'Impossible de joindre le fournisseur de paiement.', rw: 'Ntibyashobotse guhuza n\'uwishyura.' },
  '← Back': { en: '← Back', fr: '← Retour', rw: '← Subira inyuma' },
  'Your documents': { en: 'Your documents', fr: 'Vos documents', rw: 'Ibyangombwa byawe' },
  'Manage': { en: 'Manage', fr: 'Gérer', rw: 'Gucunga' },
  'rating': { en: 'rating', fr: 'note', rw: 'amanota' },
  'Outstanding commission debt': { en: 'Outstanding commission debt', fr: 'Dette de commission en cours', rw: 'Amafaranga y\'ikomisiyo usigaje' },
  'You owe': { en: 'You owe', fr: 'Vous devez', rw: 'Ubereyemo' },
  'in commission from': { en: 'in commission from', fr: 'en commission provenant de', rw: 'ku ikomisiyo iva ku' },
  'cash trip': { en: 'cash trip', fr: 'trajet en espèces', rw: 'urugendo rw\'amafaranga y\'ikiganza' },
  'cash trips': { en: 'cash trips', fr: 'trajets en espèces', rw: 'ingendo z\'amafaranga y\'ikiganza' },
  'This will be deducted from your next wallet earning.': { en: 'This will be deducted from your next wallet earning.', fr: 'Ceci sera déduit de votre prochain revenu.', rw: 'Ibi bizakurwa ku nyungu yawe ikurikira.' },
  '💡 Tip: Keep at least 5,000 RWF in your wallet to avoid debt.': { en: '💡 Tip: Keep at least 5,000 RWF in your wallet to avoid debt.', fr: '💡 Astuce: Gardez au moins 5 000 RWF pour éviter les dettes.', rw: '💡 Inama: Gumana nibura 5,000 RWF kugira ngo wirinde imyenda.' },
  'No outstanding debt — you\'re all clear!': { en: 'No outstanding debt — you\'re all clear!', fr: 'Aucune dette en cours — tout est en ordre!', rw: 'Nta myenda usigaje — byose biri neza!' },
  'Total rides': { en: 'Total rides', fr: 'Total des trajets', rw: 'Ingendo zose' },
  'Rating': { en: 'Rating', fr: 'Note', rw: 'Amanota' },
  'Member since': { en: 'Member since', fr: 'Membre depuis', rw: 'Yinjiye kuva' },
  '❌ Account rejected': { en: '❌ Account rejected', fr: '❌ Compte rejeté', rw: '❌ Konti yanzwe' },
  '⏳ Pending approval': { en: '⏳ Pending approval', fr: '⏳ En attente d\'approbation', rw: '⏳ Bitegereje kwemezwa' },
  'Reason': { en: 'Reason', fr: 'Raison', rw: 'Impamvu' },
  'Please contact support@zana.rw to appeal.': { en: 'Please contact support@zana.rw to appeal.', fr: 'Veuillez contacter support@zana.rw pour faire appel.', rw: 'Nyamuneka hamagara support@zana.rw kugira ngo wiyambaze.' },
  'Recent ratings from passengers': { en: 'Recent ratings from passengers', fr: 'Notes récentes des passagers', rw: 'Amanota aherutse aturuka ku bagenzi' },
  'Language': { en: 'Language', fr: 'Langue', rw: 'Ururimi' },
  'Log out': { en: 'Log out', fr: 'Se déconnecter', rw: 'Sohoka' },
  'Your rides': { en: 'Your rides', fr: 'Vos trajets', rw: 'Ingendo zawe' },
  'Loading…': { en: 'Loading…', fr: 'Chargement…', rw: 'Birimo gupakira…' },
  'No rides yet': { en: 'No rides yet', fr: 'Aucun trajet pour le moment', rw: 'Nta rugendo urahagira' },
  'Completed': { en: 'Completed', fr: 'Terminé', rw: 'Byarangiye' },
  'Cancelled by passenger': { en: 'Cancelled by passenger', fr: 'Annulé par le passager', rw: "Byahagaritswe n'umugenzi" },
  'You cancelled': { en: 'You cancelled', fr: 'Vous avez annulé', rw: 'Wabikuyeho' },
  'Delivery pool': { en: 'Delivery pool', fr: 'Ibicuruzwa byo kohereza', rw: 'Ibicuruzwa byo kohereza' },
  'Pick jobs that fit your route. Up to 3 at a time.': { en: 'Pick jobs that fit your route. Up to 3 at a time.', fr: 'Hitamo imirimo ijyanye n\'inzira yawe. Kugeza kuri 3 icyarimwe.', rw: 'Hitamo imirimo ijyanye n\'inzira yawe. Kugeza kuri 3 icyarimwe.' },
  'Carrying': { en: 'Carrying', fr: 'Utwaye', rw: 'Utwaye' },
  'parcel': { en: 'parcel', fr: 'ipaki', rw: 'ipaki' },
  'parcels': { en: 'parcels', fr: 'amapaki', rw: 'amapaki' },
  'On board': { en: 'On board', fr: 'Biri kuri moto', rw: 'Biri kuri moto' },
  'To collect': { en: 'To collect', fr: 'Gutora', rw: 'Gutora' },
  'Tap to continue →': { en: 'Tap to continue →', fr: 'Kanda ukomeze →', rw: 'Kanda ukomeze →' },
  'No deliveries waiting near you': { en: 'No deliveries waiting near you', fr: 'Nta bicuruzwa bitegereje hafi yawe', rw: 'Nta bicuruzwa bitegereje hafi yawe' },
  'URGENT': { en: 'URGENT', fr: 'BYIHUTIRWA', rw: 'BYIHUTIRWA' },
  'km away': { en: 'km away', fr: 'km uvuye', rw: 'km uvuye' },
  'waiting': { en: 'waiting', fr: 'byategereje', rw: 'byategereje' },
  'min': { en: 'min', fr: 'iminota', rw: 'iminota' },
  'km detour': { en: 'km detour', fr: 'km y\'inzira indi', rw: 'km y\'inzira indi' },
  'Accepting…': { en: 'Accepting…', fr: 'Byemejwe…', rw: 'Byemejwe…' },
  'Accept delivery': { en: 'Accept delivery', fr: 'Emeza gucuruza', rw: 'Emeza gucuruza' },
  'You are carrying the maximum of 3': { en: 'You are carrying the maximum of 3', fr: 'Utwaye byinshi kugeza kuri 3', rw: 'Utwaye byinshi kugeza kuri 3' },
  'Too far off your current route': { en: 'Too far off your current route', fr: 'Biri kure cyane y\'inzira yawe', rw: 'Biri kure cyane y\'inzira yawe' },
  'You are already carrying': { en: 'You are already carrying', fr: 'Umaze gutwara', rw: 'Umaze gutwara' },
  'parcels. Finish one before taking another.': { en: 'parcels. Finish one before taking another.', fr: 'amapaki. Rangiza rimwe mbere yo gufata irindi.', rw: 'amapaki. Rangiza rimwe mbere yo gufata irindi.' },
  'That job is': { en: 'That job is', fr: 'Uwo murimo uri', rw: 'Uwo murimo uri' },
  'km off your current route. Only jobs within': { en: 'km off your current route. Only jobs within', fr: 'km kure y\'inzira yawe. Imirimo iri gusa muri', rw: 'km kure y\'inzira yawe. Imirimo iri gusa muri' },
  'km can be added.': { en: 'km can be added.', fr: 'km ishobora kongerwaho.', rw: 'km ishobora kongerwaho.' },
  'Another rider took that one.': { en: 'Another rider took that one.', fr: 'Undi moto yamaze kuyifata.', rw: 'Undi moto yamaze kuyifata.' },
  'Could not accept that delivery.': { en: 'Could not accept that delivery.', fr: 'Ntibyakunze kwemeza icyo gicuruzwa.', rw: 'Ntibyakunze kwemeza icyo gicuruzwa.' },
  'No active delivery': { en: 'No active delivery', fr: 'Nta gicuruzwa gikorwa ubu', rw: 'Nta gicuruzwa gikorwa ubu' },
  'Browse deliveries': { en: 'Browse deliveries', fr: 'Reba ibicuruzwa', rw: 'Reba ibicuruzwa' },
  'Uploading photo…': { en: 'Uploading photo…', fr: 'Byoherejwe ifoto…', rw: 'Byoherejwe ifoto…' },
  'Proof of handling': { en: 'Proof of handling', fr: 'Icyemezo cy\'ifatwa', rw: 'Icyemezo cy\'ifatwa' },
  'Photo could not upload. Continuing without it.': { en: 'Photo could not upload. Continuing without it.', fr: 'Ifoto ntiyashoboye koherezwa. Turakomeza nta yo.', rw: 'Ifoto ntiyashoboye koherezwa. Turakomeza nta yo.' },
  'Could not confirm pickup. Please try again.': { en: 'Could not confirm pickup. Please try again.', fr: 'Ntibyakunze kwemeza gutora. Ongera ugerageze.', rw: 'Ntibyakunze kwemeza gutora. Ongera ugerageze.' },
  'Could not confirm delivery. Please try again.': { en: 'Could not confirm delivery. Please try again.', fr: 'Ntibyakunze kwemeza kohereza. Ongera ugerageze.', rw: 'Ntibyakunze kwemeza kohereza. Ongera ugerageze.' },
  'Active delivery restored': { en: 'Active delivery restored', fr: 'Igicuruzwa cyagarutswe', rw: 'Igicuruzwa cyagarutswe' },
  'Status: To collect': { en: 'Status: To collect', fr: 'Uko bihagaze: Gutora', rw: 'Uko bihagaze: Gutora' },
  'Status: Picked up': { en: 'Status: Picked up', fr: 'Uko bihagaze: Byatowe', rw: 'Uko bihagaze: Byatowe' },
  'Next stop: Pickup': { en: 'Next stop: Pickup', fr: 'Aho ujya: Gutora', rw: 'Aho ujya: Gutora' },
  'Next stop: Customer': { en: 'Next stop: Customer', fr: 'Aho ujya: Umukiriya', rw: 'Aho ujya: Umukiriya' },
  'Go to pickup location': { en: 'Go to pickup location', fr: 'Jya aho gutorera', rw: 'Jya aho gutorera' },
  'Deliver to customer': { en: 'Deliver to customer', fr: 'Twara ku mukiriya', rw: 'Twara ku mukiriya' },
  'Package': { en: 'Package', fr: 'Ipaki', rw: 'Ipaki' },
  'From:': { en: 'From:', fr: 'Biva:', rw: 'Biva:' },
  'Pickup': { en: 'Pickup', fr: 'Gutora', rw: 'Gutora' },
  'Dropoff': { en: 'Dropoff', fr: 'Kohereza', rw: 'Kohereza' },
  'Customer': { en: 'Customer', fr: 'Umukiriya', rw: 'Umukiriya' },
  'Your earnings': { en: 'Your earnings', fr: 'Inyungu yawe', rw: 'Inyungu yawe' },
  'm away — move closer to confirm': { en: 'm away — move closer to confirm', fr: 'm uvuye — hurira hafi kugira ngo wemeze', rw: 'm uvuye — hurira hafi kugira ngo wemeze' },
  'Navigate': { en: 'Navigate', fr: 'Yobora', rw: 'Yobora' },
  'Confirm Pickup': { en: 'Confirm Pickup', fr: 'Emeza Gutora', rw: 'Emeza Gutora' },
  'Confirm Delivery': { en: 'Confirm Delivery', fr: 'Emeza Kohereza', rw: 'Emeza Kohereza' },
  'Stop': { en: 'Stop', fr: 'Aho uhagarara', rw: 'Aho uhagarara' },
  'My deliveries': { en: 'My deliveries', fr: 'Ibicuruzwa byanjye', rw: 'Ibicuruzwa byanjye' },
  'Earned today': { en: 'Earned today', fr: 'Wabonye uyu munsi', rw: 'Wabonye uyu munsi' },
  'delivery': { en: 'delivery', fr: 'igicuruzwa', rw: 'igicuruzwa' },
  'deliveries_short': { en: 'deliveries', fr: 'ibicuruzwa', rw: 'ibicuruzwa' },
  'completed': { en: 'completed', fr: 'byarangiye', rw: 'byarangiye' },
  'delivery in progress — tap to continue': { en: 'delivery in progress — tap to continue', fr: 'igicuruzwa kirimo gukorwa — kanda ukomeze', rw: 'igicuruzwa kirimo gukorwa — kanda ukomeze' },
  'All': { en: 'All', fr: 'Byose', rw: 'Byose' },
  'In progress': { en: 'In progress', fr: 'Birimo gukorwa', rw: 'Birimo gukorwa' },
  'Nothing here yet': { en: 'Nothing here yet', fr: 'Nta kintu kiraboneka hano', rw: 'Nta kintu kiraboneka hano' },
  'Drop-off': { en: 'Drop-off', fr: 'Kohereza', rw: 'Kohereza' },
  'Verified': { en: 'Verified', fr: 'Byemejwe', rw: 'Byemejwe' },
  'Under review': { en: 'Under review', fr: 'Birimo gusuzumwa', rw: 'Birimo gusuzumwa' },
  'Not uploaded': { en: 'Not uploaded', fr: 'Ntibyoherejwe', rw: 'Ntibyoherejwe' },
  'still needed before you can be approved': { en: 'still needed before you can be approved', fr: 'bikiri ngombwa mbere yo kwemezwa', rw: 'bikiri ngombwa mbere yo kwemezwa' },
  'All documents received': { en: 'All documents received', fr: 'Ibyangombwa byose byakiriwe', rw: 'Ibyangombwa byose byakiriwe' },
  'uploaded. Zana will review it.': { en: 'uploaded. Zana will review it.', fr: 'byoherejwe. Zana izabisuzuma.', rw: 'byoherejwe. Zana izabisuzuma.' },
  'That upload failed. Try again on a better connection.': { en: 'That upload failed. Try again on a better connection.', fr: 'Kohereza byanze. Ongera ugerageze ufite interineti nziza.', rw: 'Kohereza byanze. Ongera ugerageze ufite interineti nziza.' },
  'Uploading…': { en: 'Uploading…', fr: 'Birimo koherezwa…', rw: 'Birimo koherezwa…' },
  'Upload': { en: 'Upload', fr: 'Ohereza', rw: 'Ohereza' },
  'Replace': { en: 'Replace', fr: 'Simbuza', rw: 'Simbuza' },
  'Documents are used to verify you before approval and are visible only to Zana staff. Replacing a document means it must be reviewed again.': { en: 'Documents are used to verify you before approval and are visible only to Zana staff. Replacing a document means it must be reviewed again.', fr: 'Ibyangombwa bikoreshwa mu kugukurikirana mbere yo kwemezwa kandi bibonwa gusa n\'abakozi ba Zana. Gusimbuza ikibaho bivuze ko gisubira gusuzumwa.', rw: 'Ibyangombwa bikoreshwa mu kugukurikirana mbere yo kwemezwa kandi bibonwa gusa n\'abakozi ba Zana. Gusimbuza ikibaho bivuze ko gisubira gusuzumwa.' },
  'Your rating': { en: 'Your rating', fr: 'Amanota yawe', rw: 'Amanota yawe' },
  'From': { en: 'From', fr: 'Biva', rw: 'Biva' },
  'ratings': { en: 'ratings', fr: 'amanota', rw: 'amanota' },
  'No ratings yet': { en: 'No ratings yet', fr: 'Nta manota arahaba', rw: 'Nta manota arahaba' },
  'Driver Login': { en: 'Driver Login', fr: 'Kwinjira k\'umushoferi', rw: 'Kwinjira k\'umushoferi' },
  'Log in with your email or phone number.': { en: 'Log in with your email or phone number.', fr: 'Injira ukoresheje imeyili cyangwa telefoni.', rw: 'Injira ukoresheje imeyili cyangwa telefoni.' },
  'Email or phone number': { en: 'Email or phone number', fr: 'Imeyili cyangwa telefoni', rw: 'Imeyili cyangwa telefoni' },
  'Password': { en: 'Password', fr: 'Ijambo ry\'ibanga', rw: 'Ijambo ry\'ibanga' },
  'Logging in…': { en: 'Logging in…', fr: 'Birimo kwinjira…', rw: 'Birimo kwinjira…' },
  'Log In': { en: 'Log In', fr: 'Injira', rw: 'Injira' },
  'Sign in with a code instead': { en: 'Sign in with a code instead', fr: 'Injira ukoresheje kode', rw: 'Injira ukoresheje kode' },
  'Forgot your password?': { en: 'Forgot your password?', fr: 'Wibagiwe ijambo ry\'ibanga?', rw: 'Wibagiwe ijambo ry\'ibanga?' },
  'New driver?': { en: 'New driver?', fr: 'Umushoferi mushya?', rw: 'Umushoferi mushya?' },
  'Apply to drive': { en: 'Apply to drive', fr: 'Saba kuba umushoferi', rw: 'Saba kuba umushoferi' },
  'Could not reach the server.': { en: 'Could not reach the server.', fr: 'Ntibyashobotse guhuza na seriveri.', rw: 'Ntibyashobotse guhuza na seriveri.' },
  'Enter your full phone number.': { en: 'Enter your full phone number.', fr: 'Andika numero yawe yuzuye.', rw: 'Andika numero yawe yuzuye.' },
  'That code has expired. Ask for a new one.': { en: 'That code has expired. Ask for a new one.', fr: 'Kode yarangiye. Saba indi.', rw: 'Kode yarangiye. Saba indi.' },
  'This account is suspended. Contact support.': { en: 'This account is suspended. Contact support.', fr: 'Iyi konti yahagaritswe. Hamagara ubufasha.', rw: 'Iyi konti yahagaritswe. Hamagara ubufasha.' },
  'That code is not right, or there is no account on this number.': { en: 'That code is not right, or there is no account on this number.', fr: 'Iyo kode si yo, cyangwa nta konti iri kuri iyi numero.', rw: 'Iyo kode si yo, cyangwa nta konti iri kuri iyi numero.' },
  'Sign in with a code': { en: 'Sign in with a code', fr: 'Injira ukoresheje kode', rw: 'Injira ukoresheje kode' },
  'No password needed. We\'ll text you a six-digit code.': { en: 'No password needed. We\'ll text you a six-digit code.', fr: 'Nta jambo ry\'ibanga rikenewe. Tuzakwohereza kode y\'imibare 6.', rw: 'Nta jambo ry\'ibanga rikenewe. Tuzakwohereza kode y\'imibare 6.' },
  'Phone number': { en: 'Phone number', fr: 'Numero ya telefoni', rw: 'Numero ya telefoni' },
  'Sending…': { en: 'Sending…', fr: 'Byoherejwe…', rw: 'Byoherejwe…' },
  'Send code': { en: 'Send code', fr: 'Ohereza kode', rw: 'Ohereza kode' },
  'Use a password instead': { en: 'Use a password instead', fr: 'Koresha ijambo ry\'ibanga', rw: 'Koresha ijambo ry\'ibanga' },
  'Enter your code': { en: 'Enter your code', fr: 'Andika kode yawe', rw: 'Andika kode yawe' },
  'Sent to': { en: 'Sent to', fr: 'Byoherejwe kuri', rw: 'Byoherejwe kuri' },
  '. Valid for five minutes.': { en: '. Valid for five minutes.', fr: '. Bizamara iminota itanu.', rw: '. Bizamara iminota itanu.' },
  'Checking…': { en: 'Checking…', fr: 'Birimo kugenzurwa…', rw: 'Birimo kugenzurwa…' },
  'Sign in': { en: 'Sign in', fr: 'Injira', rw: 'Injira' },
  'Send again in': { en: 'Send again in', fr: 'Ongera wohereze mu', rw: 'Ongera wohereze mu' },
  'Send the code again': { en: 'Send the code again', fr: 'Ongera wohereze kode', rw: 'Ongera wohereze kode' },
  'Moto': { en: 'Moto', fr: 'Moto', rw: 'Moto' },
  'Car (Basic)': { en: 'Car (Basic)', fr: 'Imodoka (Isanzwe)', rw: 'Imodoka (Isanzwe)' },
  'Car (Premium)': { en: 'Car (Premium)', fr: 'Imodoka (Iciza)', rw: 'Imodoka (Iciza)' },
  'Your account needs approval before you can go online.': { en: 'Your account needs approval before you can go online.', fr: 'Konti yawe igomba kwemezwa mbere yuko ushobora gukora.', rw: 'Konti yawe igomba kwemezwa mbere yuko ushobora gukora.' },
  'First name': { en: 'First name', fr: 'Izina bwite', rw: 'Izina bwite' },
  'Last name': { en: 'Last name', fr: 'Izina ry\'umuryango', rw: 'Izina ry\'umuryango' },
  'Email address': { en: 'Email address', fr: 'Aderesi ya imeyili', rw: 'Aderesi ya imeyili' },
  'Password (min. 6 characters)': { en: 'Password (min. 6 characters)', fr: 'Ijambo ry\'ibanga (nibura inyuguti 6)', rw: 'Ijambo ry\'ibanga (nibura inyuguti 6)' },
  'Vehicle type': { en: 'Vehicle type', fr: 'Ubwoko bw\'ikinyabiziga', rw: 'Ubwoko bw\'ikinyabiziga' },
  'Vehicle description (e.g. TVS Motorcycle - Black)': { en: 'Vehicle description (e.g. TVS Motorcycle - Black)', fr: 'Ibisobanuro by\'ikinyabiziga (urugero: TVS Moto - Umukara)', rw: 'Ibisobanuro by\'ikinyabiziga (urugero: TVS Moto - Umukara)' },
  'License plate': { en: 'License plate', fr: 'Nimero ya pulaka', rw: 'Nimero ya pulaka' },
  'Submitting…': { en: 'Submitting…', fr: 'Birimo kohereza…', rw: 'Birimo kohereza…' },
  'Submit Application': { en: 'Submit Application', fr: 'Ohereza Isabwa', rw: 'Ohereza Isabwa' },
  'Already approved?': { en: 'Already approved?', fr: 'Wamaze kwemerwa?', rw: 'Wamaze kwemerwa?' },
  'Log in': { en: 'Log in', fr: 'Injira', rw: 'Injira' },
  'Those passwords do not match.': { en: 'Those passwords do not match.', fr: 'Amagambo y\'ibanga ntabwo ahura.', rw: 'Amagambo y\'ibanga ntabwo ahura.' },
  'Use at least 6 characters.': { en: 'Use at least 6 characters.', fr: 'Koresha byibura inyuguti 6.', rw: 'Koresha byibura inyuguti 6.' },
  'Enter the phone number the code was sent to.': { en: 'Enter the phone number the code was sent to.', fr: 'Andika numero yoherejweho kode.', rw: 'Andika numero yoherejweho kode.' },
  'That code is not right. Check and try again.': { en: 'That code is not right. Check and try again.', fr: 'Iyo kode si yo. Genzura hanyuma ugerageze.', rw: 'Iyo kode si yo. Genzura hanyuma ugerageze.' },
  'Could not reset your password. Try again.': { en: 'Could not reset your password. Try again.', fr: 'Ntibyashobotse guhindura ijambo ry\'ibanga. Ongera ugerageze.', rw: 'Ntibyashobotse guhindura ijambo ry\'ibanga. Ongera ugerageze.' },
  'Enter the phone number or email on your account and we\'ll send a code by SMS.': { en: 'Enter the phone number or email on your account and we\'ll send a code by SMS.', fr: 'Andika numero cyangwa imeyili ya konti yawe tuzakohereza kode ukoresheje SMS.', rw: 'Andika numero cyangwa imeyili ya konti yawe tuzakohereza kode ukoresheje SMS.' },
  'Phone or email': { en: 'Phone or email', fr: 'Telefoni cyangwa imeyili', rw: 'Telefoni cyangwa imeyili' },
  'If that account exists, a code is on its way': { en: 'If that account exists, a code is on its way', fr: 'Niba konti ihari, kode iri kugenda', rw: 'Niba konti ihari, kode iri kugenda' },
  'to': { en: 'to', fr: 'kuri', rw: 'kuri' },
  '. It is valid for five minutes.': { en: '. It is valid for five minutes.', fr: '. Izamara iminota itanu.', rw: '. Izamara iminota itanu.' },
  'Phone number the code went to': { en: 'Phone number the code went to', fr: 'Numero yoherejweho kode', rw: 'Numero yoherejweho kode' },
  '6-digit code': { en: '6-digit code', fr: 'Kode y\'imibare 6', rw: 'Kode y\'imibare 6' },
  'New password': { en: 'New password', fr: 'Ijambo ry\'ibanga rishya', rw: 'Ijambo ry\'ibanga rishya' },
  'At least 6 characters': { en: 'At least 6 characters', fr: 'Byibura inyuguti 6', rw: 'Byibura inyuguti 6' },
  'Confirm password': { en: 'Confirm password', fr: 'Emeza ijambo ry\'ibanga', rw: 'Emeza ijambo ry\'ibanga' },
  'Saving…': { en: 'Saving…', fr: 'Birabikwa…', rw: 'Birabikwa…' },
  'Set new password': { en: 'Set new password', fr: 'Shyiraho ijambo ry\'ibanga rishya', rw: 'Shyiraho ijambo ry\'ibanga rishya' },
  'Zana will never ask for your password or your code by phone or message. If someone does, it is not us.': { en: 'Zana will never ask for your password or your code by phone or message. If someone does, it is not us.', fr: 'Zana ntizigera isaba ijambo ry\'ibanga cyangwa kode yawe kuri telefoni cyangwa ubutumwa. Niba hari ubikubaza, ntabwo ari twe.', rw: 'Zana ntizigera isaba ijambo ry\'ibanga cyangwa kode yawe kuri telefoni cyangwa ubutumwa. Niba hari ubikubaza, ntabwo ari twe.' },
  'Zana needs your location, including in the background': { en: 'Zana needs your location, including in the background', fr: 'Zana ikeneye aho uri, harimo n\'igihe uri mu buryo bwa background', rw: 'Zana ikeneye aho uri, harimo n\'igihe uri mu buryo bwa background' },
  'Before we ask your phone for permission, here is exactly what that means.': { en: 'Before we ask your phone for permission, here is exactly what that means.', fr: 'Mbere yo gusaba uruhushya kuri telefoni yawe, dore icyo ibi bisobanura.', rw: 'Mbere yo gusaba uruhushya kuri telefoni yawe, dore icyo ibi bisobanura.' },
  'Customers can see where their parcel is': { en: 'Customers can see where their parcel is', fr: 'Abakiriya barashobora kubona aho ipaki yabo iri', rw: 'Abakiriya barashobora kubona aho ipaki yabo iri' },
  'While you are carrying a job, your position is shared with the customer waiting for it and with Zana support.': { en: 'While you are carrying a job, your position is shared with the customer waiting for it and with Zana support.', fr: 'Igihe utwaye umurimo, aho uri bisangizwa umukiriya utegereje kandi n\'ubufasha bwa Zana.', rw: 'Igihe utwaye umurimo, aho uri bisangizwa umukiriya utegereje kandi n\'ubufasha bwa Zana.' },
  'It keeps working when your screen is off': { en: 'It keeps working when your screen is off', fr: 'Bigikora igihe ecran yawe yazimye', rw: 'Bigikora igihe ecran yawe yazimye' },
  'You will put your phone in your pocket while riding. Without background access, tracking stops and the customer sees you frozen in the wrong place.': { en: 'You will put your phone in your pocket while riding. Without background access, tracking stops and the customer sees you frozen in the wrong place.', fr: 'Uzashyira telefoni yawe mu mufuka igihe utwara. Utagira uburenganzira bwa background, gukurikirana birahagarara kandi umukiriya akubona uhagaze ahatari ho.', rw: 'Uzashyira telefoni yawe mu mufuka igihe utwara. Utagira uburenganzira bwa background, gukurikirana birahagarara kandi umukiriya akubona uhagaze ahatari ho.' },
  'It stops when you go offline': { en: 'It stops when you go offline', fr: 'Birahagarara igihe wagiye offline', rw: 'Birahagarara igihe wagiye offline' },
  'Zana does not collect your location when you are offline or have no active job. Traces are kept for 90 days and never sold.': { en: 'Zana does not collect your location when you are offline or have no active job. Traces are kept for 90 days and never sold.', fr: 'Zana ntikusanya aho uri igihe uri offline cyangwa udafite umurimo ukora. Amakuru abikwa iminsi 90 kandi ntagurishwa.', rw: 'Zana ntikusanya aho uri igihe uri offline cyangwa udafite umurimo ukora. Amakuru abikwa iminsi 90 kandi ntagurishwa.' },
  'You can withdraw this permission at any time in your phone settings, though you will not be able to accept jobs without it. Full detail is in our': { en: 'You can withdraw this permission at any time in your phone settings, though you will not be able to accept jobs without it. Full detail is in our', fr: 'Ushobora gukuraho uru ruhushya igihe icyo ari cyo cyose muri paramerta za telefoni yawe, ariko ntuzashobora kwemera imirimo udafite. Ibisobanuro byuzuye biri muri', rw: 'Ushobora gukuraho uru ruhushya igihe icyo ari cyo cyose muri paramerta za telefoni yawe, ariko ntuzashobora kwemera imirimo udafite. Ibisobanuro byuzuye biri muri' },
  'privacy policy': { en: 'privacy policy', fr: 'amabwiriza y\'ibanga', rw: 'amabwiriza y\'ibanga' },
  'Opening…': { en: 'Opening…', fr: 'Birimo gufungura…', rw: 'Birimo gufungura…' },
  'I understand — continue': { en: 'I understand — continue', fr: 'Ndabyumvise — komeza', rw: 'Ndabyumvise — komeza' },
  'Not now': { en: 'Not now', fr: 'Si ubu', rw: 'Si ubu' },
  'You\'ve been logged in on another device, so this one has been taken offline.': { en: 'You\'ve been logged in on another device, so this one has been taken offline.', fr: 'Winjiye kuri indi terefone, kubera iyo mpamvu iyi ntikiri ku murimo.', rw: 'Winjiye kuri indi terefone, kubera iyo mpamvu iyi ntikiri ku murimo.' },
  'Today\'s Overview': { en: 'Today\'s Overview', fr: 'Aperçu du jour', rw: 'Incamake y\'uyu munsi' },
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



Object.assign(DRIVER_UI, {
  'SOS EMERGENCY': { en: 'SOS EMERGENCY', fr: 'URGENCE SOS', rw: 'SOS Y’IHUTIRWA' },
  'Emergency SOS': { en: 'Emergency SOS', fr: 'SOS d’urgence', rw: 'SOS y’ihutirwa' },
  'Use SOS if you are in immediate danger or need urgent safety assistance.': { en: 'Use SOS if you are in immediate danger or need urgent safety assistance.', fr: 'Utilisez le SOS si vous êtes en danger immédiat ou avez besoin d’une aide urgente.', rw: 'Koresha SOS niba uri mu kaga ako kanya cyangwa ukeneye ubufasha bwihutirwa.' },
  'SEND SOS ALERT': { en: 'SEND SOS ALERT', fr: 'ENVOYER L’ALERTE SOS', rw: 'OHEREZA ALERTI YA SOS' },
  'Sending SOS...': { en: 'Sending SOS...', fr: 'Envoi du SOS...', rw: 'Turimo kohereza SOS...' },
  'SOS alert sent': { en: 'SOS alert sent', fr: 'Alerte SOS envoyée', rw: 'Alerti ya SOS yoherejwe' },
  'Zana Safety has received your emergency alert and your location.': { en: 'Zana Safety has received your emergency alert and your location.', fr: 'Zana Safety a reçu votre alerte d’urgence et votre position.', rw: 'Zana Safety yakiriye alerti y’ihutirwa n’aho uri.' },
  'SOS could not be sent. Check your connection and try again.': { en: 'SOS could not be sent. Check your connection and try again.', fr: 'Impossible d’envoyer le SOS. Vérifiez votre connexion et réessayez.', rw: 'SOS ntiyoherejwe. Reba internet wongere ugerageze.' },
  'Close': { en: 'Close', fr: 'Fermer', rw: 'Funga' },
});

  'GO ONLINE': { en: 'GO ONLINE', fr: 'SE CONNECTER', rw: 'JYA KUMURONGO' },
  'GO OFFLINE': { en: 'GO OFFLINE', fr: 'SE DÉCONNECTER', rw: 'JYA HANZE Y’UMURONGO' },
  'Ready to receive requests': { en: 'Ready to receive requests', fr: 'Prêt à recevoir des demandes', rw: 'Witeguye kwakira ubusabe' },
  'What do you want to receive?': { en: 'What do you want to receive?', fr: 'Que voulez-vous recevoir ?', rw: 'Urashaka kwakira iki?' },
  'Choose what you want to receive while you are online.': { en: 'Choose what you want to receive while you are online.', fr: 'Choisissez ce que vous souhaitez recevoir lorsque vous êtes en ligne.', rw: 'Hitamo ibyo ushaka kwakira igihe uri ku murongo.' },
  'Rides & Deliveries': { en: 'Rides & Deliveries', fr: 'Trajets et livraisons', rw: 'Ingendo no kugeza ibintu' },
  'Slide to confirm': { en: 'Slide to confirm', fr: 'Glissez pour confirmer', rw: 'Kurura wemeze' },
  'Slide to go online': { en: 'Slide to go online', fr: 'Glissez pour vous connecter', rw: 'Kurura ujye ku murongo' },
  'Taking you online...': { en: 'Taking you online...', fr: 'Connexion en cours...', rw: 'Turimo kukujyana ku murongo...' },
  'Taking you offline...': { en: 'Taking you offline...', fr: 'Déconnexion en cours...', rw: 'Turimo kugukuraho ku murongo...' },
  'Connecting you to new requests': { en: 'Connecting you to new requests', fr: 'Connexion aux nouvelles demandes', rw: 'Turimo kuguhuza n’ubusabe bushya' },
  'Stopping new requests': { en: 'Stopping new requests', fr: 'Arrêt des nouvelles demandes', rw: 'Turimo guhagarika ubusabe bushya' },
  'Go offline?': { en: 'Go offline?', fr: 'Se déconnecter ?', rw: 'Ushaka kuva ku murongo?' },
  'You will stop receiving new requests.': { en: 'You will stop receiving new requests.', fr: 'Vous ne recevrez plus de nouvelles demandes.', rw: 'Ntuzongera kwakira ubusabe bushya.' },
  "You're online": { en: "You're online", fr: 'Vous êtes en ligne', rw: 'Uri ku murongo' },
  'Could not go offline. Check your connection.': { en: 'Could not go offline. Check your connection.', fr: 'Impossible de se déconnecter. Vérifiez votre connexion.', rw: 'Ntibyashobotse kuva ku murongo. Reba internet.' },
  'Could not go online. Check your connection.': { en: 'Could not go online. Check your connection.', fr: 'Impossible de se connecter. Vérifiez votre connexion.', rw: 'Ntibyashobotse kujya ku murongo. Reba internet.' },
  "Your account is still pending approval — you can go online once it's reviewed.": { en: "Your account is still pending approval — you can go online once it's reviewed.", fr: 'Votre compte est toujours en attente de validation — vous pourrez vous connecter après sa validation.', rw: 'Konti yawe iracyategereje kwemezwa — uzashobora kujya ku murongo imaze kwemezwa.' },
});

Object.assign(DRIVER_UI, {
  'vehicle problem, customer not reachable…': { en: 'e.g. vehicle problem, customer not reachable…', fr: 'ex. problème du véhicule, client injoignable…', rw: 'urugero: ikibazo cy’ikinyabiziga, umukiriya ntaboneka…' },
  'passenger': { en: 'passenger', fr: 'passager', rw: 'umugenzi' },
});

Object.assign(DRIVER_UI, {
  'Messages auto-translate · History clears after ride': { en: 'Messages auto-translate · History clears after ride', fr: 'Les messages sont traduits automatiquement · L’historique est effacé après le trajet', rw: 'Ubutumwa buhindurwa ururimi mu buryo bwikora · Amateka asibwa urugendo rurangiye' },
  'No messages yet. Say hello!': { en: 'No messages yet. Say hello!', fr: 'Aucun message pour le moment. Dites bonjour !', rw: 'Nta butumwa burabaho. Vuga uti muraho!' },
  'Rate your ride': { en: 'Rate your ride', fr: 'Évaluez votre trajet', rw: 'Tanga amanota ku rugendo rwawe' },
  'How was your ride with': { en: 'How was your ride with', fr: 'Comment était votre trajet avec', rw: 'Urugendo rwanyu na' },
  '?': { en: '?', fr: '?', rw: '?' },
  'Add a comment (optional)': { en: 'Add a comment (optional)', fr: 'Ajouter un commentaire (facultatif)', rw: 'Ongeraho igitekerezo (ntibitegetswe)' },
  'Min 1,000 RWF': { en: 'Min 1,000 RWF', fr: 'Min. 1 000 RWF', rw: 'Nibura 1,000 RWF' },
  '788 123 456': { en: '788 123 456', fr: '788 123 456', rw: '788 123 456' },
});


Object.assign(UI, {
  'Cash payment': { en: 'Cash payment', fr: 'Paiement en espèces', rw: 'Ubwishyu bw’amafaranga mu ntoki' },
  'Your earnings': { en: 'Your earnings', fr: 'Vos revenus', rw: 'Amafaranga winjije' },
  'Done': { en: 'Done', fr: 'Terminé', rw: 'Byarangiye' },
  'I understand — continue': { en: 'I understand — continue', fr: 'Je comprends — continuer', rw: 'Ndabyumva — komeza' },
  'Offline': { en: 'Offline', fr: 'Hors ligne', rw: 'Nturi kumurongo' },
  'Slide to go offline': { en: 'Slide to go offline', fr: 'Glissez pour vous déconnecter', rw: 'Kurura ujye hanze y’umurongo' },
  'Going offline...': { en: 'Going offline...', fr: 'Déconnexion...', rw: 'Turimo kuva kumurongo...' },
  'Slide to go online': { en: 'Slide to go online', fr: 'Glissez pour vous connecter', rw: 'Kurura ujye kumurongo' },
  'Choose your mode...': { en: 'Choose your mode...', fr: 'Choisissez votre mode...', rw: 'Hitamo uburyo ushaka...' },
  'Online': { en: 'Online', fr: 'En ligne', rw: 'Uri kumurongo' },
  'Completed': { en: 'Completed', fr: 'Terminé', rw: 'Byarangiye' },
  'Online time': { en: 'Online time', fr: 'Temps en ligne', rw: 'Igihe uri kumurongo' },
  'Rating': { en: 'Rating', fr: 'Note', rw: 'Amanota' },
  'Passenger pickup requests': { en: 'Passenger pickup requests', fr: 'Demandes de prise en charge des passagers', rw: 'Ubusabe bwo gutwara abagenzi' },
  'Package delivery requests': { en: 'Package delivery requests', fr: 'Demandes de livraison de colis', rw: 'Ubusabe bwo kugeza ibintu' },
  'Rides and deliveries': { en: 'Rides and deliveries', fr: 'Courses et livraisons', rw: 'Ingendo no kugeza ibintu' },
  'Slide to accept ride': { en: 'Slide to accept ride', fr: 'Glissez pour accepter la course', rw: 'Kurura wemere urugendo' },
  'Accepting…': { en: 'Accepting…', fr: 'Acceptation…', rw: 'Turabyemera…' },
  'Accepted!': { en: 'Accepted!', fr: 'Acceptée !', rw: 'Byemejwe!' },
  'Could not go offline. Check your connection.': { en: 'Could not go offline. Check your connection.', fr: 'Impossible de se déconnecter. Vérifiez votre connexion.', rw: 'Ntibyashobotse kuva kumurongo. Reba umurongo wa internet.' },
  'Could not go online. Check your connection.': { en: 'Could not go online. Check your connection.', fr: 'Impossible de se connecter. Vérifiez votre connexion.', rw: 'Ntibyashobotse kujya kumurongo. Reba umurongo wa internet.' },
  'Someone else already took this ride.': { en: 'Someone else already took this ride.', fr: 'Un autre chauffeur a déjà accepté cette course.', rw: 'Undi mushoferi yamaze kwemera uru rugendo.' },
  'Could not accept — check your connection and try again.': { en: 'Could not accept — check your connection and try again.', fr: 'Impossible d’accepter — vérifiez votre connexion et réessayez.', rw: 'Ntibyashobotse kwemera — reba umurongo wa internet wongere ugerageze.' },
});

Object.assign(DRIVER_UI, {
  'Calling': { en: 'Calling', fr: 'Appel en cours', rw: 'Turahamagara' },
  'Connecting...': { en: 'Connecting...', fr: 'Connexion...', rw: 'Birimo guhuza...' },
  'Reconnecting...': { en: 'Reconnecting...', fr: 'Reconnexion...', rw: 'Birimo kongera guhuza...' },
  'Call ended': { en: 'Call ended', fr: 'Appel terminé', rw: 'Guhamagara byarangiye' },
  'Unable to connect': { en: 'Unable to connect', fr: 'Impossible de se connecter', rw: 'Ntibyashobotse guhuza' },
  'Zana Free Call · Connected': { en: 'Zana Free Call · Connected', fr: 'Zana · Appel gratuit · Connecté', rw: 'Zana · Guhamagara ku buntu · Byahujwe' },
  'Unmute': { en: 'Unmute', fr: 'Activer le son', rw: 'Fungura mikoro' },
  'Mute': { en: 'Mute', fr: 'Couper le son', rw: 'Zimya mikoro' },
  'End call': { en: 'End call', fr: 'Terminer l’appel', rw: 'Soza guhamagara' },
  'Unavailable': { en: 'Unavailable', fr: 'Indisponible', rw: 'Ntibishoboka' },
  'Speaker on': { en: 'Speaker on', fr: 'Haut-parleur activé', rw: 'Indangururamajwi irafunguye' },
  'Speaker': { en: 'Speaker', fr: 'Haut-parleur', rw: 'Indangururamajwi' },
});

Object.assign(DRIVER_UI, {
  'Insufficient balance': { en: 'Insufficient balance', fr: 'Solde insuffisant', rw: 'Amafaranga adahagije' },
  'Enter a valid phone number': { en: 'Enter a valid phone number', fr: 'Saisissez un numéro valide', rw: 'Andika numero ya telefoni yemewe' },
  'Processing…': { en: 'Processing…', fr: 'Traitement…', rw: 'Birimo gutunganywa…' },
  'Withdraw': { en: 'Withdraw', fr: 'Retirer', rw: 'Kuramo amafaranga' },
  "Today's earnings": { en: "Today's earnings", fr: 'Revenus du jour', rw: 'Amafaranga winjije uyu munsi' },
  'Cash collected today': { en: 'Cash collected today', fr: 'Espèces collectées aujourd’hui', rw: 'Amafaranga wakiriye mu ntoki uyu munsi' },
  'This week': { en: 'This week', fr: 'Cette semaine', rw: 'Muri iki cyumweru' },
  'Total earned': { en: 'Total earned', fr: 'Total gagné', rw: 'Amafaranga yose winjije' },
  'Balance owed to Zana': { en: 'Balance owed to Zana', fr: 'Solde dû à Zana', rw: 'Amafaranga ugomba Zana' },
  'Available to withdraw': { en: 'Available to withdraw', fr: 'Disponible à retirer', rw: 'Amafaranga ushobora gukuramo' },
  'Cancelled by passenger': { en: 'Cancelled by passenger', fr: 'Annulé par le passager', rw: 'Byahagaritswe n’umugenzi' },
  'You cancelled': { en: 'You cancelled', fr: 'Vous avez annulé', rw: 'Ni wowe wahagaritse' },
  'The customer cancelled this ride': { en: 'The customer cancelled this ride', fr: 'Le client a annulé cette course', rw: 'Umukiriya yahagaritse uru rugendo' },
  'This ride is no longer active': { en: 'This ride is no longer active', fr: 'Cette course n’est plus active', rw: 'Uru rugendo ntirukiri gukora' },
  'Microphone permission denied': { en: 'Microphone permission denied', fr: 'Permission du microphone refusée', rw: 'Uruhushya rwa mikoro rwanze' },
});

Object.assign(DRIVER_UI, {
  'Great driver!': { en: 'Great driver!', fr: 'Excellent chauffeur !', rw: 'Umushoferi mwiza!' },
  'Very punctual': { en: 'Very punctual', fr: 'Très ponctuel', rw: 'Akubahiriza igihe cyane' },
  'Safe driving': { en: 'Safe driving', fr: 'Conduite sûre', rw: 'Atwara neza' },
  'Friendly': { en: 'Friendly', fr: 'Aimable', rw: 'Afite urugwiro' },
  'Clean vehicle': { en: 'Clean vehicle', fr: 'Véhicule propre', rw: 'Imodoka isukuye' },
  'Submit Rating': { en: 'Submit Rating', fr: 'Envoyer la note', rw: 'Ohereza amanota' },
  'Skip': { en: 'Skip', fr: 'Passer', rw: 'Simbuka' },
  'Thanks for rating': { en: 'Thanks for rating', fr: 'Merci pour votre note', rw: 'Murakoze gutanga amanota' },
  'Chat with passenger': { en: 'Chat with passenger', fr: 'Discuter avec le passager', rw: 'Ganira n’umugenzi' },
  'Chat with merchant': { en: 'Chat with merchant', fr: 'Discuter avec le commerçant', rw: 'Ganira n’umucuruzi' },
  'Minimum withdrawal is 10,000 RWF': { en: 'Minimum withdrawal is 10,000 RWF', fr: 'Le retrait minimum est de 10 000 RWF', rw: 'Amafaranga make yo gukuramo ni 10,000 RWF' },
  'Withdrawal failed. Try again.': { en: 'Withdrawal failed. Try again.', fr: 'Le retrait a échoué. Réessayez.', rw: 'Gukuramo amafaranga byanze. Ongera ugerageze.' },
  'Could not reach the payment provider.': { en: 'Could not reach the payment provider.', fr: 'Impossible de joindre le prestataire de paiement.', rw: 'Ntibyashobotse kugera ku utanga serivisi y’ubwishyu.' },
  'Could not accept that delivery.': { en: 'Could not accept that delivery.', fr: 'Impossible d’accepter cette livraison.', rw: 'Ntibyashobotse kwemera iki kintu cyo kugeza.' },
  'Another rider took that one.': { en: 'Another rider took that one.', fr: 'Un autre chauffeur l’a déjà pris.', rw: 'Undi mushoferi yamaze kukijyana.' },
});


// Translation coverage additions for driver home/session UI.
Object.assign(DRIVER_UI, {
  'Ride completed successfully': { en: 'Ride completed successfully', fr: 'Course terminée avec succès', rw: 'Urugendo rwarangiye neza' },
  'Battery': { en: 'Battery', fr: 'Batterie', rw: 'Bateri' },
  'Good': { en: 'Good', fr: 'Bon', rw: 'Ni byiza' },
  'Choose your mode for this session.': { en: 'Choose your mode for this session.', fr: 'Choisissez votre mode pour cette session.', rw: 'Hitamo uburyo uzakoresha muri iyi serivisi.' },
  'Cash': { en: 'Cash', fr: 'Espèces', rw: 'Amafaranga y’ikiganza' },
  'Delivery Request': { en: 'Delivery Request', fr: 'Demande de livraison', rw: 'Ubusabe bwo kugeza ibintu' },
  'Menu': { en: 'Menu', fr: 'Menu', rw: 'Menyu' },
});
