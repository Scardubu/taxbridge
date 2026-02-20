import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Providers from "./providers";

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
    icon: [{ url: "/favicon.ico", sizes: "any" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TaxBridge Admin',
  },
  metadataBase: new URL("https://taxbridge.vercel.app"),
};

export const viewport: Viewport = {
  themeColor: '#10B981',
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
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
