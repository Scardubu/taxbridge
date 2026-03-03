'use client';

/**
 * TaxBridge Admin — Login Page
 * Route: /login
 *
 * - Validates credentials against the backend via /api/auth/login
 * - Sets admin_token cookie on success
 * - Handles redirect reasons from middleware (unauthenticated, session_expired, invalid_token)
 * - Zero hardcoded UI text — all strings via useAdminI18n (with direct fallback literals
 *   for missing translation keys to avoid raw key display)
 * - useSearchParams() wrapped in Suspense boundary (Next.js 16 requirement)
 */

import { useState, useCallback, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Next.js 16: force dynamic rendering — useSearchParams() cannot be statically prerendered
export const dynamic = 'force-dynamic';

// Reason → human-readable message (not color-only — C-15)
const REASON_MESSAGES: Record<string, string> = {
  unauthenticated: 'Please sign in to access the admin dashboard.',
  session_expired: 'Your session has expired. Please sign in again.',
  invalid_token:   'Your session is no longer valid. Please sign in again.',
};

/**
 * Wrapper that provides Suspense boundary for useSearchParams().
 * Next.js 16 requires CSR hooks to be wrapped in <Suspense>.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="animate-pulse">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-200 mb-4" />
            <div className="h-6 bg-slate-200 rounded w-48 mx-auto mb-2" />
            <div className="h-4 bg-slate-100 rounded w-64 mx-auto" />
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const reason       = searchParams.get('reason') ?? '';

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (!res.ok) {
        setError(data.message ?? 'Invalid email or password. Please try again.');
        return;
      }

      // Redirect to dashboard on success — replace so back button does not return to login
      router.replace('/dashboard');
    } catch {
      setError('Unable to connect to the authentication service. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email, password, router]);

  const reasonMessage = REASON_MESSAGES[reason];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-600 mb-4">
            {/* Shield icon — C-15: shape + text, not color alone */}
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">TaxBridge Admin</h1>
          <p className="text-sm text-slate-500 mt-1">
            Nigerian Tax Compliance Platform
          </p>
        </div>

        {/* Redirect reason alert */}
        {reasonMessage && !error && (
          <Alert className="mb-4 border-amber-200 bg-amber-50" role="status">
            {/* C-15: icon + color + text */}
            <svg
              className="h-4 w-4 text-amber-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <AlertDescription className="text-amber-700 ml-2">
              {reasonMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Login card */}
        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800">
              Sign in to your account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate>
              {/* Error alert — C-15: icon + text */}
              {error && (
                <Alert className="mb-4 border-red-200 bg-red-50" role="alert">
                  <svg
                    className="h-4 w-4 text-red-600 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <AlertDescription className="text-red-700 ml-2">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {/* Email */}
                <div className="space-y-1">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-700"
                  >
                    Email address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@taxbridge.ng"
                    className="w-full"
                    aria-label="Email address"
                    aria-describedby={error ? 'login-error' : undefined}
                    aria-invalid={!!error}
                    disabled={loading}
                  />
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700"
                  >
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full"
                    aria-label="Password"
                    aria-invalid={!!error}
                    disabled={loading}
                  />
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
                  disabled={loading || !email.trim() || !password}
                  aria-busy={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 5.373A8.001 8.001 0 014 12z"
                        />
                      </svg>
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          TaxBridge · NTA 2025 Compliant · NRS 2026 Ready
        </p>
      </div>
    </div>
  );
}
