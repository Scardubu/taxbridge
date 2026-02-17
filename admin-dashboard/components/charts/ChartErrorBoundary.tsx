'use client';

import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAdminI18n } from '@/lib/i18n';

interface InnerProps {
  children: ReactNode;
  fallback?: ReactNode;
  t: (key: string, vars?: Record<string, string | number | undefined>) => string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ChartErrorBoundaryInner extends Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Chart rendering error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { t } = this.props;

      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/60 p-6">
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle className="text-base font-semibold">{t('chart.error.title')}</AlertTitle>
            <AlertDescription className="text-sm">
              {t('chart.error.message')} {this.state.error?.message || t('chart.error.help')}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ChartErrorBoundary({ children, fallback }: Props) {
  const { t } = useAdminI18n();
  return (
    <ChartErrorBoundaryInner fallback={fallback} t={t}>
      {children}
    </ChartErrorBoundaryInner>
  );
}
