import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "../lib/LangContext";

export const metadata: Metadata = {
  title: "Zana",
  description: "Rides, deliveries, and more in Kigali",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LangProvider>
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
