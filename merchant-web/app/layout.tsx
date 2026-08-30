import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
  title: "Zana Business",
  description: "Zana Business merchant portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="h-full">
        <AuthGuard>
          <div className="flex h-full min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50">
              {children}
            </main>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
