import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "../lib/LangContext";
import BottomNav from "../components/BottomNav";
import AuthGuard from "../components/AuthGuard";

export const metadata: Metadata = {
  title: "Zana",
  description: "Rides, deliveries, and more in Kigali",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LangProvider>
          <AuthGuard>
            <div className="min-h-screen pb-16 max-w-[480px] mx-auto md:max-w-[640px] lg:max-w-[760px] relative">
              {children}
            </div>
            <BottomNav />
          </AuthGuard>
        </LangProvider>
      </body>
    </html>
  );
}
