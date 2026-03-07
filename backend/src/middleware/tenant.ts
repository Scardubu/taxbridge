/**
 * TaxBridge — Tenant Resolution Middleware (Fastify)
 *
 * Resolves the org context for multi-tenant operations.
 * Populates request.orgContext = { orgId, role, userId }.
 *
 * Usage:
 *   app.get('/api/v1/invoices', {
 *     preHandler: [authenticate, resolveTenant],
 *   }, handler);
 *
 * Tenant resolution strategy:
 *   1. X-Org-Id header (for users with multiple orgs)
 *   2. JWT payload businessId (single-org users)
 *   3. Default to user's primary org (first OrgMember record)
 *
 * C-01: Uses `any` for Prisma types.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getPrismaClient } from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('tenant');
const prisma = getPrismaClient();

export interface OrgContext {
  orgId: string;
  userId: string;
  role: string;
}

/**
 * Fastify preHandler — resolve org context for the authenticated user.
 * Requires `authenticate` to have run first (populates request.user).
 */
export { resolveTenant as resolveOrgContext };

export async function resolveTenant(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = (request as any).user as
    | { id?: string; businessId?: string; role?: string }
    | undefined;

  if (!user?.id) {
    return reply.code(401).send({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  // Strategy 1: Explicit org from header
  const headerOrgId = request.headers['x-org-id'] as string | undefined;

  // Strategy 2: From JWT
  const jwtOrgId = user.businessId;

  const requestedOrgId = headerOrgId || jwtOrgId;

  try {
    if (requestedOrgId) {
      // Verify user has access to this org
      const membership = await (prisma as any).orgMember.findFirst({
        where: {
          userId: user.id,
          orgId: requestedOrgId,
          status: 'active',
          deletedAt: null,
        },
      });

      if (!membership) {
        log.warn('User attempted to access unauthorized org', {
          userId: user.id,
          orgId: requestedOrgId,
        });
        return reply.code(403).send({
          success: false,
          error: 'You do not have access to this organization',
          code: 'ORG_ACCESS_DENIED',
        });
      }

      // COMP-08, C-12: reject requests targeting a suspended organisation
      const org = await (prisma as any).organisation.findUnique({
        where: { id: requestedOrgId },
        select: { status: true },
      });
      if (org?.status === 'suspended') {
        log.warn('Request blocked — organization is suspended', {
          userId: user.id,
          orgId: requestedOrgId,
        });
        return reply.code(403).send({
          success: false,
          error: 'Organization is suspended',
          code: 'ORG_SUSPENDED',
        });
      }

      if (org?.status === 'pending_verification') {
        return reply.code(403).send({
          success: false,
          error: 'Organization is pending verification',
          code: 'ORG_PENDING_VERIFICATION',
        });
      }

      (request as any).orgContext = {
        orgId: requestedOrgId,
        userId: user.id,
        role: membership.role || user.role || 'viewer',
      } satisfies OrgContext;
      return;
    }

    // Strategy 3: Default to primary org
    const primaryMembership = await (prisma as any).orgMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    if (!primaryMembership) {
      // User has no org — this is acceptable for onboarding flow
      (request as any).orgContext = {
        orgId: '',
        userId: user.id,
        role: user.role || 'viewer',
      } satisfies OrgContext;
      return;
    }

    (request as any).orgContext = {
      orgId: primaryMembership.orgId,
      userId: user.id,
      role: primaryMembership.role || user.role || 'viewer',
    } satisfies OrgContext;
  } catch (err) {
    log.error('Failed to resolve tenant context', { error: err, userId: user.id });
    return reply.code(500).send({
      success: false,
      error: 'Failed to resolve organization context',
      code: 'TENANT_RESOLUTION_FAILED',
    });
  }
}
