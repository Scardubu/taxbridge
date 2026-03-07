import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use default output for Vercel compatibility
  // Ensure proper handling of environment variables
  env: {
    BACKEND_URL: process.env.BACKEND_URL || process.env.BACKEND_API_URL || 'https://taxbridge-api-ker8.onrender.com',
    BACKEND_API_URL: process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'https://taxbridge-api-ker8.onrender.com',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://taxbridge-api-ker8.onrender.com',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://taxbridge-api-ker8.onrender.com',
  },
  
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'taxbridge-api-ker8.onrender.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.vercel.app',
        pathname: '/**',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Performance optimizations (swcMinify enabled by default in Next.js 16+)
  reactStrictMode: true,
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  async headers() {
    const isProd = process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV?.includes('preview');

    // vercel.live feedback toolbar is injected in preview/development deployments
    const vercelLiveSrc = isProd ? '' : ' https://vercel.live https://*.vercel.live';

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'${vercelLiveSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      `connect-src 'self' https://taxbridge-api-ker8.onrender.com https://*.onrender.com https://*.vercel.app${vercelLiveSrc}`,
      "frame-ancestors 'none'",
      `frame-src 'none'${isProd ? '' : ' https://vercel.live'}`,
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
};

export default nextConfig;
