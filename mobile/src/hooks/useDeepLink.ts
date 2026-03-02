/**
 * useDeepLink — TaxBridge V12
 *
 * Intercepts incoming deep links (expo-linking) and routes them to
 * the correct screen via expo-router.
 *
 * C-36 / GAP-07: SAFE_ROUTES allowlist prevents malicious external URLs
 * from being followed. Unknown routes are dropped silently
 * (never crash, never navigate to an unrecognised path).
 *
 * C-07: All failures are logged; none bubble up as unhandled exceptions.
 */

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { addBreadcrumb } from '../services/sentry';

// ─── Allowlist (C-36) ─────────────────────────────────────────────────────────
// Only routes in this set will be followed. All others are silently dropped.
// Extend this list when adding new navigable screens.

const SAFE_ROUTES = new Set<string>([
  '/dashboard',
  '/filings/vat',
  '/filings/wht',
  '/filings/paye',
  '/filings/nil',
  '/filings/cit',
  '/documents',
  '/team',
  '/profile',
  '/profile/security',
  '/invoices',
  '/invoices/new',
  '/expenses',
  '/receipts',
  '/payroll',
  '/compliance',
  '/settings',
]);

// ─── Path normalisation ───────────────────────────────────────────────────────

/**
 * Strips query-string and fragment from a path and normalises slashes.
 * Returns the bare path segment for allowlist comparison.
 *
 * Example:
 *   "/filings/vat?period=2026-Q1" → "/filings/vat"
 */
function extractPath(rawPath: string): string {
  try {
    // expo-linking gives us a full URL; parse it to get the pathname
    const url = new URL(rawPath.startsWith('http') ? rawPath : `taxbridge://app${rawPath}`);
    return url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  } catch {
    return '/';
  }
}

/**
 * Returns true iff the given path is explicitly allowed.
 *
 * Supports exact matches AND prefix matches for paths with dynamic segments
 * (e.g. "/invoices/inv_123" is accepted because "/invoices" is in SAFE_ROUTES).
 */
function isAllowed(path: string): boolean {
  if (SAFE_ROUTES.has(path)) return true;
  for (const safe of SAFE_ROUTES) {
    if (path.startsWith(`${safe}/`)) return true;
  }
  return false;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeepLink() {
  const router = useRouter();

  useEffect(() => {
    // Handle the URL that opened the app from a cold start
    Linking.getInitialURL().then((url) => {
      if (url) handleLink(url);
    }).catch((err) => {
      addBreadcrumb('deep-link', `getInitialURL error: ${String(err)}`, 'error');
    });

    // Handle URLs received while the app is already running
    const subscription = Linking.addEventListener('url', ({ url }) => handleLink(url));

    return () => subscription.remove();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLink(rawUrl: string) {
    try {
      const path = extractPath(rawUrl);

      if (!isAllowed(path)) {
        addBreadcrumb('deep-link', `Blocked unsafe deep link: ${rawUrl}`, 'warning');
        return; // Silent drop — never navigate to unknown paths
      }

      addBreadcrumb('deep-link', `Following safe deep link: ${path}`, 'info');
      router.push(path as never);
    } catch (err) {
      addBreadcrumb('deep-link', `Deep link handling error: ${String(err)}`, 'error');
      // Never crash — swallow silently
    }
  }
}
