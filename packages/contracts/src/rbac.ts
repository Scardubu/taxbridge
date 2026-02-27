/**
 * TaxBridge RBAC — Role-Based Access Control
 *
 * Single source of truth for roles, hierarchy, and resource permissions.
 * Imported by both backend (middleware/requireRole.ts) and mobile (auth context).
 *
 * Authority: MASTER_PROMPT_V10.3.md + V11.0 Engineering Spec
 *
 * Permission Matrix (✓ = allowed, cumulative upward through hierarchy):
 *
 * Resource                  admin  owner  accountant  employee  viewer
 * ──────────────────────────────────────────────────────────────────────
 * Dashboard read              ✓      ✓        ✓          ✓        ✓
 * Invoices read               ✓      ✓        ✓          ✓        ✓
 * Invoices create/edit        ✓      ✓        ✓          ✓        —
 * Expenses create/edit        ✓      ✓        ✓          ✓        —
 * Payroll run                 ✓      ✓        ✓          —        —
 * Tax filings submit          ✓      ✓        ✓          —        —
 * Documents vault             ✓      ✓        ✓          —        —
 * Team management             ✓      ✓        —          —        —
 * RBAC assign                 ✓      ✓        —          —        —
 * Audit log read              ✓      —        —          —        —
 * System / admin panel        ✓      —        —          —        —
 * DLQ management              ✓      —        —          —        —
 * NDPC export                 ✓      —        —          —        —
 * Session invalidation        ✓      —        —          —        —
 */

// ─── Role types ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'owner' | 'accountant' | 'employee' | 'viewer';

/**
 * Numeric hierarchy — higher number = more privilege.
 * Used to implement "minimum role" checks efficiently.
 */
export const ROLE_HIERARCHY: Readonly<Record<UserRole, number>> = {
  admin:       5,
  owner:       4,
  accountant:  3,
  employee:    2,
  viewer:      1,
} as const;

// ─── Resources ───────────────────────────────────────────────────────────────

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
  | 'sessions:invalidate';

/**
 * Minimum role required to access each resource.
 * Guards use ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole].
 */
export const RESOURCE_MIN_ROLE: Readonly<Record<Resource, UserRole>> = {
  'dashboard:read':       'viewer',
  'invoices:read':        'viewer',
  'invoices:write':       'employee',
  'expenses:write':       'employee',
  'payroll:run':          'accountant',
  'filings:submit':       'accountant',
  'documents:vault':      'accountant',
  'team:manage':          'owner',
  'rbac:assign':          'owner',
  'audit:read':           'admin',
  'system:admin':         'admin',
  'dlq:manage':           'admin',
  'ndpc:export':          'admin',
  'sessions:invalidate':  'admin',
} as const;

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Check if a role has sufficient privilege to access a resource.
 * Returns true if userRole meets or exceeds the minimum required role.
 *
 * @example
 * canAccess('accountant', 'payroll:run') // true
 * canAccess('employee', 'payroll:run')   // false
 */
export function canAccess(userRole: UserRole, resource: Resource): boolean {
  const userLevel    = ROLE_HIERARCHY[userRole]    ?? 0;
  const requiredRole = RESOURCE_MIN_ROLE[resource];
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 99;
  return userLevel >= requiredLevel;
}

/**
 * Check if a role meets or exceeds a minimum required role level.
 * Useful for "requires at least owner" guards.
 *
 * @example
 * hasMinRole('accountant', 'owner') // false
 * hasMinRole('owner',      'owner') // true
 * hasMinRole('admin',      'owner') // true
 */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 99);
}

/**
 * Return the list of all resources accessible to a given role.
 * Useful for frontend permission introspection (no need to call backend).
 */
export function getAccessibleResources(userRole: UserRole): Resource[] {
  return (Object.entries(RESOURCE_MIN_ROLE) as [Resource, UserRole][])
    .filter(([, minRole]) => hasMinRole(userRole, minRole))
    .map(([resource]) => resource);
}

/**
 * Assert a role is a valid UserRole. Throws if not.
 * Use at trust boundaries (JWT decoding, DB reads).
 */
export function assertValidRole(role: unknown): asserts role is UserRole {
  const valid: UserRole[] = ['admin', 'owner', 'accountant', 'employee', 'viewer'];
  if (!valid.includes(role as UserRole)) {
    throw new Error(`Invalid role: "${role}". Must be one of: ${valid.join(', ')}`);
  }
}
