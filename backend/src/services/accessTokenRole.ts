import { normaliseRole } from '@taxbridge/contracts';

/**
 * Access tokens carry the platform role only for actual global administrators.
 * Every other user receives the role of the selected organization membership;
 * tenant endpoints re-resolve that membership from PostgreSQL per request.
 */
export function resolveAccessTokenRole(userRole: unknown, membershipRole: unknown): string {
  const platformRole = normaliseRole(typeof userRole === 'string' ? userRole : 'VIEWER');
  if (platformRole === 'ADMIN' || platformRole === 'SUPER_ADMIN') return platformRole;

  return normaliseRole(
    typeof membershipRole === 'string'
      ? membershipRole
      : typeof userRole === 'string' ? userRole : 'VIEWER',
  );
}
