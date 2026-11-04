import type { Metadata, Viewport } from "next";
import { ThemeProvider } from '../lib/ThemeContext';
import SplashGate from '../components/SplashGate';
import "./globals.css";
import { LangProvider } from "../lib/LangContext";
import BottomNav from "../components/BottomNav";
import RealtimeNotificationAlert from "../components/RealtimeNotificationAlert";
import AuthGuard from "../components/AuthGuard";

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
          <ThemeProvider>
            <AuthGuard>
              <div className="app-shell w-full pb-[calc(7.5rem+env(safe-area-inset-bottom))] relative overflow-x-hidden">
                <SplashGate>{children}</SplashGate>
              </div>
              <BottomNav />
              <RealtimeNotificationAlert />
            </AuthGuard>
          </ThemeProvider>
        </LangProvider>
      </body>
    </html>
  );
}
