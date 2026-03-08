import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaxBridge Admin',
  description: 'TaxBridge V13 Admin Panel',
};

const themeBootScript = `(() => {
  try {
    const saved = localStorage.getItem('taxbridge-admin-theme');
    const resolved = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', resolved);
  } catch {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
