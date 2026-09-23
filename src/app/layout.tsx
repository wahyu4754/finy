import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import AppShell from "../components/layout/AppShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Finy - Catatan Keuangan Pintar",
  description: "Finy membantu mencatat, menganalisis, dan memantau keuanganmu secara pintar dan otomatis.",
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finy",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#C5F23C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const snapUrl =
    process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL ||
    "https://app.sandbox.midtrans.com/snap/snap.js";
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

  return (
    <html lang="id" className={`${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script
          id="midtrans-snap"
          src={snapUrl}
          data-client-key={clientKey}
          strategy="afterInteractive"
        />
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

