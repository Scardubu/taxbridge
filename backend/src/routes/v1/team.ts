/**
 * Team Management Routes (MOD-27)
 *
 * GET    /api/v1/team                    — List org members
 * POST   /api/v1/team/invite             — Invite member (OWNER+)
 * PATCH  /api/v1/team/:userId/role       — Update role (OWNER+ — cannot assign ≥ own level)
 * DELETE /api/v1/team/:userId            — Remove member (OWNER+; 409 if last OWNER)
 * GET    /api/v1/team/accountants        — List accountant delegations
 * POST   /api/v1/team/accountants        — Grant delegation
 * DELETE /api/v1/team/accountants/:id    — Revoke delegation
 *
 * RBAC: OWNER may only assign roles ≤ OWNER level; ADMIN may assign ≤ ADMIN.
 * Session invalidation on role change: redis.del(sessions:userId) + role_version setex
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { resolveOrgContext } from '../../middleware/tenant';
import { requireRole } from '../../middleware/requireRole';
import { writeAuditEvent } from '../../services/audit';
import { createLogger } from '../../lib/logger';
import { getPrismaClient } from '../../lib/prisma';
import { getRedisConnection } from '../../queue/client';

const log = createLogger('team');

// ─── Role hierarchy (§7.1) ────────────────────────────────────────────────

const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 6,
  ADMIN:       5,
  OWNER:       4,
  ACCOUNTANT:  3,
  EMPLOYEE:    2,
  VIEWER:      1,
};

const ASSIGNABLE_ROLES = ['OWNER', 'ACCOUNTANT', 'EMPLOYEE', 'VIEWER'] as const;
type AssignableRole = typeof ASSIGNABLE_ROLES[number];

// ─── Session invalidation helper ──────────────────────────────────────────

async function invalidateSession(userId: string) {
  const redis = getRedisConnection();
  if (!redis) return;
  await redis.del(`sessions:${userId}`);
  // C-44: role_version increment — covers role change (path 1) and account suspension (path 3)
  await redis.del(`role_version:${userId}`);
  await redis.setex(`role_version:${userId}`, 60 * 60 * 24 * 7, Date.now().toString());
}

// ─── Routes ──────────────────────────────────────────────────────────────

export default async function teamRoutes(app: FastifyInstance) {
  const prisma = getPrismaClient();

  // ── List members ─────────────────────────────────────────────────────────
  app.get(
    '/api/v1/team',
    { preHandler: [authenticate, resolveOrgContext] },
    async (req, reply) => {
      const orgId = (req as any).orgContext.orgId;
      const members = await (prisma as any).orgMember?.findMany({
        where:   { orgId, status: 'active', deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }) ?? [];
      return reply.send({ members });
    },
  );

  // ── Invite member ─────────────────────────────────────────────────────────
  app.post(
    '/api/v1/team/invite',
    { preHandler: [authenticate, resolveOrgContext, requireRole('owner')] },
    async (req, reply) => {
      const parseResult = z.object({
        email: z.string().email(),
        role:  z.enum(ASSIGNABLE_ROLES),
      }).safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parseResult.error.issues });
      }

      const { email, role } = parseResult.data;
      const orgId      = (req as any).orgContext.orgId;
      const actorId    = (req as any).user.id;
      const actorRole  = (req as any).user.role;

      // Enforce: actor cannot assign a role ≥ their own level (§7.1 ¹)
      const actorLevel  = ROLE_LEVEL[actorRole] ?? 0;
      const targetLevel = ROLE_LEVEL[role] ?? 0;
      if (targetLevel >= actorLevel) {
        return reply.status(403).send({
          error:   'INSUFFICIENT_ROLE',
          message: `You cannot assign the ${role} role (your level: ${actorRole}).`,
        });
      }

      // Find or create user by email
      const user = await (prisma as any).user?.findUnique({ where: { email } });
      if (!user) {
        return reply.status(404).send({ error: 'USER_NOT_FOUND', message: `No user found with email ${email}.` });
      }

      // Check if already a member
      const existing = await (prisma as any).orgMember?.findFirst({
        where: { orgId, userId: user.id, status: 'active' },
      });
      if (existing) {
        return reply.status(409).send({ error: 'ALREADY_MEMBER', message: 'User is already a member of this organisation.' });
      }

      const member = await (prisma as any).orgMember?.create({
        data: { orgId, userId: user.id, role, status: 'active' },
      });

      await writeAuditEvent({
        orgId, actorId, actorRole,
        targetType: 'OrgMember', targetId: member?.id ?? user.id,
        action:     'ROLE_CHANGE' as any,
        after:      { role, userId: user.id, email },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      log.info({ orgId, userId: user.id, role }, 'Team member invited');
      return reply.status(201).send({ success: true, member });
    },
  );

  // ── Update role ────────────────────────────────────────────────────────────
  app.patch<{ Params: { userId: string } }>(
    '/api/v1/team/:userId/role',
    { preHandler: [authenticate, resolveOrgContext, requireRole('owner')] },
    async (req, reply) => {
      const parseResult = z.object({ role: z.enum(ASSIGNABLE_ROLES) }).safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parseResult.error.issues });
      }

      const { role: newRole }  = parseResult.data;
      const { userId }         = req.params;
      const orgId              = (req as any).orgContext.orgId;
      const actorId            = (req as any).user.id;
      const actorRole          = (req as any).user.role;

      const actorLevel  = ROLE_LEVEL[actorRole]  ?? 0;
      const targetLevel = ROLE_LEVEL[newRole]     ?? 0;
      if (targetLevel >= actorLevel) {
        return reply.status(403).send({
          error: 'INSUFFICIENT_ROLE',
          message: `You cannot assign the ${newRole} role.`,
        });
      }

      const member = await (prisma as any).orgMember?.findFirst({
        where: { orgId, userId, status: 'active', deletedAt: null },
      });
      if (!member) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Member not found.' });

      const before = { role: member.role };
      await (prisma as any).orgMember?.update({ where: { id: member.id }, data: { role: newRole } });

      // Session invalidation on role change (§7.4)
      await invalidateSession(userId);

      await writeAuditEvent({
        orgId, actorId, actorRole,
        targetType: 'OrgMember', targetId: member.id,
        action:     'ROLE_CHANGE' as any,
        before, after: { role: newRole },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      return reply.send({ success: true, userId, newRole });
    },
  );

  // ── Remove member ─────────────────────────────────────────────────────────
  app.delete<{ Params: { userId: string } }>(
    '/api/v1/team/:userId',
    { preHandler: [authenticate, resolveOrgContext, requireRole('owner')] },
    async (req, reply) => {
      const { userId }  = req.params;
      const orgId       = (req as any).orgContext.orgId;
      const actorId     = (req as any).user.id;
      const actorRole   = (req as any).user.role;

      const member = await (prisma as any).orgMember?.findFirst({
        where: { orgId, userId, status: 'active', deletedAt: null },
      });
      if (!member) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Member not found.' });

      // 409 LAST_OWNER — cannot remove last OWNER
      if (member.role === 'OWNER') {
        const ownerCount = await (prisma as any).orgMember?.count({
          where: { orgId, role: 'OWNER', status: 'active', deletedAt: null },
        });
        if (ownerCount <= 1) {
          return reply.status(409).send({
            error:   'LAST_OWNER',
            message: 'Cannot remove the last OWNER of the organisation.',
            code:    409,
          });
        }
      }

      // Soft delete (deletedAt = now, status = 'inactive')
      await (prisma as any).orgMember?.update({
        where: { id: member.id },
        data:  { status: 'inactive', deletedAt: new Date() },
      });

      await invalidateSession(userId);

      await writeAuditEvent({
        orgId, actorId, actorRole,
        targetType: 'OrgMember', targetId: member.id,
        action:     'MEMBER_REMOVED' as any,
        before:     { role: member.role, userId },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      return reply.send({ success: true, removedUserId: userId });
    },
  );

  // ── List accountant delegations ───────────────────────────────────────────
  app.get(
    '/api/v1/team/accountants',
    { preHandler: [authenticate, resolveOrgContext] },
    async (req, reply) => {
      const orgId = (req as any).orgContext.orgId;
      const delegations = await (prisma as any).accountantClient?.findMany({
        where: { clientOrgId: orgId, revokedAt: null },
      }) ?? [];
      return reply.send({ delegations });
    },
  );

  // ── Grant accountant delegation ───────────────────────────────────────────
  app.post(
    '/api/v1/team/accountants',
    { preHandler: [authenticate, resolveOrgContext, requireRole('owner')] },
    async (req, reply) => {
      const parseResult = z.object({
        accountantUserId: z.string().cuid(),
        permissions:      z.array(z.string()).min(1),
      }).safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parseResult.error.issues });
      }

      const { accountantUserId, permissions } = parseResult.data;
      const orgId   = (req as any).orgContext.orgId;
      const actorId = (req as any).user.id;
      const role    = (req as any).user.role;

      const delegation = await (prisma as any).accountantClient?.create({
        data: { accountantId: accountantUserId, clientOrgId: orgId, permissions },
      });

      await writeAuditEvent({
        orgId, actorId, actorRole: role,
        targetType: 'AccountantDelegation', targetId: delegation?.id ?? '',
        action:     'DELEGATION_GRANT' as any,
        after:      { accountantUserId, permissions },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      return reply.status(201).send({ success: true, delegation });
    },
  );

  // ── Revoke accountant delegation ──────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/api/v1/team/accountants/:id',
    { preHandler: [authenticate, resolveOrgContext, requireRole('owner')] },
    async (req, reply) => {
      const orgId   = (req as any).orgContext.orgId;
      const actorId = (req as any).user.id;
      const role    = (req as any).user.role;

      const delegation = await (prisma as any).accountantClient?.update({
        where: { id: req.params.id },
        data:  { revokedAt: new Date() },
      });

      await writeAuditEvent({
        orgId, actorId, actorRole: role,
        targetType: 'AccountantDelegation', targetId: req.params.id,
        action:     'DELEGATION_REVOKE' as any,
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      return reply.send({ success: true, delegation });
    },
  );
}
