import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaxBridge Admin',
  description: 'TaxBridge V13 Admin Panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#F9FAFB' }}>
        {children}
      </body>
    </html>
  );
}
