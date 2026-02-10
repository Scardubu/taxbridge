'use client';

import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/60 p-6">
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle className="text-base font-semibold">Chart Error</AlertTitle>
            <AlertDescription className="text-sm">
              Unable to display chart data. {this.state.error?.message || 'Please try refreshing the page.'}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
