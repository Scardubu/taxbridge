import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TaxBridge Admin',
    short_name: 'TaxBridge',
    description: 'TaxBridge Admin Dashboard – Nigerian Tax Platform Management',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#10B981',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '64x64 32x32 24x24 16x16',
        type: 'image/x-icon',
      },
    ],
    categories: ['business', 'finance', 'productivity'],
    lang: 'en-NG',
    dir: 'ltr',
  };
}
