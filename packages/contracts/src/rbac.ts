/**
 * TaxBridge RBAC — Role-Based Access Control (V13 Sovereign)
 *
 * Single source of truth for roles, hierarchy, and resource permissions.
 * V13 adds SUPER_ADMIN and uses uppercase role names.
 */

// ─── V13 Role types (uppercase) ───────────────────────────────────────────────
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OWNER' | 'ACCOUNTANT' | 'EMPLOYEE' | 'VIEWER';

/**
 * Numeric hierarchy — higher number = more privilege.
 * Used to implement "minimum role" checks efficiently.
 * requireRole: actor cannot assign a role ≥ their own level.
 */
export const ROLE_HIERARCHY: Readonly<Record<UserRole, number>> = {
  SUPER_ADMIN: 6,
  ADMIN:       5,
  OWNER:       4,
  ACCOUNTANT:  3,
  EMPLOYEE:    2,
  VIEWER:      1,
} as const;

// ─── Resources ────────────────────────────────────────────────────────────────
export type Resource =
  | 'dashboard:read'
  | 'invoices:read'
  | 'invoices:write'
  | 'expenses:write'
  | 'payroll:run'
  | 'filings:submit'
  | 'documents:vault'
  | 'team:manage'
  | 'rbac:assign'
  | 'audit:read'
  | 'system:admin'
  | 'dlq:manage'
  | 'ndpc:export'
  | 'sessions:invalidate'
  | 'nrs:override';

export const RESOURCE_MIN_ROLE: Readonly<Record<Resource, UserRole>> = {
  'dashboard:read':       'VIEWER',
  'invoices:read':        'VIEWER',
  'invoices:write':       'EMPLOYEE',
  'expenses:write':       'EMPLOYEE',
  'payroll:run':          'ACCOUNTANT',
  'filings:submit':       'ACCOUNTANT',
  'documents:vault':      'ACCOUNTANT',
  'team:manage':          'OWNER',
  'rbac:assign':          'OWNER',
  'audit:read':           'ADMIN',
  'system:admin':         'ADMIN',
  'dlq:manage':           'ADMIN',
  'ndpc:export':          'ADMIN',
  'sessions:invalidate':  'ADMIN',
  'nrs:override':         'SUPER_ADMIN',
} as const;

// ─── Helper functions ─────────────────────────────────────────────────────────

export function canAccess(userRole: UserRole, resource: Resource): boolean {
  const userLevel     = ROLE_HIERARCHY[userRole]    ?? 0;
  const requiredRole  = RESOURCE_MIN_ROLE[resource];
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 99;
  return userLevel >= requiredLevel;
}

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 99);
}

export function getAccessibleResources(userRole: UserRole): Resource[] {
  return (Object.entries(RESOURCE_MIN_ROLE) as [Resource, UserRole][])
    .filter(([, minRole]) => hasMinRole(userRole, minRole))
    .map(([resource]) => resource);
}

export function assertValidRole(role: unknown): asserts role is UserRole {
  const valid: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'ACCOUNTANT', 'EMPLOYEE', 'VIEWER'];
  // Also accept lowercase legacy roles (backward compat with V12 JWTs)
  const validLower = ['admin', 'owner', 'accountant', 'employee', 'viewer'];
  if (!valid.includes(role as UserRole) && !validLower.includes(role as string)) {
    throw new Error(`Invalid role: "${role}". Must be one of: ${valid.join(', ')}`);
  }
}

/**
 * Normalise a role string to V13 uppercase format.
 * Migration helper — drop when all JWTs are re-issued with uppercase roles.
 */
export function normaliseRole(role: string): UserRole {
  const upper = role.toUpperCase() as UserRole;
  if (ROLE_HIERARCHY[upper] !== undefined) return upper;
  // Fallback
  return 'VIEWER';
}
