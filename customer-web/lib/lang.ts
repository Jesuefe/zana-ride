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
  'Finding your driver…': { en: 'Finding your driver…', fr: 'Turimo gushaka umushoferi wawe…', rw: 'Turimo gushaka umushoferi wawe…' },
  'Driver assigned': { en: 'Driver assigned', fr: 'Chauffeur attribué', rw: 'Umushoferi yahawe urugendo' },
  'Driver is on the way': { en: 'Driver is on the way', fr: 'Umushoferi ari mu nzira', rw: 'Umushoferi ari mu nzira' },
  'Your driver has arrived': { en: 'Your driver has arrived', fr: 'Votre chauffeur est arrivé', rw: 'Umushoferi wawe yageze' },
  'On the way to your destination': { en: 'On the way to your destination', fr: 'Mu nzira igana aho ugiye', rw: 'Mu nzira igana aho ugiye' },
  'Trip completed': { en: 'Trip completed', fr: 'Urugendo rwarangiye', rw: 'Urugendo rwarangiye' },
  'No drivers available nearby': { en: 'No drivers available nearby', fr: 'Aucun chauffeur disponible à proximité', rw: 'Nta mushoferi uboneka hafi' },
  'Trip cancelled': { en: 'Trip cancelled', fr: 'Urugendo rwahagaritswe', rw: 'Urugendo rwahagaritswe' },
  'Your driver': { en: 'Your driver', fr: 'Umushoferi wawe', rw: 'Umushoferi wawe' },
  'rides': { en: 'rides', fr: 'ingendo', rw: 'ingendo' },
  'Check before you get in': { en: 'Check before you get in', fr: 'Reba mbere yo kwinjira', rw: 'Reba mbere yo kwinjira' },
  'Confirm this plate matches the car in front of you.': { en: 'Confirm this plate matches the car in front of you.', fr: 'Emeza ko iyi pulaka ihuye n\'imodoka iri imbere yawe.', rw: 'Emeza ko iyi pulaka ihuye n\'imodoka iri imbere yawe.' },
  'Driver is following the recommended route': { en: 'Driver is following the recommended route', fr: 'Umushoferi akurikira inzira yasabwe', rw: 'Umushoferi akurikira inzira yasabwe' },
  'motos': { en: 'motos', fr: 'amamoto', rw: 'amamoto' },
  'All trips completed': { en: 'All trips completed', fr: 'Ingendo zose zarangiye', rw: 'Ingendo zose zarangiye' },
  'to your pickup': { en: 'to your pickup', fr: 'ngo agere aho uri', rw: 'ngo agere aho uri' },
  'remaining': { en: 'remaining', fr: 'bisigaye', rw: 'bisigaye' },
  'Calculating ETA…': { en: 'Calculating ETA…', fr: 'Turimo kubara igihe agera…', rw: 'Turimo kubara igihe agera…' },
  'Shake your phone anytime to report a safety concern.': { en: 'Shake your phone anytime to report a safety concern.', fr: 'Nyeganyeza telefoni yawe igihe icyo ari cyo cyose kugira ngo utange ikibazo cy\'umutekano.', rw: 'Nyeganyeza telefoni yawe igihe icyo ari cyo cyose kugira ngo utange ikibazo cy\'umutekano.' },
  'Rate your ride': { en: 'Rate your ride', fr: 'Tanga amanota ku rugendo rwawe', rw: 'Tanga amanota ku rugendo rwawe' },
  'Report a problem': { en: 'Report a problem', fr: 'Tanga ikibazo', rw: 'Tanga ikibazo' },
  'Cancel Ride': { en: 'Cancel Ride', fr: 'Hagarika urugendo', rw: 'Hagarika urugendo' },
  'This ride has already started — report a problem instead.': { en: 'This ride has already started — report a problem instead.', fr: 'Uru rugendo rwatangiye — tanga ikibazo aho kubihagarika.', rw: 'Uru rugendo rwatangiye — tanga ikibazo aho kubihagarika.' },
  'Could not cancel. Try again.': { en: 'Could not cancel. Try again.', fr: 'Ntibyashobotse guhagarika. Ongera ugerageze.', rw: 'Ntibyashobotse guhagarika. Ongera ugerageze.' },
  'Could not join the call. Try calling again.': { en: 'Could not join the call. Try calling again.', fr: 'Ntibyashobotse kwinjira mu kuvugana. Ongera uhamagare.', rw: 'Ntibyashobotse kwinjira mu kuvugana. Ongera uhamagare.' },
  'Your driver cancelled this ride': { en: 'Your driver cancelled this ride', fr: 'Umushoferi wawe yahagaritse uru rugendo', rw: 'Umushoferi wawe yahagaritse uru rugendo' },
  'Incoming call': { en: 'Incoming call', fr: 'Uhamagawe', rw: 'Uhamagawe' },
  'Your driver is calling': { en: 'Your driver is calling', fr: 'Umushoferi wawe arakuhamagara', rw: 'Umushoferi wawe arakuhamagara' },
  'is calling': { en: 'is calling', fr: 'arakuhamagara', rw: 'arakuhamagara' },
  'Ride cancelled': { en: 'Ride cancelled', fr: 'Urugendo rwahagaritswe', rw: 'Urugendo rwahagaritswe' },
  'Book another ride': { en: 'Book another ride', fr: 'Fata urundi rugendo', rw: 'Fata urundi rugendo' },
  'your driver': { en: 'your driver', fr: 'umushoferi wawe', rw: 'umushoferi wawe' },
  'Driver': { en: 'Driver', fr: 'Chauffeur', rw: 'Umushoferi' },
  'Ride History': { en: 'Ride History', fr: 'Amateka y\'ingendo', rw: 'Amateka y\'ingendo' },
  'Total spent on rides': { en: 'Total spent on rides', fr: 'Amafaranga yose yakoreshejwe ku ngendo', rw: 'Amafaranga yose yakoreshejwe ku ngendo' },
  'Spent in': { en: 'Spent in', fr: 'Yakoreshejwe muri', rw: 'Yakoreshejwe muri' },
  'Total rides': { en: 'Total rides', fr: 'Ingendo zose', rw: 'Ingendo zose' },
  'Rides': { en: 'Rides', fr: 'Ingendo', rw: 'Ingendo' },
  'All time': { en: 'All time', fr: 'Igihe cyose', rw: 'Igihe cyose' },
  'No rides yet': { en: 'No rides yet', fr: 'Nta rugendo urahagira', rw: 'Nta rugendo urahagira' },
  'No rides in': { en: 'No rides in', fr: 'Nta rugendo muri', rw: 'Nta rugendo muri' },
  'No driver': { en: 'No driver', fr: 'Nta mushoferi', rw: 'Nta mushoferi' },
  'Completed': { en: 'Completed', fr: 'Byarangiye', rw: 'Byarangiye' },
  'Cancelled': { en: 'Cancelled', fr: 'Byahagaritswe', rw: 'Byahagaritswe' },
  'Driver cancelled': { en: 'Driver cancelled', fr: 'Umushoferi yahagaritse', rw: 'Umushoferi yahagaritse' },
  'Available balance': { en: 'Available balance', fr: 'Amafaranga uri kubona', rw: 'Amafaranga uri kubona' },
  'Recent transactions': { en: 'Recent transactions', fr: 'Ibikorwa vuba aha', rw: 'Ibikorwa vuba aha' },
  'No transactions yet.': { en: 'No transactions yet.', fr: 'Nta bikorwa birabaho.', rw: 'Nta bikorwa birabaho.' },
  'Top up': { en: 'Top up', fr: 'Kongeraho', rw: 'Kongeraho' },
  'Payment': { en: 'Payment', fr: 'Ubwishyu', rw: 'Ubwishyu' },
  'Ride recorded': { en: 'Ride recorded', fr: 'Urugendo rwanditswe', rw: 'Urugendo rwanditswe' },
  'Pending': { en: 'Pending', fr: 'Bitegereje', rw: 'Bitegereje' },
  'No charge': { en: 'No charge', fr: 'Nta kiguzi', rw: 'Nta kiguzi' },
  'Bal:': { en: 'Bal:', fr: 'Amasigaye:', rw: 'Amasigaye:' },
  'Top up with Mobile Money': { en: 'Top up with Mobile Money', fr: 'Ongeraho ukoresheje Mobile Money', rw: 'Ongeraho ukoresheje Mobile Money' },
  'Mobile money number': { en: 'Mobile money number', fr: 'Numero ya Mobile Money', rw: 'Numero ya Mobile Money' },
  'Amount (RWF)': { en: 'Amount (RWF)', fr: 'Amafaranga (RWF)', rw: 'Amafaranga (RWF)' },
  'Request payment': { en: 'Request payment', fr: 'Saba ubwishyu', rw: 'Saba ubwishyu' },
  'Check your phone': { en: 'Check your phone', fr: 'Reba kuri telefoni yawe', rw: 'Reba kuri telefoni yawe' },
  'Approve the': { en: 'Approve the', fr: 'Emeza', rw: 'Emeza' },
  'mobile money request sent to': { en: 'mobile money request sent to', fr: 'ubusabe bwa mobile money bwoherejwe kuri', rw: 'ubusabe bwa mobile money bwoherejwe kuri' },
  'Top-up successful': { en: 'Top-up successful', fr: 'Kongeraho byagenze neza', rw: 'Kongeraho byagenze neza' },
  'Your wallet has been credited.': { en: 'Your wallet has been credited.', fr: 'Amafaranga yawe yongewe.', rw: 'Amafaranga yawe yongewe.' },
  'Done': { en: 'Done', fr: 'Byarangiye', rw: 'Byarangiye' },
  'Payment failed or was declined': { en: 'Payment failed or was declined', fr: 'Ubwishyu bwanze cyangwa bwanzwe', rw: 'Ubwishyu bwanze cyangwa bwanzwe' },
  'Try again': { en: 'Try again', fr: 'Ongera ugerageze', rw: 'Ongera ugerageze' },
  'Could not reach the payment provider.': { en: 'Could not reach the payment provider.', fr: 'Ntibyashobotse guhuza n\'uwishyura.', rw: 'Ntibyashobotse guhuza n\'uwishyura.' },
  'Cash': { en: 'Cash', fr: 'Amafaranga', rw: 'Amafaranga' },
  'Zana Wallet': { en: 'Zana Wallet', fr: 'Amafaranga ya Zana', rw: 'Amafaranga ya Zana' },
  'Mobile Money': { en: 'Mobile Money', fr: 'Mobile Money', rw: 'Mobile Money' },
  'Trip completed ·': { en: 'Trip completed ·', fr: 'Urugendo rwarangiye ·', rw: 'Urugendo rwarangiye ·' },
  'Route': { en: 'Route', fr: 'Inzira', rw: 'Inzira' },
  'Pickup': { en: 'Pickup', fr: 'Gutora', rw: 'Gutora' },
  'Destination': { en: 'Destination', fr: 'Aho ugiye', rw: 'Aho ugiye' },
  'Fare breakdown': { en: 'Fare breakdown', fr: 'Ibisobanuro by\'ikiguzi', rw: 'Ibisobanuro by\'ikiguzi' },
  'Base fare': { en: 'Base fare', fr: 'Ikiguzi shingiro', rw: 'Ikiguzi shingiro' },
  'Total charged': { en: 'Total charged', fr: 'Byose byishyuwe', rw: 'Byose byishyuwe' },
  'Trip details': { en: 'Trip details', fr: 'Ibisobanuro by\'urugendo', rw: 'Ibisobanuro by\'urugendo' },
  'Date': { en: 'Date', fr: 'Itariki', rw: 'Itariki' },
  'Service type': { en: 'Service type', fr: 'Ubwoko bw\'umurimo', rw: 'Ubwoko bw\'umurimo' },
  'Trip ID': { en: 'Trip ID', fr: 'Nomero y\'urugendo', rw: 'Nomero y\'urugendo' },
  'Zana Points earned': { en: 'Zana Points earned', fr: 'Amanota ya Zana wabonye', rw: 'Amanota ya Zana wabonye' },
  'Points added to your account': { en: 'Points added to your account', fr: 'Amanota yongewe kuri konti yawe', rw: 'Amanota yongewe kuri konti yawe' },
  'Back to Home': { en: 'Back to Home', fr: 'Subira ahabanza', rw: 'Subira ahabanza' },
  'Finding courier': { en: 'Finding courier', fr: 'Gushaka umutwara', rw: 'Gushaka umutwara' },
  'Courier assigned': { en: 'Courier assigned', fr: 'Umutwara yahawe umurimo', rw: 'Umutwara yahawe umurimo' },
  'On the way': { en: 'On the way', fr: 'Ari mu nzira', rw: 'Ari mu nzira' },
  'Delivered': { en: 'Delivered', fr: 'Byatanzwe', rw: 'Byatanzwe' },
  'Confirmed': { en: 'Confirmed', fr: 'Byemejwe', rw: 'Byemejwe' },
  'Preparing': { en: 'Preparing', fr: 'Birategurwa', rw: 'Birategurwa' },
  'Ready for pickup': { en: 'Ready for pickup', fr: 'Biteguye gutorwa', rw: 'Biteguye gutorwa' },
  'My Activity': { en: 'My Activity', fr: 'Ibikorwa byanjye', rw: 'Ibikorwa byanjye' },
  'Deliveries': { en: 'Deliveries', fr: 'Ibyoherejwe', rw: 'Ibyoherejwe' },
  'No orders yet. Try Food or Gifts!': { en: 'No orders yet. Try Food or Gifts!', fr: 'Nta bicuruzwa urahagira. Gerageza Ibiryo cyangwa Impano!', rw: 'Nta bicuruzwa urahagira. Gerageza Ibiryo cyangwa Impano!' },
  'Your deliveries will show up here.': { en: 'Your deliveries will show up here.', fr: 'Ibicuruzwa byawe bizagaragara hano.', rw: 'Ibicuruzwa byawe bizagaragara hano.' },
  'How was this delivery?': { en: 'How was this delivery?', fr: 'Ese iki gicuruzwa cyagenze gite?', rw: 'Ese iki gicuruzwa cyagenze gite?' },
  'Rate this delivery': { en: 'Rate this delivery', fr: 'Tanga amanota kuri iki gicuruzwa', rw: 'Tanga amanota kuri iki gicuruzwa' },
  'Ride': { en: 'Ride', fr: 'Urugendo', rw: 'Urugendo' },
  'Affordable & safe': { en: 'Affordable & safe', fr: 'Abordable et sûr', rw: 'Ku giciro cyiza kandi bifite umutekano' },
  'Moto Ride': { en: 'Moto Ride', fr: 'Urugendo rwa Moto', rw: 'Urugendo rwa Moto' },
  'Fast & reliable': { en: 'Fast & reliable', fr: 'Rapide et fiable', rw: 'Byihuta kandi byizewe' },
  'Delivery': { en: 'Delivery', fr: 'Kohereza', rw: 'Kohereza' },
  'Send anything': { en: 'Send anything', fr: 'Ohereza icyo cyose', rw: 'Ohereza icyo cyose' },
  'Order Food': { en: 'Order Food', fr: 'Saba Ibiryo', rw: 'Saba Ibiryo' },
  'Meals & drinks': { en: 'Meals & drinks', fr: 'Ibiryo n\'ibinyobwa', rw: 'Ibiryo n\'ibinyobwa' },
  'Shop': { en: 'Shop', fr: 'Guhaha', rw: 'Guhaha' },
  'Groceries & goods': { en: 'Groceries & goods', fr: 'Ibiribwa n\'ibindi bicuruzwa', rw: 'Ibiribwa n\'ibindi bicuruzwa' },
  'Send Gift': { en: 'Send Gift', fr: 'Ohereza Impano', rw: 'Ohereza Impano' },
  'Roses & surprises': { en: 'Roses & surprises', fr: 'Amaroza n\'ibitunguranye', rw: 'Amaroza n\'ibitunguranye' },
  'Market': { en: 'Market', fr: 'Isoko', rw: 'Isoko' },
  'Agent shops for you': { en: 'Agent shops for you', fr: 'Umukozi arakuguriza', rw: 'Umukozi arakuguriza' },
  'All services': { en: 'All services', fr: 'Serivisi zose', rw: 'Serivisi zose' },
  'Photo of the item': { en: 'Photo of the item', fr: 'Photo de l’article', rw: 'Ifoto y’ikintu },
  'Take a photo': { en: 'Take a photo', fr: 'Prendre une photo', rw: 'Fata ifoto },
  'Opening camera…': { en: 'Opening camera…', fr: 'Ouverture de la caméra…', rw: 'Turafungura kamera… },
  'or choose from your gallery': { en: 'or choose from your gallery', fr: 'ou choisissez dans votre galerie', rw: 'cyangwa uhitemo mu mafoto yawe },
  'Pickup location': { en: 'Pickup location', fr: 'Lieu de prise en charge', rw: 'Aho ufatirwa },
  'Drag the green pin on the map to adjust.': { en: 'Drag the green pin on the map to adjust.', fr: 'Déplacez le repère vert sur la carte pour ajuster.', rw: 'Kurura akamenyetso k’icyatsi ku ikarita kugira ngo uhindure aho ufatirwa. },
  'Delivery location': { en: 'Delivery location', fr: 'Lieu de livraison', rw: 'Aho kugeza },
  'Search for the delivery address': { en: 'Search for the delivery address', fr: 'Rechercher l’adresse de livraison', rw: 'Shakisha aho kugeza },
  'Use code': { en: 'Use code', fr: 'Utiliser le code', rw: 'Koresha kode },
  'Receiver can\'t explain their address? Ask them to send you their Zana location code.': { en: 'Receiver can\'t explain their address? Ask them to send you their Zana location code.', fr: 'Le destinataire ne peut pas expliquer son adresse ? Demandez-lui d’envoyer son code de localisation Zana.', rw: 'Uwo wohereza ntashobora gusobanura aho ari? Musabe akohereze kode y’aho ari ya Zana. },
  'Receiver\'s name (optional)': { en: 'Receiver\'s name (optional)', fr: 'Nom du destinataire (facultatif)', rw: 'Izina ry’uwo wohereza (si ngombwa) },
  'Delivery fee': { en: 'Delivery fee', fr: 'Frais de livraison', rw: 'Amafaranga yo kugeza },
  'How will you pay?': { en: 'How will you pay?', fr: 'Comment allez-vous payer ?', rw: 'Uzarishyura ute? },
  'Tap to view order details': { en: 'Tap to view order details', fr: 'Appuyez pour voir les détails de la commande', rw: 'Kanda urebe ibisobanuro by’itegeko },
  'Order summary': { en: 'Order summary', fr: 'Résumé de la commande', rw: 'Incamake y’itegeko },
  'Items': { en: 'Items', fr: 'Articles', rw: 'Ibicuruzwa },
  'Total': { en: 'Total', fr: 'Total', rw: 'Byose hamwe },
  'Delivery recipient': { en: 'Delivery recipient', fr: 'Destinataire de la livraison', rw: 'Uwo kugeza },
  'RWF total': { en: 'RWF total', fr: 'Total en RWF', rw: 'Igiteranyo muri RWF },
  'Ride Scheduled': { en: 'Ride Scheduled', fr: 'Course programmée', rw: 'Urugendo rwateguwe },
  'Confirmed for': { en: 'Confirmed for', fr: 'Confirmée pour', rw: 'Byemejwe kuri },
  'Schedule a Ride': { en: 'Schedule a Ride', fr: 'Programmer une course', rw: 'Teganya urugendo },
  'Book up to 24 hours in advance': { en: 'Book up to 24 hours in advance', fr: 'Réservez jusqu’à 24 heures à l’avance', rw: 'Teganya kugera ku masaha 24 mbere },
  'Where should we pick you up?': { en: 'Where should we pick you up?', fr: 'Oduza he?', rw: 'Tuzagufatira he? },
  'Where are you going?': { en: 'Where are you going?', fr: 'Mujya he?', rw: 'Ugiye he? },
  'Pickup time': { en: 'Pickup time', fr: 'Heure de prise en charge', rw: 'Igihe cyo gufatwa },
  'Ride type': { en: 'Ride type', fr: 'Type de course', rw: 'Ubwoko bw’urugendo },
  'Special request (optional)': { en: 'Special request (optional)', fr: 'Demande spéciale (facultatif)', rw: 'Icyifuzo cyihariye (si ngombwa) },
  'Scheduling...': { en: 'Scheduling...', fr: 'Programmation...', rw: 'Turateganya... },
  'Schedule Ride': { en: 'Schedule Ride', fr: 'Programmer la course', rw: 'Teganya urugendo },
  'Shop & Deliver': { en: 'Shop & Deliver', fr: 'Acheter et faire livrer', rw: 'Gura kandi ugezweho },
  'No shops available yet.': { en: 'No shops available yet.', fr: 'Aucun magasin disponible pour le moment.', rw: 'Nta maduka arahari ubu. },
  'Food & Drinks': { en: 'Food & Drinks', fr: 'Nourriture et boissons', rw: 'Ibiribwa n’ibinyobwa },
  'No restaurants available yet.': { en: 'No restaurants available yet.', fr: 'Aucun restaurant disponible pour le moment.', rw: 'Nta maresitora arahari ubu. },

};


// Reviewed Rwanda-facing translations for the core customer dashboard.
Object.assign(UI, {
  'Wallet Balance': { en: 'Wallet Balance', fr: 'Solde du portefeuille', rw: 'Amafaranga asigaye mu gikapo' },
  'Top Up': { en: 'Top Up', fr: 'Recharger', rw: 'Ongeramo amafaranga' },
  'Orders': { en: 'Orders', fr: 'Commandes', rw: 'Amabwiriza' },
  'Home': { en: 'Home', fr: 'Accueil', rw: 'Ahabanza' },
  'Chat': { en: 'Chat', fr: 'Discussion', rw: 'Kuganira' },
  'Finding your driver…': { en: 'Finding your driver…', fr: 'Recherche de votre chauffeur…', rw: 'Turimo gushaka umushoferi wawe…' },
  'Driver assigned': { en: 'Driver assigned', fr: 'Chauffeur attribué', rw: 'Umushoferi yagenewe urugendo' },
  'Driver is on the way': { en: 'Driver is on the way', fr: 'Le chauffeur est en route', rw: 'Umushoferi ari mu nzira' },
  'Your driver has arrived': { en: 'Your driver has arrived', fr: 'Votre chauffeur est arrivé', rw: 'Umushoferi wawe yageze' },
  'Trip completed': { en: 'Trip completed', fr: 'Trajet terminé', rw: 'Urugendo rwarangiye' },
  'No drivers available nearby': { en: 'No drivers available nearby', fr: 'Aucun chauffeur disponible à proximité', rw: 'Nta mushoferi uri hafi uboneka' },
  'Trip cancelled': { en: 'Trip cancelled', fr: 'Trajet annulé', rw: 'Urugendo rwahagaritswe' },
  'Cancel Ride': { en: 'Cancel Ride', fr: 'Annuler le trajet', rw: 'Hagarika urugendo' },
  'Could not cancel. Try again.': { en: 'Could not cancel. Try again.', fr: 'Impossible d’annuler. Réessayez.', rw: 'Ntibyashobotse guhagarika. Ongera ugerageze.' },
  'Rate your ride': { en: 'Rate your ride', fr: 'Évaluez votre trajet', rw: 'Tanga amanota ku rugendo rwawe' },
  'Report a problem': { en: 'Report a problem', fr: 'Signaler un problème', rw: 'Tanga raporo y’ikibazo' },
  'Ride History': { en: 'Ride History', fr: 'Historique des trajets', rw: 'Amateka y’ingendo' },
  'Total spent on rides': { en: 'Total spent on rides', fr: 'Total dépensé pour les trajets', rw: 'Amafaranga yose yakoreshejwe mu ngendo' },
  'Total rides': { en: 'Total rides', fr: 'Nombre total de trajets', rw: 'Umubare w’ingendo zose' },
  'No rides yet': { en: 'No rides yet', fr: 'Aucun trajet pour le moment', rw: 'Nta rugendo uragira' },
  'Completed': { en: 'Completed', fr: 'Terminé', rw: 'Byarangiye' },
  'Cancelled': { en: 'Cancelled', fr: 'Annulé', rw: 'Byahagaritswe' },
  'Available balance': { en: 'Available balance', fr: 'Solde disponible', rw: 'Amafaranga ushobora gukoresha' },
  'Recent transactions': { en: 'Recent transactions', fr: 'Transactions récentes', rw: 'Ibikorwa biheruka' },
  'No transactions yet.': { en: 'No transactions yet.', fr: 'Aucune transaction pour le moment.', rw: 'Nta bikorwa birabaho.' },
  'Payment': { en: 'Payment', fr: 'Paiement', rw: 'Kwishyura' },
  'Pending': { en: 'Pending', fr: 'En attente', rw: 'Biracyategerejwe' },
  'Cash': { en: 'Cash', fr: 'Espèces', rw: 'Amafaranga y’inguzanyo y’amaboko' },
  'Mobile Money': { en: 'Mobile Money', fr: 'Mobile Money', rw: 'Mobile Money' },
  'Pickup': { en: 'Pickup', fr: 'Prise en charge', rw: 'Aho utorerwa' },
  'Destination': { en: 'Destination', fr: 'Destination', rw: 'Aho ugiye' },
  'Fare breakdown': { en: 'Fare breakdown', fr: 'Détail du tarif', rw: 'Ibisobanuro by’ikiguzi' },
  'Base fare': { en: 'Base fare', fr: 'Tarif de base', rw: 'Ikiguzi shingiro' },
  'Total charged': { en: 'Total charged', fr: 'Total facturé', rw: 'Amafaranga yose wishyuye' },
  'Trip details': { en: 'Trip details', fr: 'Détails du trajet', rw: 'Ibisobanuro by’urugendo' },
  'Date': { en: 'Date', fr: 'Date', rw: 'Itariki' },
  'Service type': { en: 'Service type', fr: 'Type de service', rw: 'Ubwoko bwa serivisi' },
  'Trip ID': { en: 'Trip ID', fr: 'ID du trajet', rw: 'Nomero y’urugendo' },
  'Back to Home': { en: 'Back to Home', fr: 'Retour à l’accueil', rw: 'Subira ahabanza' },
  'Delivery': { en: 'Delivery', fr: 'Livraison', rw: 'Kohereza' },
  'Order Food': { en: 'Order Food', fr: 'Commander à manger', rw: 'Gutegeka ibiryo' },
  'Shop': { en: 'Shop', fr: 'Boutique', rw: 'Guhaha' },
  'Send Gift': { en: 'Send Gift', fr: 'Envoyer un cadeau', rw: 'Ohereza impano' },
  'Market': { en: 'Market', fr: 'Marché', rw: 'Isoko' },
  'All services': { en: 'All services', fr: 'Tous les services', rw: 'Serivisi zose' },
});

Object.assign(UI, {
  'Account settings': { en: 'Account settings', fr: 'Paramètres du compte', rw: 'Igenamiterere rya konti' },
  'Saved places': { en: 'Saved places', fr: 'Lieux enregistrés', rw: 'Ahantu wabikiye' },
  'Ride history': { en: 'Ride history', fr: 'Historique des trajets', rw: 'Amateka y’ingendo' },
  'Zana Points': { en: 'Zana Points', fr: 'Points Zana', rw: 'Amanota ya Zana' },
  'Safety': { en: 'Safety', fr: 'Sécurité', rw: 'Umutekano' },
  'Help & support': { en: 'Help & support', fr: 'Aide et assistance', rw: 'Ubufasha na serivisi' },
  'Log out': { en: 'Log out', fr: 'Se déconnecter', rw: 'Sohoka' },
});

Object.assign(UI, {
  'Change language': { en: 'Change language', fr: 'Changer de langue', rw: 'Hindura ururimi' },
});

Object.assign(UI, {
  'Good morning,': { en: 'Good morning,', fr: 'Bonjour,', rw: 'Mwaramutse,' },
  'Good afternoon,': { en: 'Good afternoon,', fr: 'Bon après-midi,', rw: 'Mwiriwe,' },
  'Good evening,': { en: 'Good evening,', fr: 'Bonsoir,', rw: 'Mwiriwe neza,' },
  'Welcome': { en: 'Welcome', fr: 'Bienvenue', rw: 'Murakaza neza' },
  'Kigali, Rwanda': { en: 'Kigali, Rwanda', fr: 'Kigali, Rwanda', rw: 'Kigali, Rwanda' },
  "Couldn't load your info. Check your connection.": { en: "Couldn't load your info. Check your connection.", fr: 'Impossible de charger vos informations. Vérifiez votre connexion.', rw: 'Ntibyashobotse kubona amakuru yawe. Reba umurongo wa internet.' },
  'Retry': { en: 'Retry', fr: 'Réessayer', rw: 'Ongera ugerageze' },
  'Where to?': { en: 'Where to?', fr: 'Où allez-vous ?', rw: 'Ujya he?' },
  'Search destination': { en: 'Search destination', fr: 'Rechercher une destination', rw: 'Shaka aho ugiye' },
  'No trips yet': { en: 'No trips yet', fr: 'Aucun trajet pour le moment', rw: 'Nta rugendo uragira' },
  'Set location': { en: 'Set location', fr: 'Définir le lieu', rw: 'Shyiraho ahantu' },
  'Work': { en: 'Work', fr: 'Travail', rw: 'Akazi' },
  'Recent': { en: 'Recent', fr: 'Récent', rw: 'Aheruka' },
  'Services': { en: 'Services', fr: 'Services', rw: 'Serivisi' },
  'Send packages with': { en: 'Send packages with', fr: 'Envoyez vos colis avec', rw: 'Ohereza ibicuruzwa ukoresheje' },
  'Zana Delivery': { en: 'Zana Delivery', fr: 'Zana Delivery', rw: 'Zana Delivery' },
  'Fast · Safe · Affordable': { en: 'Fast · Safe · Affordable', fr: 'Rapide · Sûr · Abordable', rw: 'Byihuse · Biteye umutekano · Bihendutse' },
  'Book now': { en: 'Book now', fr: 'Réserver maintenant', rw: 'Tanga ubusabe ubu' },
  'Pay with your Zana Wallet': { en: 'Pay with your Zana Wallet', fr: 'Payez avec votre portefeuille Zana', rw: 'Ishyura ukoresheje Zana Wallet yawe' },
  'Lower fees than Mobile Money, and no waiting for a payment prompt.': { en: 'Lower fees than Mobile Money, and no waiting for a payment prompt.', fr: 'Frais moins élevés que Mobile Money, sans attendre une demande de paiement.', rw: 'Kwishyura bihendutse kurusha Mobile Money kandi ntutegereze ubusabe bwo kwishyura.' },
  'Schedule': { en: 'Schedule', fr: 'Planifier', rw: 'Teganya' },
  'Location': { en: 'Location', fr: 'Localisation', rw: 'Aho uri' },
  'Going to': { en: 'Going to', fr: 'Direction', rw: 'Ugiye kuri' },
  'Moto': { en: 'Moto', fr: 'Moto', rw: 'Moto' },
  'Fast & cheap': { en: 'Fast & cheap', fr: 'Rapide et économique', rw: 'Byihuse kandi bihendutse' },
});

export function t(key: string, lang: Lang): string {
  return UI[key]?.[lang] ?? key;
}


Object.assign(UI, {
  'Welcome': { en: 'Welcome', fr: 'Bienvenue', rw: 'Murakaza neza' },
  'Good morning,': { en: 'Good morning,', fr: 'Bonjour,', rw: 'Mwaramutse,' },
  'Good afternoon,': { en: 'Good afternoon,', fr: 'Bon après-midi,', rw: 'Mwiriwe,' },
  'Good evening,': { en: 'Good evening,', fr: 'Bonsoir,', rw: 'Mwiriwe neza,' },
  'Kigali, Rwanda': { en: 'Kigali, Rwanda', fr: 'Kigali, Rwanda', rw: 'Kigali, u Rwanda' },
  "Couldn't load your info. Check your connection.": { en: "Couldn't load your info. Check your connection.", fr: "Impossible de charger vos informations. Vérifiez votre connexion.", rw: "Ntitwashoboye kubona amakuru yawe. Reba umurongo wa interineti." },
  'Retry': { en: 'Retry', fr: 'Réessayer', rw: 'Ongera ugerageze' },
  'Where to?': { en: 'Where to?', fr: 'Où allez-vous ?', rw: 'Mujya he?' },
  'Search destination': { en: 'Search destination', fr: 'Rechercher une destination', rw: 'Shaka aho ugiye' },
  'No trips yet': { en: 'No trips yet', fr: 'Aucun trajet pour le moment', rw: 'Nta rugendo uragira' },
  'Set location': { en: 'Set location', fr: 'Définir le lieu', rw: 'Shyiraho aho uherereye' },
  'Services': { en: 'Services', fr: 'Services', rw: 'Serivisi' },
  'Send packages with': { en: 'Send packages with', fr: 'Envoyez des colis avec', rw: 'Ohereza amapaki ukoresheje' },
  'Zana Delivery': { en: 'Zana Delivery', fr: 'Zana Delivery', rw: 'Zana Delivery' },
  'Fast · Safe · Affordable': { en: 'Fast · Safe · Affordable', fr: 'Rapide · Sûr · Abordable', rw: 'Byihuta · Bitekanye · Ku giciro cyiza' },
  'Book now': { en: 'Book now', fr: 'Réserver', rw: 'Fata ubu' },
  'delivery': { en: 'delivery', fr: 'livraison', rw: 'kohereza' },
  'Pay with your Zana Wallet': { en: 'Pay with your Zana Wallet', fr: 'Payez avec votre portefeuille Zana', rw: 'Ishyura ukoresheje Zana Wallet' },
  'Lower fees than Mobile Money, and no waiting for a payment prompt.': { en: 'Lower fees than Mobile Money, and no waiting for a payment prompt.', fr: "Frais moins élevés que Mobile Money, sans attendre une demande de paiement.", rw: 'Ni amafaranga make ugereranyije na Mobile Money, kandi nta gutegereza ubutumwa bw’ubwishyu.' },
  'Schedule': { en: 'Schedule', fr: 'Planifier', rw: 'Teganya' },
  'Location': { en: 'Location', fr: 'Localisation', rw: 'Aho uherereye' },
  'Going to': { en: 'Going to', fr: 'Vers', rw: 'Ugiye kuri' },
  'Fast & cheap': { en: 'Fast & cheap', fr: 'Rapide et économique', rw: 'Byihuta kandi bihendutse' },
  'Car': { en: 'Car', fr: 'Voiture', rw: 'Imodoka' },
  'Comfortable': { en: 'Comfortable', fr: 'Confortable', rw: 'Byoroheye' },
  'Change this saved place': { en: 'Change this saved place', fr: 'Modifier ce lieu enregistré', rw: 'Hindura aha hantu wabikiye' },
  'Account Settings': { en: 'Account Settings', fr: 'Paramètres du compte', rw: 'Igenamiterere rya konti' },
  'Personal Info': { en: 'Personal Info', fr: 'Informations personnelles', rw: 'Amakuru bwite' },
  'First Name': { en: 'First Name', fr: 'Prénom', rw: 'Izina bwite' },
  'Last Name': { en: 'Last Name', fr: 'Nom', rw: 'Izina ry’umuryango' },
  'Email': { en: 'Email', fr: 'E-mail', rw: 'Imeyili' },
  'Save Changes': { en: 'Save Changes', fr: 'Enregistrer les modifications', rw: 'Bika impinduka' },
  'Saved': { en: 'Saved', fr: 'Enregistré', rw: 'Byabitswe' },
  'Could not save changes.': { en: 'Could not save changes.', fr: 'Impossible d’enregistrer les modifications.', rw: 'Ntibyashobotse kubika impinduka.' },
});

Object.assign(UI, {
  'Messages auto-translate · History clears after ride': { en: 'Messages auto-translate · History clears after ride', fr: 'Les messages sont traduits automatiquement · L’historique est effacé après le trajet', rw: 'Ubutumwa buhindurwa ururimi mu buryo bwikora · Amateka asibwa urugendo rurangiye' },
  'No messages yet. Say hello!': { en: 'No messages yet. Say hello!', fr: 'Aucun message pour le moment. Dites bonjour !', rw: 'Nta butumwa burabaho. Vuga uti muraho!' },
  'Thank you!': { en: 'Thank you!', fr: 'Merci !', rw: 'Murakoze!' },
  'How was your ride with': { en: 'How was your ride with', fr: 'Urugendo rwanyu na', rw: 'Urugendo rwanyu na' },
  '?': { en: '?', fr: '?', rw: '?' },
  'Add a comment (optional)': { en: 'Add a comment (optional)', fr: 'Ajouter un commentaire (facultatif)', rw: 'Ongeraho igitekerezo (ntibitegetswe)' },
  'Report sent': { en: 'Report sent', fr: 'Rapport envoyé', rw: 'Raporo yoherejwe' },
  'Report an issue': { en: 'Report an issue', fr: 'Signaler un problème', rw: 'Tanga raporo y’ikibazo' },
  "Is everything okay? Select what's happening.": { en: "Is everything okay? Select what's happening.", fr: 'Tout va bien ? Sélectionnez ce qui se passe.', rw: 'Byose ni amahoro? Hitamo ikibazo kiri kuba.' },
  'Tell us what happened': { en: 'Tell us what happened', fr: 'Dites-nous ce qui s’est passé', rw: 'Tubwire ibyabaye' },
  'Anything you want to add? (optional)': { en: 'Anything you want to add? (optional)', fr: 'Quelque chose à ajouter ? (facultatif)', rw: 'Hari icyo ushaka kongeraho? (ntibitegetswe)' },
  'Choose a ride': { en: 'Choose a ride', fr: 'Choisissez un trajet', rw: 'Hitamo urugendo' },
  'Payment method': { en: 'Payment method', fr: 'Mode de paiement', rw: 'Uburyo bwo kwishyura' },
  '💳 How will you pay?': { en: '💳 How will you pay?', fr: '💳 Comment allez-vous payer ?', rw: '💳 Ugiye kwishyura ute?' },
  'Insufficient wallet balance': { en: 'Insufficient wallet balance', fr: 'Solde du portefeuille insuffisant', rw: 'Amafaranga ari mu gikapo ntabwo ahagije' },
});

Object.assign(UI, {
  'Food': { en: 'Food', fr: 'Nourriture', rw: 'Ibiryo' },
  'Clothes': { en: 'Clothes', fr: 'Vêtements', rw: 'Imyenda' },
  'Documents': { en: 'Documents', fr: 'Documents', rw: 'Inyandiko' },
  'Package': { en: 'Package', fr: 'Colis', rw: 'Ipaki' },
  'Medicine': { en: 'Medicine', fr: 'Médicaments', rw: 'Imiti' },
  'Groceries': { en: 'Groceries', fr: 'Produits alimentaires', rw: 'Ibicuruzwa byo mu rugo' },
  'Gift': { en: 'Gift', fr: 'Cadeau', rw: 'Impano' },
  'Electronics': { en: 'Electronics', fr: 'Électronique', rw: 'Ibikoresho bya elegitoroniki' },
  'Shoes': { en: 'Shoes', fr: 'Chaussures', rw: 'Inkweto' },
  'Books': { en: 'Books', fr: 'Livres', rw: 'Ibitabo' },
  'Cosmetics': { en: 'Cosmetics', fr: 'Cosmétiques', rw: 'Amavuta n’ibikoresho by’ubwiza' },
  'Household': { en: 'Household', fr: 'Articles ménagers', rw: 'Ibikoresho byo mu rugo' },
  'Other': { en: 'Other', fr: 'Autre', rw: 'Ibindi' },
  'Current location': { en: 'Current location', fr: 'Position actuelle', rw: 'Aho uri ubu' },
  'Could not process that image.': { en: 'Could not process that image.', fr: 'Impossible de traiter cette image.', rw: 'Ntibyashobotse gutunganya iyo foto.' },
  'Could not take that photo. Try again.': { en: 'Could not take that photo. Try again.', fr: 'Impossible de prendre cette photo. Réessayez.', rw: 'Ntibyashobotse gufata iyo foto. Ongera ugerageze.' },
  'Could not check that code.': { en: 'Could not check that code.', fr: 'Impossible de vérifier ce code.', rw: 'Ntibyashobotse kugenzura iyo kode.' },
  'Shared location': { en: 'Shared location', fr: 'Position partagée', rw: 'Aho wasangijwe' },
  'Payment was not confirmed. The delivery was cancelled — you can try again.': { en: 'Payment was not confirmed. The delivery was cancelled — you can try again.', fr: 'Le paiement n’a pas été confirmé. La livraison a été annulée — vous pouvez réessayer.', rw: 'Ubwishyu ntabwo bwemejwe. Kohereza byahagaritswe — ushobora kongera kugerageza.' },
  'Not enough in your wallet. Balance {{balance}} RWF, delivery costs {{cost}} RWF.': { en: 'Not enough in your wallet. Balance {{balance}} RWF, delivery costs {{cost}} RWF.', fr: 'Solde insuffisant. Solde {{balance}} RWF, livraison {{cost}} RWF.', rw: 'Amafaranga yo mu gikapo ntabwo ahagije. Asigaye {{balance}} RWF, kohereza ni {{cost}} RWF.' },
  'Could not reach Mobile Money. Check the number and try again.': { en: 'Could not reach Mobile Money. Check the number and try again.', fr: 'Impossible de joindre Mobile Money. Vérifiez le numéro et réessayez.', rw: 'Ntibyashobotse kugera kuri Mobile Money. Reba nimero wongere ugerageze.' },
  'Could not create the delivery.': { en: 'Could not create the delivery.', fr: 'Impossible de créer la livraison.', rw: 'Ntibyashobotse gutangiza kohereza.' },
  'Send a package': { en: 'Send a package', fr: 'Envoyer un colis', rw: 'Ohereza ipaki' },
  'What are you sending?': { en: 'What are you sending?', fr: 'Ohereza iki?', rw: 'Urimo kohereza iki?' },
  'Additional details': { en: 'Additional details', fr: 'Détails supplémentaires', rw: 'Andi makuru' },
  'optional': { en: 'optional', fr: 'facultatif', rw: 'ntibitegetswe' },
  'e.g. 2 plates of food and 1 bottle of juice': { en: 'e.g. 2 plates of food and 1 bottle of juice', fr: 'ex. 2 assiettes de nourriture et 1 bouteille de jus', rw: 'urugero: amasahani 2 y’ibiryo n’icupa 1 ry’umutobe' },
  'Approximate weight': { en: 'Approximate weight', fr: 'Poids approximatif', rw: 'Uburemere bugereranyijwe' },
  'Receiver': { en: 'Receiver', fr: 'Destinataire', rw: 'Uwakira' },
  'Receiver name': { en: 'Receiver name', fr: 'Nom du destinataire', rw: 'Izina ry’uwakira' },
  'Phone number': { en: 'Phone number', fr: 'Numéro de téléphone', rw: 'Nimero ya telefoni' },
  'Wallet': { en: 'Wallet', fr: 'Portefeuille', rw: 'Igikapo' },
  'Mobile Money': { en: 'Mobile Money', fr: 'Mobile Money', rw: 'Mobile Money' },
  'Cash': { en: 'Cash', fr: 'Espèces', rw: 'Amafaranga mu ntoki' },
  'Approve the MoMo prompt on your phone…': { en: 'Approve the MoMo prompt on your phone…', fr: 'Validez la demande MoMo sur votre téléphone…', rw: 'Emeza ubusabe bwa MoMo kuri telefoni yawe…' },
  'Requesting…': { en: 'Requesting…', fr: 'Demande en cours…', rw: 'Gusaba birakomeje…' },
  'Request Delivery': { en: 'Request Delivery', fr: 'Demander une livraison', rw: 'Saba ko koherezwa' },
  'Finding the best route…': { en: 'Finding the best route…', fr: 'Recherche du meilleur itinéraire…', rw: 'Turimo gushaka inzira nziza…' },
  'Calculating your fare…': { en: 'Calculating your fare…', fr: 'Calcul du tarif…', rw: 'Turimo kubara igiciro…' },
  'Confirming with Zana…': { en: 'Confirming with Zana…', fr: 'Confirmation avec Zana…', rw: 'Turimo kwemeza na Zana…' },
});


Object.assign(UI, {
  'Minimum 100 points': { en: 'Minimum 100 points', fr: 'Minimum 100 points', rw: 'Nibura amanota 100' },
  'points redeemed for': { en: 'points redeemed for', fr: 'points échangés contre', rw: 'amanota yakoreshejwe kuri' },
  'Could not redeem points': { en: 'Could not redeem points', fr: 'Impossible d’échanger les points', rw: 'Ntibyashobotse gukoresha amanota' },
  'Your points balance': { en: 'Your points balance', fr: 'Votre solde de points', rw: 'Amanota ufite' },
  'How to earn points': { en: 'How to earn points', fr: 'Comment gagner des points', rw: 'Uko wabona amanota' },
  'Redeem points': { en: 'Redeem points', fr: 'Échanger des points', rw: 'Koresha amanota' },
  'Points to redeem': { en: 'Points to redeem', fr: 'Points à échanger', rw: 'Amanota yo gukoresha' },
  'Recent activity': { en: 'Recent activity', fr: 'Activité récente', rw: 'Ibikorwa bya vuba' },
  'Help & Support': { en: 'Help & Support', fr: 'Aide et assistance', rw: 'Ubufasha n’ubwunganizi' },
  'Still need help?': { en: 'Still need help?', fr: 'Besoin d’aide ?', rw: 'Uracyakeneye ubufasha?' },
  'WhatsApp Support': { en: 'WhatsApp Support', fr: 'Assistance WhatsApp', rw: 'Ubufasha kuri WhatsApp' },
  'Location is not available on this device.': { en: 'Location is not available on this device.', fr: 'La localisation n’est pas disponible sur cet appareil.', rw: 'Aho uri ntihaboneka kuri iki gikoresho.' },
  'Could not read your location. Allow location access and try again.': { en: 'Could not read your location. Allow location access and try again.', fr: 'Impossible de lire votre position. Autorisez l’accès à la localisation et réessayez.', rw: 'Ntibyashobotse kumenya aho uri. Emera ko igikoresho kibona aho uri wongere ugerageze.' },
  'Saved Places': { en: 'Saved Places', fr: 'Lieux enregistrés', rw: 'Ahantu wabikiye' },
  'No saved places yet.': { en: 'No saved places yet.', fr: 'Aucun lieu enregistré pour le moment.', rw: 'Nta hantu wabika kugeza ubu.' },
  'New saved place': { en: 'New saved place', fr: 'Nouveau lieu enregistré', rw: 'Bika ahantu hashya' },
  'or': { en: 'or', fr: 'ou', rw: 'cyangwa' },
  'Search address': { en: 'Search address', fr: 'Rechercher une adresse', rw: 'Shaka aderesi' },
  'Type an address...': { en: 'Type an address...', fr: 'Saisissez une adresse...', rw: 'Andika aderesi...' },
  'Cancel': { en: 'Cancel', fr: 'Annuler', rw: 'Hagarika' },
  'Safety': { en: 'Safety', fr: 'Sécurité', rw: 'Umutekano' },
  'Emergency Contact': { en: 'Emergency Contact', fr: 'Contact d’urgence', rw: 'Uwo wahamagara mu gihe cy’amage' },
  'Share your trip details with trusted contacts for added safety.': { en: 'Share your trip details with trusted contacts for added safety.', fr: 'Partagez les détails de votre trajet avec des contacts de confiance pour plus de sécurité.', rw: 'Sangiza abo wizera amakuru y’urugendo rwawe kugira ngo urusheho kugira umutekano.' },
  'SOS Feature': { en: 'SOS Feature', fr: 'Fonction SOS', rw: 'Serivisi ya SOS' },
  'During any active ride, shake your phone or tap the SOS button to report a safety concern. Our team will be alerted immediately.': { en: 'During any active ride, shake your phone or tap the SOS button to report a safety concern. Our team will be alerted immediately.', fr: 'Pendant tout trajet actif, secouez votre téléphone ou appuyez sur le bouton SOS pour signaler un problème de sécurité. Notre équipe sera alertée immédiatement.', rw: 'Mu rugendo urimo, nyeganyeza telefoni cyangwa ukande kuri SOS kugira ngo utange amakuru ku kibazo cy’umutekano. Itsinda ryacu rizahita ribimenyeshwa.' },
});

// Deployment heartbeat: keep the production Pages build tracking the latest main commit.
// Production sync marker: latest main source should be picked up by the next Pages build.
// Pages deployment sync: customer-web production build trigger.
