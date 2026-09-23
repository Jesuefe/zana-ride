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
  'Finding your driver…': { en: 'Finding your driver…', fr: 'Turimo gushaka umushoferi wawe…', rw: 'Turimo gushaka umushoferi wawe…' },
  'Driver assigned': { en: 'Driver assigned', fr: 'Umushoferi yahawe umurimo', rw: 'Umushoferi yahawe umurimo' },
  'Driver is on the way': { en: 'Driver is on the way', fr: 'Umushoferi ari mu nzira', rw: 'Umushoferi ari mu nzira' },
  'Your driver has arrived': { en: 'Your driver has arrived', fr: 'Umushoferi wawe yageze', rw: 'Umushoferi wawe yageze' },
  'On the way to your destination': { en: 'On the way to your destination', fr: 'Mu nzira igana aho ugiye', rw: 'Mu nzira igana aho ugiye' },
  'Trip completed': { en: 'Trip completed', fr: 'Urugendo rwarangiye', rw: 'Urugendo rwarangiye' },
  'No drivers available nearby': { en: 'No drivers available nearby', fr: 'Nta mushoferi uboneka hafi', rw: 'Nta mushoferi uboneka hafi' },
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
  'Driver': { en: 'Driver', fr: 'Umushoferi', rw: 'Umushoferi' },
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
};

export function t(key: string, lang: Lang): string {
  return UI[key]?.[lang] ?? key;
}
