// Browser key is injected at build time from the NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
// GitHub Actions secret. Never commit Google API keys to the repository.
export const GOOGLE_MAPS_EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
