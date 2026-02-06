'use client';

import React, { useEffect, useState } from 'react';
import { logError } from '@/lib/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; reset: () => void }>;
}

interface ErrorBoundaryInnerProps extends ErrorBoundaryProps {
  messages: {
    title: string;
    description: string;
    retry: string;
  };
}

class ErrorBoundaryInner extends React.Component<ErrorBoundaryInnerProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryInnerProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError(
      'admin/ErrorBoundary: caught an error',
      error,
      { componentStack: errorInfo.componentStack },
      { suppressInProd: true }
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error}
            reset={() => this.setState({ hasError: false, error: undefined })}
          />
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center p-8">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4l-9 9-9 4v6m3 0h18" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{this.props.messages.title}</h2>
            <p className="text-slate-600 mb-4">{this.props.messages.description}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors"
            >
              {this.props.messages.retry}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Default english messages (used during SSR and as fallback)
const DEFAULT_MESSAGES = {
  title: 'Something went wrong',
  description: 'An unexpected error occurred. Please try refreshing the page.',
  retry: 'Try again',
};

export function ErrorBoundary(props: ErrorBoundaryProps) {
  // Always use default messages to avoid SSR/hydration issues
  // The i18n translations can be added in Phase 2 if needed
  return (
    <ErrorBoundaryInner
      {...props}
      messages={DEFAULT_MESSAGES}
    />
  );
}
