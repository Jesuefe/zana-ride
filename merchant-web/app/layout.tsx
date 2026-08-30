import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";

export const metadata: Metadata = {
  title: "Zana Business",
  description: "Zana Business merchant portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="h-full overflow-x-hidden">
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
