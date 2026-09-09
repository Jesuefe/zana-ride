import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LangProvider } from "../lib/LangContext";
import DriverShell from "../components/DriverShell";

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
          <DriverShell>{children}</DriverShell>
        </LangProvider>
      </body>
    </html>
  );
}
