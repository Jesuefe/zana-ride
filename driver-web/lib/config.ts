// Restricted to the zana-driver.pages.dev domain (see Maps key setup).
export const GOOGLE_MAPS_EMBED_KEY = 'AIzaSyD4o-fXIpmGozrClaP1niC407cgRCrzSTI';

// NOT CURRENTLY USED — kept as a placeholder for when iOS navigation gets
// its own native plugin (the current one, GoogleNavigationPlugin.java, is
// Android-only; Android reads its key from AndroidManifest.xml instead, not
// from here). Wire this in only once a real iOS implementation exists —
// an unused key sitting in source control is a live credential and a bug
// waiting to happen with no code path to explain why it's there.
// export const GOOGLE_NAV_API_KEY_IOS = 'REPLACE_WITH_A_REAL_RESTRICTED_KEY';
