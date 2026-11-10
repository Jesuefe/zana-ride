import type { MetadataRoute } from 'next';

// Keep this metadata route statically generated for Cloudflare Pages export.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://zanaride.rw/sitemap.xml',
    host: 'https://zanaride.rw',
  };
}
