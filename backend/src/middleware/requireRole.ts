/**
 * TaxBridge — requireRole Fastify preHandler factory
 *
 * Enforces RBAC on Fastify routes using the canonical permission
 * matrix from @taxbridge/contracts.
 *
 * Usage (route level):
 *   app.delete('/api/v1/admin/users/:id', {
 *     preHandler: [authenticate, requireRole('admin')],
 *   }, handler);
 *
 * Usage (resource level — preferred, auto-derives min role):
 *   app.post('/api/v1/payroll/run', {
 *     preHandler: [authenticate, requireResource('payroll:run')],
 *   }, handler);
 *
 * Requirements:
 *   - `authenticate` (or equivalent JWT middleware) must run BEFORE requireRole.
 *   - JWT payload must include `role: UserRole` field. If absent, defaults to 'viewer'
 *     and access is denied for anything requiring elevated privilege.
 *   - All 403 rejections emit an audit event for review.
 *
 * Auth shape (set by authenticate preHandler):
 *   request.user = { id: string; role: UserRole; businessId?: string }
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  type UserRole,
  type Resource,
  hasMinRole,
  canAccess,
  assertValidRole,
} from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';

const log = createLogger('rbac');

// ─── Internal audit emitter ───────────────────────────────────────────────────

function emitForbiddenAudit(
  request: FastifyRequest,
  userRole: string,
  required: string,
  resource?: string
): void {
  log.warn('RBAC: access denied', {
    userId:     (request as any).user?.id ?? 'unknown',
    userRole,
    required,
    resource:   resource ?? null,
    url:        request.url,
    method:     request.method,
    ip:         (request as any).clientIP ?? request.ip,
    requestId:  request.id,
  });
}

// ─── requireRole factory ──────────────────────────────────────────────────────

/**
 * Returns a Fastify preHandler that blocks the request unless the
 * authenticated user's role meets `minimumRole`.
 *
 * Gate: request.user.role >= minimumRole (ROLE_HIERARCHY numeric comparison)
 *
 * @param minimumRole — Minimum role required to proceed.
 */
export function requireRole(minimumRole: UserRole) {
  return async function roleGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const user = (request as any).user as
      | { id?: string; role?: unknown }
      | undefined;

    if (!user?.id) {
      return reply.code(401).send({
        success: false,
        error:   'Unauthorized',
        code:    'AUTH_REQUIRED',
      });
    }

    const rawRole = user.role ?? 'viewer';

    let role: UserRole;
    try {
      assertValidRole(rawRole);
      role = rawRole;
    } catch {
      role = 'viewer';
    }

    if (!hasMinRole(role, minimumRole)) {
      emitForbiddenAudit(request, role, minimumRole);
      return reply.code(403).send({
        success: false,
        error:   'Forbidden: insufficient role',
        code:    'INSUFFICIENT_ROLE',
        required: minimumRole,
        current:  role,
      });
    }
  };
}

// ─── requireResource factory ──────────────────────────────────────────────────

/**
 * Returns a Fastify preHandler that blocks unless the user has access
 * to the named resource per the RBAC permission matrix.
 *
 * Preferred over `requireRole` when guarding a specific operation because
 * it documents intent and degrades gracefully if the matrix changes.
 *
 * @param resource — Resource key from the RBAC matrix (e.g. 'payroll:run')
 */
export function requireResource(resource: Resource) {
  return async function resourceGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const user = (request as any).user as
      | { id?: string; role?: unknown }
      | undefined;

    if (!user?.id) {
      return reply.code(401).send({
        success: false,
        error:   'Unauthorized',
        code:    'AUTH_REQUIRED',
      });
    }

    const rawRole = user.role ?? 'viewer';

    let role: UserRole;
    try {
      assertValidRole(rawRole);
      role = rawRole;
    } catch {
      role = 'viewer';
    }

    if (!canAccess(role, resource)) {
      emitForbiddenAudit(request, role, `resource:${resource}`, resource);
      return reply.code(403).send({
        success: false,
        error:   `Forbidden: access to '${resource}' requires a higher role`,
        code:    'INSUFFICIENT_RESOURCE_ACCESS',
        resource,
        current: role,
      });
    }
  };
}

// ─── Session invalidation helper ─────────────────────────────────────────────

/**
 * Middleware that logs a session invalidation audit event.
 * Call after confirming the target session is revoked.
 */
export function auditSessionInvalidation(
  actorId: string,
  targetUserId: string,
  reason: string
): void {
  log.info('Session invalidated', { actorId, targetUserId, reason });
}
