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
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden bg-gray-50">
        <LangProvider>
          <AuthGuard>
            <div className="app-shell min-h-screen pb-[calc(4rem+env(safe-area-inset-bottom))] relative">
              <SplashGate><ThemeProvider>{children}</ThemeProvider></SplashGate>
            </div>
            <BottomNav />
<RealtimeNotificationAlert />
          </AuthGuard>
        </LangProvider>
      </body>
    </html>
  );
}
