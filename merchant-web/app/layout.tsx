import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";

export const metadata: Metadata = {
  title: "Zana Business",
  description: "Zana Business merchant portal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground font-sans">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
