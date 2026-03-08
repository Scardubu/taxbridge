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
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
  const navigation = useNavigation<any>();

  const routeMap: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/documents': 'Documents',
    '/team': 'TeamManagement',
    '/settings': 'Settings',
    '/payroll': 'Payroll',
    '/compliance': 'Compliance',
    '/expenses': 'Expenses',
    '/invoices': 'Invoices',
  };

  useEffect(() => {
    // Handle the URL that opened the app from a cold start
    Linking.getInitialURL().then((url: string | null) => {
      if (url) handleLink(url);
    }).catch((err: Error) => {
      addBreadcrumb({ category: 'deep-link', message: `getInitialURL error: ${String(err)}`, level: 'error' });
    });

    // Handle URLs received while the app is already running
    const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => handleLink(url));

    return () => subscription.remove();
  }, [navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLink(rawUrl: string) {
    try {
      const path = extractPath(rawUrl);

      if (!isAllowed(path)) {
        addBreadcrumb({ category: 'deep-link', message: `Blocked unsafe deep link: ${rawUrl}`, level: 'warning' });
        return; // Silent drop — never navigate to unknown paths
      }

      addBreadcrumb({ category: 'deep-link', message: `Following safe deep link: ${path}`, level: 'info' });
      const target = routeMap[path] ?? routeMap[Object.keys(routeMap).find((safe) => path.startsWith(`${safe}/`)) ?? ''];
      if (target) {
        navigation.navigate(target);
      }
    } catch (err: unknown) {
      addBreadcrumb({ category: 'deep-link', message: `Deep link handling error: ${String(err)}`, level: 'error' });
      // Never crash — swallow silently
    }
  }
}
