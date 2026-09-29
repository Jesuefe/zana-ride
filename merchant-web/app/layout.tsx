import type { Metadata, Viewport } from "next";
import { ThemeProvider } from '../lib/ThemeContext';
import { LangProvider } from '../lib/LangContext';
import OrderAlarm from '../components/OrderAlarm';
import MerchantBottomNav from "../components/MerchantBottomNav";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";
import SplashGate from "../components/SplashGate";

export const metadata: Metadata = {
  title: "Zana Business",
  description: "Zana Business merchant portal",
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
          <AuthGuard>
            <div className="min-h-screen pb-16 w-full max-w-[480px] mx-auto relative overflow-x-hidden">
              <SplashGate><ThemeProvider>{children}</ThemeProvider></SplashGate>
            </div>
            <MerchantBottomNav />
            <OrderAlarm />
          </AuthGuard>
        </LangProvider>
      </body>
    </html>
  );
}
