'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NotFound() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/SSG, render a simple fallback
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <p className="mt-2 text-xl text-gray-600">Page not found</p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-block rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // After mounting, use client-side i18n if available
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-gray-900">404</h1>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">
            Page Not Found
          </h2>
          <p className="text-gray-600">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go Home
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>System Status: Operational</p>
          <p className="mt-1">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
