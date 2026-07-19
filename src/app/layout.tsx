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
  title: "Docupros",
  description:
    "Scan documents with your camera, crop edges, enhance pages, extract text, and export PDFs. This tool developed by Hafiz Abbas.",
  applicationName: "Docupros",
  authors: [{ name: "Hafiz Abbas" }],
  creator: "Hafiz Abbas",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Docupros",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f766e" },
    { media: "(prefers-color-scheme: dark)", color: "#0f766e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${figtree.variable} h-full`}>
      <body className="app-shell antialiased android-app">
        <div className="status-bar-scrub" aria-hidden />
        {children}
        <SiteCredit />
        <BottomNav />
      </body>
    </html>
  );
}
