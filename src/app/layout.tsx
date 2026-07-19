import type { Metadata, Viewport } from "next";
import { Figtree, Syne } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { SiteCredit } from "@/components/SiteCredit";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Docupros — Document Scanner",
  description:
    "Scan documents with your camera, crop edges, enhance pages, extract text, and export PDFs. This tool developed by Hafiz Abbas.",
  applicationName: "Docupros",
  authors: [{ name: "Hafiz Abbas" }],
  creator: "Hafiz Abbas",
  appleWebApp: {
    capable: true,
    title: "Docupros",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${figtree.variable} h-full`}>
      <body className="app-shell antialiased">
        {children}
        <SiteCredit />
        <BottomNav />
      </body>
    </html>
  );
}
