import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "../lib/LangContext";

export const metadata: Metadata = {
  title: "Zana Driver",
  description: "Zana Driver App",
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
