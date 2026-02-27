/**
 * TaxBridge — Shared Authentication PreHandler
 *
 * Verifies JWT and populates request.user with:
 *   { id: string; role: UserRole; businessId?: string }
 *
 * Compatible with requireRole() / requireResource() from ./requireRole.ts.
 * Supports JWT_SECRET + JWT_SECRET_PREVIOUS (key rotation — zero-downtime).
 *
 * C-01: Uses `any` for Prisma types.
 * C-07: Returns 401, never 500.
 */

import jwt from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@taxbridge/contracts';
import { assertValidRole } from '@taxbridge/contracts';
import { getPrismaClient } from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('auth');
const prisma = getPrismaClient();

/**
 * Fastify preHandler — authenticate and populate request.user.
 *
 * Usage:
 *   import { authenticate } from '../middleware/authenticate';
 *   app.get('/api/v1/some-route', { preHandler: [authenticate] }, handler);
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader =
    typeof request.headers?.authorization === 'string'
      ? request.headers.authorization
      : '';

  if (!authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED',
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secrets = [
    process.env.JWT_SECRET,
    process.env.JWT_SECRET_PREVIOUS,
  ].filter(Boolean) as string[];

  if (secrets.length === 0) {
    log.error('No JWT secrets configured');
    return reply.code(401).send({
      success: false,
      error: 'Authentication unavailable',
      code: 'AUTH_MISCONFIGURED',
    });
  }

  let decoded: { userId?: string; role?: string; businessId?: string } | undefined;

  for (const secret of secrets) {
    try {
      const payload = jwt.verify(token, secret) as any;
      const userId = payload.userId ?? payload.sub;
      if (userId && typeof userId === 'string') {
        decoded = {
          userId,
          role: payload.role,
          businessId: payload.businessId,
        };
        break;
      }
    } catch {
      // try next secret
    }
  }

  if (!decoded?.userId) {
    return reply.code(401).send({
      success: false,
      error: 'Invalid or expired token',
      code: 'AUTH_INVALID',
    });
  }

  // If role is in the JWT token, use it; otherwise look up from DB
  let role: UserRole = 'viewer';
  if (decoded.role) {
    try {
      assertValidRole(decoded.role);
      role = decoded.role as UserRole;
    } catch {
      role = 'viewer';
    }
  } else {
    // Fetch role from DB (C-01: Prisma `any`)
    try {
      const user = await (prisma as any).user.findUnique({
        where: { id: decoded.userId },
        select: { role: true },
      });
      if (user?.role) {
        try {
          assertValidRole(user.role);
          role = user.role as UserRole;
        } catch {
          role = 'owner'; // safe default for existing users
        }
      } else {
        role = 'owner'; // existing users default to owner
      }
    } catch (dbErr) {
      // C-07: graceful degradation — use minimal role from JWT
      log.warn('Failed to fetch user role from DB, using viewer fallback', {
        userId: decoded.userId,
      });
      role = 'viewer';
    }
  }

  // Populate request.user for downstream middleware (requireRole, requireResource)
  (request as any).user = {
    id: decoded.userId,
    role,
    businessId: decoded.businessId,
  };
}
