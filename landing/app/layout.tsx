import type { Metadata } from 'next';
import './globals.css';
import '../components/immersive-hero.css';

const SITE_URL = 'https://zanaride.rw';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Zana Ride | Rides, Deliveries & Shopping in Kigali',
    template: '%s | Zana Ride',
  },
  description:
    'Book moto and car rides, send deliveries, order food and shop across Kigali, Rwanda with Zana Ride.',
  applicationName: 'Zana Ride',
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: 'Zana Ride | Rides, Deliveries & Shopping in Kigali',
    description: 'Rides, deliveries and shopping across Kigali, Rwanda.',
    url: SITE_URL,
    siteName: 'Zana Ride',
    locale: 'en_RW',
    type: 'website',
    images: [{ url: '/zana-mark.png', alt: 'Zana Ride' }],
  },
  twitter: {
    card: 'summary',
    title: 'Zana Ride | Rides, Deliveries & Shopping in Kigali',
    description: 'Rides, deliveries and shopping across Kigali, Rwanda.',
    images: ['/zana-mark.png'],
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Zana Ride',
  url: SITE_URL,
  logo: `${SITE_URL}/zana-mark.png`,
  email: 'hello@zanaride.rw',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Kigali',
    addressCountry: 'RW',
  },
  description:
    'A Kigali-based platform for rides, deliveries, food orders and market shopping.',
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Zana Ride',
  url: SITE_URL,
  inLanguage: 'en',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
