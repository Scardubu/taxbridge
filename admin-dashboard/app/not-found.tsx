'use client';

import Link from 'next/link';
import { useAdminI18n } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useAdminI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-gray-900">404</h1>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">
            {t('notFound.title')}
          </h2>
          <p className="text-gray-600">
            {t('notFound.subtitle')}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {t('notFound.goToDashboard')}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {t('notFound.goHome')}
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>{t('notFound.systemStatus')}</p>
          <p className="mt-1">
            {t('notFound.errorHelp')}
          </p>
        </div>
      </div>
    </div>
  );
}
