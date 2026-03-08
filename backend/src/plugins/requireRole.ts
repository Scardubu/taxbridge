/**
 * requireRole preHandler factory — TaxBridge V13 Sovereign
 *
 * Usage: preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('ACCOUNTANT')]
 *
 * C-24: RBAC via preHandler only — no inline if (request.user.role === ...) in any handler
 * C-25: ACCESS_DENIED audit is fire-and-forget (.catch(()=>{}))
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { ROLE_HIERARCHY, type UserRole } from '@taxbridge/contracts';
import { writeAuditEvent }              from '../services/audit';

export function requireRole(minRole: UserRole) {
  return async function requireRoleHandler(
    request: FastifyRequest,
    reply:   FastifyReply,
  ) {
    const actorRole = (request.orgContext?.role ?? request.user?.role ?? 'VIEWER') as UserRole;
    const actorLevel    = ROLE_HIERARCHY[actorRole]  ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole]    ?? 99;

    if (actorLevel < requiredLevel) {
      // Fire-and-forget — C-25 exception for ACCESS_DENIED
      writeAuditEvent({
        actorId:    request.user?.userId ?? 'unknown',
        actorRole:  actorRole,
        action:     'ACCESS_DENIED',
        resource:   request.routeOptions?.url ?? request.url,
        orgId:      request.orgContext?.orgId,
        ip:         request.ip,
        userAgent:  request.headers['user-agent'],
      }).catch(() => {});

      return reply.code(403).send({
        error:   'INSUFFICIENT_ROLE',
        message: `Requires role: ${minRole}`,
      });
    }
  };
}
