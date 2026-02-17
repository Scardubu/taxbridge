'use client';

import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useAdminI18n } from '@/lib/i18n';

export default function UsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useAdminI18n();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Users page error:', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <Alert variant="destructive" className="max-w-lg">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-base font-semibold">{t('route.error.title')}</AlertTitle>
        <AlertDescription className="mt-2 text-sm">
          {t('route.error.message')}
        </AlertDescription>
        <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
          {t('route.error.retry')}
        </Button>
      </Alert>
    </div>
  );
}
