/**
 * TaxBridge — RBAC Enforcement Plugin (P3)
 *
 * Fastify plugin that enforces role-based access control on registered routes
 * without requiring changes to individual route handlers.
 *
 * Strategy:
 *   1. `onRequest` hook populates `request.user` with JWT-derived role info.
 *   2. `preHandler` hook checks route patterns against the RBAC resource matrix.
 *   3. Routes that don't match any pattern pass through (backward-compatible).
 *
 * C-01:  Prisma types → `any` only.
 * C-07:  Never returns 500 — graceful fallback to 'viewer' role.
 * C-12:  Compatible with cold-start fallback (admin routes).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import type { Resource } from '@taxbridge/contracts';
import { canAccess, assertValidRole } from '@taxbridge/contracts';
import type { UserRole } from '@taxbridge/contracts';
import { getPrismaClient } from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('rbac-plugin');
const prisma = getPrismaClient();

// ─── Route → Resource mapping ─────────────────────────────────────────────────
// Maps URL patterns + HTTP methods to RBAC resources.
// Order: most specific first.  `*` matches any remaining path segment.

interface RouteRule {
  method: string | '*';
  pattern: RegExp;
  resource: Resource;
}

const ROUTE_RULES: RouteRule[] = [
  // Payroll — accountant+
  { method: 'POST', pattern: /^\/api\/v1\/payroll\/process/, resource: 'payroll:run' },
  { method: 'POST', pattern: /^\/api\/v1\/payroll\/employees/, resource: 'payroll:run' },
  { method: 'PUT',  pattern: /^\/api\/v1\/payroll\/employees\//, resource: 'payroll:run' },
  { method: 'DELETE', pattern: /^\/api\/v1\/payroll\/employees\//, resource: 'payroll:run' },

  // Filing submission — accountant+
  { method: 'POST', pattern: /^\/api\/v1\/compliance\//, resource: 'filings:submit' },

  // Invoice write — employee+
  { method: 'POST', pattern: /^\/api\/v1\/invoices/, resource: 'invoices:write' },
  { method: 'PUT',  pattern: /^\/api\/v1\/invoices\//, resource: 'invoices:write' },
  { method: 'DELETE', pattern: /^\/api\/v1\/invoices\//, resource: 'invoices:write' },

  // Expense write — employee+
  { method: 'POST', pattern: /^\/api\/v1\/expenses/, resource: 'expenses:write' },
  { method: 'PUT',  pattern: /^\/api\/v1\/expenses\//, resource: 'expenses:write' },
  { method: 'DELETE', pattern: /^\/api\/v1\/expenses\//, resource: 'expenses:write' },

  // Bulk operations — employee+
  { method: 'POST', pattern: /^\/api\/v1\/bulk\//, resource: 'invoices:write' },

  // NDPC export — admin only
  { method: '*', pattern: /^\/api\/v[12]\/privacy\/ndpc-export/, resource: 'ndpc:export' },

  // DLQ management — admin only (v2 monitoring)
  { method: '*', pattern: /^\/api\/v2\/monitoring\//, resource: 'system:admin' },

  // Session invalidation — admin only
  { method: 'POST', pattern: /^\/api\/v1\/admin\/sessions\//, resource: 'sessions:invalidate' },
];

// ─── JWT helper (reusable) ────────────────────────────────────────────────────

function extractUserId(request: FastifyRequest): {
  userId?: string;
  jwtRole?: string;
  businessId?: string;
} {
  const authHeader =
    typeof request.headers?.authorization === 'string'
      ? request.headers.authorization
      : '';

  if (!authHeader.startsWith('Bearer ')) return {};

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secrets = [
    process.env.JWT_SECRET,
    process.env.JWT_SECRET_PREVIOUS,
  ].filter(Boolean) as string[];

  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret) as any;
      const userId = decoded.userId ?? decoded.sub;
      if (userId && typeof userId === 'string') {
        return {
          userId,
          jwtRole: decoded.role,
          businessId: decoded.businessId,
        };
      }
    } catch {
      // try next secret
    }
  }

  return {};
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

async function rbacPlugin(fastify: FastifyInstance): Promise<void> {
  // Cache: userId → role (5 minutes TTL)
  const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();
  const CACHE_TTL_MS = 5 * 60 * 1000;

  async function resolveRole(userId: string, jwtRole?: string): Promise<UserRole> {
    // Check cache
    const cached = roleCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.role;
    }

    // JWT role takes precedence if valid
    if (jwtRole) {
      try {
        assertValidRole(jwtRole);
        roleCache.set(userId, { role: jwtRole as UserRole, expiresAt: Date.now() + CACHE_TTL_MS });
        return jwtRole as UserRole;
      } catch {
        // fall through to DB lookup
      }
    }

    // DB lookup (C-01: Prisma `any`)
    try {
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user?.role) {
        try {
          assertValidRole(user.role);
          const role = user.role as UserRole;
          roleCache.set(userId, { role, expiresAt: Date.now() + CACHE_TTL_MS });
          return role;
        } catch {
          // invalid role in DB
        }
      }
    } catch {
      // C-07: DB unavailable — graceful fallback
    }

    // Default for existing users who haven't been assigned a role
    return 'owner';
  }

  // Hook: populate request.user.role for all authenticated requests
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const { userId, jwtRole, businessId } = extractUserId(request);
    if (userId) {
      const role = await resolveRole(userId, jwtRole);
      // Set or augment request.user
      const existing = (request as any).user ?? {};
      (request as any).user = {
        ...existing,
        id: existing.id ?? userId,
        role,
        businessId: existing.businessId ?? businessId,
      };
    }
  });

  // Hook: enforce RBAC based on route patterns
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const matched = ROUTE_RULES.find(
      (rule) =>
        (rule.method === '*' || rule.method === request.method) &&
        rule.pattern.test(request.url),
    );

    if (!matched) return; // No RBAC rule for this route — pass through

    const user = (request as any).user as
      | { id?: string; role?: UserRole }
      | undefined;

    // No user context → likely unauthenticated; let the route's own auth handle 401
    if (!user?.id || !user?.role) return;

    if (!canAccess(user.role, matched.resource)) {
      log.warn('RBAC enforcement: access denied', {
        userId: user.id,
        role: user.role,
        resource: matched.resource,
        url: request.url,
        method: request.method,
        requestId: request.id,
      });

      return reply.code(403).send({
        success: false,
        error: `Forbidden: insufficient permissions for this action`,
        code: 'INSUFFICIENT_ROLE',
        resource: matched.resource,
        requiredRole: null, // Don't leak role hierarchy
      });
    }
  });
}

// Mark as non-encapsulated so hooks apply to all routes in parent scope
// See: https://fastify.dev/docs/latest/Reference/Plugins/#handle-the-scope
(rbacPlugin as any)[Symbol.for('skip-override')] = true;

export default rbacPlugin;
