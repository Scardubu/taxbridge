import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';

declare module 'fastify' {
  interface FastifyInstance {
    resolveOrgContext: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    orgContext: { orgId: string; role: string; memberId: string };
  }
}

export default fp(async function resolveOrgContextPlugin(fastify) {
  fastify.decorate('resolveOrgContext', async function resolveOrgContext(
    request: FastifyRequest, reply: FastifyReply,
  ) {
    const identity = request.user;
    if (!identity?.userId || !identity.orgId) {
      return reply.code(403).send({
        error: 'ORG_ACCESS_DENIED',
        message: 'Authenticated organization context is required',
      });
    }

    // Fail closed: database errors propagate to the global error handler.
    const member = await prisma.orgMember.findFirst({
      where: {
        userId: identity.userId,
        orgId: identity.orgId,
        removedAt: null,
        status: 'active',
      },
      select: { id: true, role: true, org: { select: { id: true, status: true } } },
    });

    if (!member) {
      return reply.code(403).send({
        error: 'ORG_ACCESS_DENIED',
        message: 'Access denied to this organisation',
      });
    }
    if (member.org.status !== 'active') {
      return reply.code(403).send({
        error: member.org.status === 'suspended' ? 'ORG_SUSPENDED' : 'ORG_NOT_ACTIVE',
        message: 'Organisation is not active',
      });
    }

    request.orgContext = {
      orgId: member.org.id,
      role: member.role,
      memberId: member.id,
    };
  });
});
