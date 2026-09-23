// Google Translate is used as a background translation engine for pages that
// are not yet covered by ZANA's hand-written dictionaries. The user's language
// preference is persisted so returning users do not have to trigger translation.

declare global {
  interface Window {
    google?: { translate?: { TranslateElement: any } };
    googleTranslateElementInit?: () => void;
  }
}

type LangCode = 'en' | 'fr' | 'rw';

let scriptLoaded = false;

function setGoogleTranslateCookie(langCode: LangCode) {
  if (typeof document === 'undefined') return;

  if (langCode === 'en') {
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname + ';';
    return;
  }

  // Persist both host-only and domain cookies because Google Translate can
  // read either depending on how the page was loaded.
  document.cookie = `googtrans=/en/${langCode}; path=/;`;
  document.cookie = `googtrans=/en/${langCode}; path=/; domain=${window.location.hostname};`;
}

export function prepareGoogleTranslateLanguage(langCode: LangCode) {
  if (typeof document === 'undefined') return;
  setGoogleTranslateCookie(langCode);
}

function applyGoogleTranslateLanguage(langCode: LangCode, attempts = 0) {
  if (typeof document === 'undefined') return;
  if (langCode === 'en') return;

  const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
  if (select) {
    if (select.value !== langCode) select.value = langCode;
    select.dispatchEvent(new Event('change'));
    return;
  }

  // The Google script injects the select asynchronously. Retry briefly so
  // cached-language users are translated automatically without clicking.
  if (attempts < 30) {
    window.setTimeout(() => applyGoogleTranslateLanguage(langCode, attempts + 1), 100);
  }
}

export function loadGoogleTranslate(langCode: LangCode = 'en') {
  if (typeof window === 'undefined') return;

  // Set the cached language before Google initializes. This is what lets the
  // widget pick up the user's language on page load instead of waiting for a
  // language-button click.
  prepareGoogleTranslateLanguage(langCode);

  if (scriptLoaded || document.getElementById('google_translate_element')) {
    applyGoogleTranslateLanguage(langCode);
    return;
  }

  scriptLoaded = true;

  const div = document.createElement('div');
  div.id = 'google_translate_element';
  div.style.display = 'none';
  document.body.appendChild(div);

  window.googleTranslateElementInit = () => {
    if (!window.google?.translate) return;
    new window.google.translate.TranslateElement(
      { pageLanguage: 'en', includedLanguages: 'rw,fr', autoDisplay: false },
      'google_translate_element',
    );
    applyGoogleTranslateLanguage(langCode);
  };

  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.head.appendChild(script);
}

export function setGoogleTranslateLanguage(langCode: LangCode) {
  if (typeof document === 'undefined') return;

  prepareGoogleTranslateLanguage(langCode);

  if (langCode === 'en') {
    window.location.reload();
    return;
  }

  const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
  if (select) {
    select.value = langCode;
    select.dispatchEvent(new Event('change'));
  } else {
    // The preference is already cached. Initialize the engine; it will apply
    // the language automatically when the Google widget becomes ready.
    loadGoogleTranslate(langCode);
  }
}
