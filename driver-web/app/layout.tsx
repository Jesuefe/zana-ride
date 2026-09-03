import type { Metadata, Viewport } from "next";
import SplashGate from '../components/SplashGate';
import "./globals.css";
import { LangProvider } from "../lib/LangContext";
import DriverBottomNav from "../components/DriverBottomNav";

export const metadata: Metadata = {
  title: "Zana Driver",
  description: "Zana Driver App",
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
      <body className="overflow-x-hidden">
        <LangProvider>
          <div className="min-h-screen w-full max-w-[480px] mx-auto overflow-x-hidden pb-16">
            <SplashGate>{children}</SplashGate>
          </div>
          <DriverBottomNav />
        </LangProvider>
      </body>
    </html>
  );
}
