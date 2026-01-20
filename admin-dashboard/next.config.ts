import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use default output for Vercel compatibility
  // Ensure proper handling of environment variables
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://taxbridge-api.onrender.com',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://taxbridge-api.onrender.com',
  },
};

export default nextConfig;
