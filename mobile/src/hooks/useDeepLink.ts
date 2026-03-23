/**
 * useDeepLink — TaxBridge V12
 *
 * Intercepts incoming deep links (expo-linking) and routes them to
 * the correct screen via the active React Navigation shell.
 *
 * C-36 / GAP-07: SAFE_ROUTES allowlist prevents malicious external URLs
 * from being followed. Unknown routes are dropped silently
 * (never crash, never navigate to an unrecognised path).
 *
 * C-07: All failures are logged; none bubble up as unhandled exceptions.
 */

import { useEffect, useRef, type RefObject } from 'react';
import { Linking } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { addBreadcrumb } from '../services/sentry';
import type { RootStackParamList } from '../navigation/types';

// ─── Allowlist (C-36) ─────────────────────────────────────────────────────────
// Only routes in this set will be followed. All others are silently dropped.
// Extend this list when adding new navigable screens.

const SAFE_ROUTES = new Set<string>([
  '/dashboard',
  '/documents',
  '/team',
  '/profile',
  '/profile/security',
  '/invoices',
  '/invoices/new',
  '/payroll',
  '/compliance',
  '/settings',
  '/payment',
  '/tax-guide',
  '/crypto',
  '/reconciliation',
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

type DeepLinkTarget =
  | { name: 'MainTabs'; params: { screen: 'Home' | 'Create' | 'Invoices' | 'Settings' } }
  | { name: 'Documents' }
  | { name: 'Payroll' }
  | { name: 'Compliance' }
  | { name: 'Payment' }
  | { name: 'TaxGuide' }
  | { name: 'Crypto' }
  | { name: 'Reconciliation' }
  | { name: 'Team' };

function resolveTarget(path: string): DeepLinkTarget | null {
  if (path === '/dashboard') return { name: 'MainTabs', params: { screen: 'Home' } };
  if (path === '/documents') return { name: 'Documents' };
  if (path === '/invoices') return { name: 'MainTabs', params: { screen: 'Invoices' } };
  if (path === '/invoices/new') return { name: 'MainTabs', params: { screen: 'Create' } };
  if (path === '/settings' || path === '/profile' || path === '/profile/security') {
    return { name: 'MainTabs', params: { screen: 'Settings' } };
  }
  if (path === '/payroll') return { name: 'Payroll' };
  if (path === '/compliance') return { name: 'Compliance' };
  if (path === '/payment') return { name: 'Payment' };
  if (path === '/tax-guide') return { name: 'TaxGuide' };
  if (path === '/crypto') return { name: 'Crypto' };
  if (path === '/reconciliation') return { name: 'Reconciliation' };
  if (path === '/team') return { name: 'Team' };
  return null;
}

export function useDeepLink(navigationRef: RefObject<NavigationContainerRef<RootStackParamList> | null>) {
  const pendingUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Handle the URL that opened the app from a cold start
    Linking.getInitialURL().then((url: string | null) => {
      if (url) handleLink(url);
    }).catch((err: Error) => {
      addBreadcrumb({ category: 'deep-link', message: `getInitialURL error: ${String(err)}`, level: 'error' });
    });

    // Handle URLs received while the app is already running
    const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => handleLink(url));

    const readyPoll = setInterval(() => {
      if (!pendingUrlRef.current) {
        return;
      }

      const navigation = navigationRef.current;
      if (!navigation?.isReady()) {
        return;
      }

      const queuedUrl = pendingUrlRef.current;
      pendingUrlRef.current = null;
      handleLink(queuedUrl);
    }, 250);

    return () => {
      subscription.remove();
      clearInterval(readyPoll);
    };
  }, [navigationRef]);

  function handleLink(rawUrl: string) {
    try {
      const path = extractPath(rawUrl);

      if (!isAllowed(path)) {
        addBreadcrumb({ category: 'deep-link', message: `Blocked unsafe deep link: ${rawUrl}`, level: 'warning' });
        return; // Silent drop — never navigate to unknown paths
      }

      addBreadcrumb({ category: 'deep-link', message: `Following safe deep link: ${path}`, level: 'info' });
      const target = resolveTarget(path);
      if (target) {
        const navigation = navigationRef.current;

        if (!navigation?.isReady()) {
          pendingUrlRef.current = rawUrl;
          addBreadcrumb({ category: 'deep-link', message: `Queued deep link until navigation ready: ${path}`, level: 'info' });
          return;
        }

        switch (target.name) {
          case 'MainTabs':
            navigation.navigate('MainTabs', target.params);
            break;
          case 'Documents':
            navigation.navigate('Documents');
            break;
          case 'Payroll':
            navigation.navigate('Payroll');
            break;
          case 'Compliance':
            navigation.navigate('Compliance');
            break;
          case 'Payment':
            navigation.navigate('Payment');
            break;
          case 'TaxGuide':
            navigation.navigate('TaxGuide');
            break;
          case 'Crypto':
            navigation.navigate('Crypto');
            break;
          case 'Reconciliation':
            navigation.navigate('Reconciliation');
            break;
          case 'Team':
            navigation.navigate('Team');
            break;
        }
      }
    } catch (err: unknown) {
      addBreadcrumb({ category: 'deep-link', message: `Deep link handling error: ${String(err)}`, level: 'error' });
      // Never crash — swallow silently
    }
  }
}
