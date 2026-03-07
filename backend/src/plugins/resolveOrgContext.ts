/**
 * resolveOrgContext plugin — TaxBridge V13 Sovereign
 *
 * Fastify decorator: fastify.resolveOrgContext
 * Validates OrgMember.status === 'active' AND Organisation.status !== 'SUSPENDED'
 * Sets request.orgContext
 */
import fp                               from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma }                       from '../lib/prisma';

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
    const { userId, orgId } = request.user;

    const member = await (prisma as any).orgMember.findFirst({
      where: { userId, orgId, status: 'active', deletedAt: null },
    });
    if (!member) {
      return reply.code(403).send({
        error:   'ORG_ACCESS_DENIED',
        message: 'Access denied to this organisation',
      });
    }

    const org = await (prisma as any).organisation.findUnique({ where: { id: orgId } });
    if (!org || org.status === 'SUSPENDED') {
      return reply.code(403).send({ error: 'ORG_SUSPENDED' });
    }
    if (org.status === 'PENDING_VERIFICATION') {
      return reply.code(403).send({ error: 'ORG_PENDING_VERIFICATION' });
    }

    request.orgContext = { orgId, role: member.role, memberId: member.id };
  });
});
