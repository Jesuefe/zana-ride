// Drives Google Translate's own translation engine from our existing
// language switcher, rather than its default UI banner/dropdown —
// covers every page automatically, including ones not yet manually
// wired into the dt()/t() dictionary system. Pages that ARE already
// manually wired keep showing their hand-written translation (higher
// quality) since Google only ever translates the English source text
// it finds in the DOM — it has nothing to do when the text is already
// in the target language.

declare global {
  interface Window {
    google?: { translate?: { TranslateElement: any } };
    googleTranslateElementInit?: () => void;
  }
}

let scriptLoaded = false;

export function loadGoogleTranslate() {
  if (scriptLoaded || typeof window === 'undefined') return;
  scriptLoaded = true;

  if (!document.getElementById('google_translate_element')) {
    const div = document.createElement('div');
    div.id = 'google_translate_element';
    div.style.display = 'none';
    document.body.appendChild(div);
  }

  window.googleTranslateElementInit = () => {
    if (!window.google?.translate) return;
    new window.google.translate.TranslateElement(
      { pageLanguage: 'en', includedLanguages: 'rw,fr', autoDisplay: false },
      'google_translate_element',
    );
  };

  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.body.appendChild(script);
}

// Google Translate's widget stores the active language as a cookie and
// drives everything off a hidden <select> it injects — setting the
// cookie alone doesn't retranslate an already-loaded page, so the
// select's own change event is what actually triggers it.
export function setGoogleTranslateLanguage(langCode: 'en' | 'fr' | 'rw') {
  if (typeof document === 'undefined') return;

  if (langCode === 'en') {
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.reload();
    return;
  }

  document.cookie = `googtrans=/en/${langCode}; path=/;`;
  document.cookie = `googtrans=/en/${langCode}; path=/; domain=${window.location.hostname};`;

  const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
  if (select) {
    select.value = langCode;
    select.dispatchEvent(new Event('change'));
  } else {
    // Widget hasn't finished initializing yet — the cookie is already
    // set, so a reload picks it up on the next load.
    window.location.reload();
  }
}
