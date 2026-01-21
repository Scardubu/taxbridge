import type { Metadata } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: {
    default: "TaxBridge Admin Dashboard",
    template: "%s | TaxBridge Admin",
  },
  description: "Comprehensive admin dashboard for TaxBridge operations and compliance monitoring — Nigeria's first offline-first, NRS-compliant e-invoicing platform for SMEs.",
  keywords: [
    "TaxBridge",
    "Nigeria tax",
    "NRS compliance",
    "e-invoicing",
    "admin dashboard",
    "SME tax management",
    "DigiTax",
    "Remita",
    "offline-first",
  ],
  authors: [{ name: "TaxBridge Team" }],
  creator: "TaxBridge",
  publisher: "TaxBridge",
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://taxbridge.vercel.app",
    title: "TaxBridge Admin Dashboard",
    description: "Monitor and manage TaxBridge operations — Nigeria's offline-first tax compliance platform.",
    siteName: "TaxBridge Admin",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TaxBridge Admin Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TaxBridge Admin Dashboard",
    description: "Monitor and manage TaxBridge operations — Nigeria's offline-first tax compliance platform.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://taxbridge.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
