import type { Metadata, Viewport } from "next";
import { ThemeProvider } from '../lib/ThemeContext';
import SplashGate from '../components/SplashGate';
import "./globals.css";
import { LangProvider } from "../lib/LangContext";
import BottomNav from "../components/BottomNav";
import AuthGuard from "../components/AuthGuard";
import LanguageSelector from "../components/LanguageSelector";

export const metadata: Metadata = {
  title: "Zana",
  description: "Rides, deliveries, and more in Kigali",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden bg-gray-50">
        <LangProvider>
          <LanguageSelector variant="floating" />
          <AuthGuard>
            <div className="min-h-screen pb-16 w-full max-w-[480px] mx-auto relative overflow-x-hidden">
              <SplashGate><ThemeProvider>{children}</ThemeProvider></SplashGate>
            </div>
            <BottomNav />
          </AuthGuard>
        </LangProvider>
      </body>
    </html>
  );
}
