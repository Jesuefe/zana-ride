import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
  title: "Zana Admin",
  description: "Zana Ride operations dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex bg-background text-foreground font-sans">
        <Sidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </body>
    </html>
  );
}
