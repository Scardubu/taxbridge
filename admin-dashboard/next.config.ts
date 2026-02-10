import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use default output for Vercel compatibility
  // Ensure proper handling of environment variables
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://taxbridge-api-ker8.onrender.com',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://taxbridge-api-ker8.onrender.com',
  },
  
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Performance optimizations (swcMinify enabled by default in Next.js 16+)
  reactStrictMode: true,
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
};

export default nextConfig;
