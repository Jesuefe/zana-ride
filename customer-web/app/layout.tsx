import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";
import BottomNav from "../components/BottomNav";

export const metadata: Metadata = {
  title: "Zana Ride",
  description: "Book a ride across Kigali",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-gray-100 font-sans">
        <div className="app-shell pb-16">
          <AuthGuard>{children}</AuthGuard>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
