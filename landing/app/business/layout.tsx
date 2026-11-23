import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zana Business | Delivery API & Partner Portal',
  description: 'Connect your restaurant, food delivery or ecommerce platform to Zana’s rider network with a secure delivery API and prepaid business dashboard.',
  alternates: { canonical: '/business' },
  openGraph: {
    title: 'Zana Business | Your orders. Our delivery network.',
    description: 'Keep your own app and connect to Zana for delivery dispatch, tracking and prepaid billing.',
    url: 'https://zanaride.rw/business',
    siteName: 'Zana Ride',
    type: 'website',
  },
};

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
