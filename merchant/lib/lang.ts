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

// UI strings for the merchant app in all three languages.
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
  "Confirm order": { en: "Confirm order", fr: "Confirmer la commande", rw: "Emeza itegeko" },
  "Start preparing": { en: "Start preparing", fr: "Commencer la préparation", rw: "Tangira gutegura" },
  "Ready for pickup": { en: "Ready for pickup", fr: "Prêt pour le retrait", rw: "Biteguye gufatwa" },
  "New order": { en: "New order", fr: "Nouvelle commande", rw: "Itegeko rishya" },
  "Confirmed": { en: "Confirmed", fr: "Confirmée", rw: "Byemejwe" },
  "Preparing": { en: "Preparing", fr: "En préparation", rw: "Birategurwa" },
  "Ready — driver en route": { en: "Ready — driver en route", fr: "Prêt — chauffeur en route", rw: "Biteguye — umushoferi ari mu nzira" },
  "Driver delivering": { en: "Driver delivering", fr: "Chauffeur en livraison", rw: "Umushoferi arageza" },
  "Delivered": { en: "Delivered", fr: "Livrée", rw: "Byagejejwe" },
  "Cancelled": { en: "Cancelled", fr: "Annulée", rw: "Byahagaritswe" },
  "Active": { en: "Active", fr: "Actives", rw: "Ibikora" },
  "Done": { en: "Done", fr: "Terminées", rw: "Byarangiye" },
  "All": { en: "All", fr: "Toutes", rw: "Byose" },
  "No orders here": { en: "No orders here", fr: "Aucune commande ici", rw: "Nta mategeko ari hano" },
  "Total": { en: "Total", fr: "Total", rw: "Byose hamwe" },
  "A Zana driver has been dispatched to collect this order.": { en: "A Zana driver has been dispatched to collect this order.", fr: "Un chauffeur Zana a été envoyé pour récupérer cette commande.", rw: "Umushoferi wa Zana yoherejwe gufata iri tegeko." },
  "Driver is delivering to your customer.": { en: "Driver is delivering to your customer.", fr: "Le chauffeur livre votre client.", rw: "Umushoferi arageza ku mukiriya wawe." },
  "Decline order": { en: "Decline order", fr: "Refuser la commande", rw: "Anga itegeko" },
  "Deliveries": { en: "Deliveries", fr: "Livraisons", rw: "Ibyagejejwe" },
  "Every package you've sent through Zana.": { en: "Every package you've sent through Zana.", fr: "Tous les colis que vous avez envoyés avec Zana.", rw: "Amapaki yose wohereje ukoresheje Zana." },
  "Loading…": { en: "Loading…", fr: "Chargement…", rw: "Birimo gutegurwa…" },
  "No deliveries yet.": { en: "No deliveries yet.", fr: "Aucune livraison pour le moment.", rw: "Nta byo kugeza birabaho." },
  "Finding a courier": { en: "Finding a courier", fr: "Recherche d’un coursier", rw: "Turimo gushaka umutwara" },
  "Courier assigned": { en: "Courier assigned", fr: "Coursier attribué", rw: "Umutwara yahawe akazi" },
  "On the way": { en: "On the way", fr: "En route", rw: "Ari mu nzira" },
  "Rider": { en: "Rider", fr: "Coursier", rw: "Umumotari" },
  "Food & Drinks": { en: "Food & Drinks", fr: "Nourriture et boissons", rw: "Ibiryo n’ibinyobwa" },
  "Gifts": { en: "Gifts", fr: "Cadeaux", rw: "Impano" },
  "General Goods": { en: "General Goods", fr: "Produits généraux", rw: "Ibicuruzwa rusange" },
  "My Products": { en: "My Products", fr: "Mes produits", rw: "Ibicuruzwa byanjye" },
  "New products go to admin for approval before they're visible.": { en: "New products go to admin for approval before they're visible.", fr: "Les nouveaux produits sont envoyés à l’administration pour approbation avant leur publication.", rw: "Ibicuruzwa bishya byoherezwa ku buyobozi kugira ngo byemezwe mbere yo kugaragara." },
  "Add Product": { en: "Add Product", fr: "Ajouter un produit", rw: "Ongeraho igicuruzwa" },
  "New Product": { en: "New Product", fr: "Nouveau produit", rw: "Igicuruzwa gishya" },
  "Product name": { en: "Product name", fr: "Nom du produit", rw: "Izina ry’igicuruzwa" },
  "Description (optional)": { en: "Description (optional)", fr: "Description (facultatif)", rw: "Ibisobanuro (si ngombwa)" },
  "Price (RWF)": { en: "Price (RWF)", fr: "Prix (RWF)", rw: "Igiciro (RWF)" },
  "Stock": { en: "Stock", fr: "Stock", rw: "Ububiko" },
  "Add product photo": { en: "Add product photo", fr: "Ajouter une photo du produit", rw: "Ongeraho ifoto y’igicuruzwa" },
  "Submitting…": { en: "Submitting…", fr: "Envoi…", rw: "Birimo koherezwa…" },
  "Submit for Review": { en: "Submit for Review", fr: "Soumettre pour examen", rw: "Ohereza ngo bisuzumwe" },
  "Cancel": { en: "Cancel", fr: "Annuler", rw: "Hagarika" },
  "Approved": { en: "Approved", fr: "Approuvé", rw: "Byemejwe" },
  "Rejected": { en: "Rejected", fr: "Rejeté", rw: "Byanzwe" },
  "Disabled": { en: "Disabled", fr: "Désactivé", rw: "Byahagaritswe" },
  "No products yet. Add your first one!": { en: "No products yet. Add your first one!", fr: "Aucun produit. Ajoutez votre premier !", rw: "Nta bicuruzwa birabaho. Ongeraho icya mbere!" },
  "Available balance": { en: "Available balance", fr: "Solde disponible", rw: "Amafaranga ahari" },
  "Withdraw to MoMo": { en: "Withdraw to MoMo", fr: "Retirer vers MoMo", rw: "Kura kuri MoMo" },
  "Transaction History": { en: "Transaction History", fr: "Historique des transactions", rw: "Amateka y’ibikorwa" },
  "No transactions yet.": { en: "No transactions yet.", fr: "Aucune transaction pour le moment.", rw: "Nta bikorwa birabaho." },
  "Withdraw Funds": { en: "Withdraw Funds", fr: "Retirer des fonds", rw: "Kura amafaranga" },
  "Amount (RWF)": { en: "Amount (RWF)", fr: "Montant (RWF)", rw: "Amafaranga (RWF)" },
  "MoMo phone number": { en: "MoMo phone number", fr: "Numéro MoMo", rw: "Nimero ya MoMo" },
  "Processing...": { en: "Processing...", fr: "Traitement…", rw: "Biratunganywa…" },
  "Withdraw": { en: "Withdraw", fr: "Retirer", rw: "Kura amafaranga" },
  "Minimum withdrawal is 10,000 RWF": { en: "Minimum withdrawal is 10,000 RWF", fr: "Le retrait minimum est de 10 000 RWF", rw: "Amafaranga make yo gukuramo ni 10,000 RWF" },
  "Insufficient balance": { en: "Insufficient balance", fr: "Solde insuffisant", rw: "Amafaranga ahari ntabwo ahagije" },
  "Enter your MoMo phone number": { en: "Enter your MoMo phone number", fr: "Entrez votre numéro MoMo", rw: "Andika nimero yawe ya MoMo" },
  "Withdrawal failed": { en: "Withdrawal failed", fr: "Le retrait a échoué", rw: "Gukuramo amafaranga byanze" },
  "Credit": { en: "Credit", fr: "Crédit", rw: "Amafaranga yinjiye" },
  "Withdrawal": { en: "Withdrawal", fr: "Retrait", rw: "Gukuramo amafaranga" },
};

export function t(key: string, lang: Lang): string {
  return UI[key]?.[lang] ?? key;
}
