import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zana — Move around Kigali',
  description:
    'Rides, deliveries and shopping across Kigali. One app for getting there, sending things and running your business.',
  openGraph: {
    title: 'Zana — Move around Kigali',
    description: 'Rides, deliveries and shopping across Kigali.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* One family, two widths: Expanded carries the display words, the
            normal width carries everything else. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
