import type { Metadata, Viewport } from "next";
import SosListener from '../components/SosListener';
import { ThemeProvider } from '../lib/ThemeContext';
import "./globals.css";

export const metadata: Metadata = { title: "Zana Admin" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden"><ThemeProvider>{children}<SosListener /></ThemeProvider></body>
    </html>
  );
}
