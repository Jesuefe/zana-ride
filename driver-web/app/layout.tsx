import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";

export const metadata: Metadata = {
  title: "Zana Driver",
  description: "Drive with Zana",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-gray-100 font-sans">
        <div className="app-shell">
          <AuthGuard>{children}</AuthGuard>
        </div>
      </body>
    </html>
  );
}
