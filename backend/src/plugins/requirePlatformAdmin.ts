import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';

/**
 * Platform-wide operational endpoints must not accept an organization-scoped
 * ADMIN membership. They can see or mutate data across tenants, so authorize
 * against the user's global platform role in the database, not the role claim
 * selected for an organization membership in the access token.
 */
export async function requirePlatformAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.user?.userId;
  if (!userId) {
    reply.code(401).send({ error: 'UNAUTHENTICATED' });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, deleted: false },
      select: { role: true },
    });

    if (!user) {
      reply.code(401).send({ error: 'PLATFORM_IDENTITY_NOT_ACTIVE' });
      return;
    }

    const platformRole = String(user.role ?? '').toUpperCase();
    if (platformRole !== 'ADMIN' && platformRole !== 'SUPER_ADMIN') {
      reply.code(403).send({ error: 'PLATFORM_ADMIN_REQUIRED' });
    }
  } catch (error) {
    request.log.error({ err: error }, 'Platform administrator authorization unavailable');
    reply.code(503).send({ error: 'PLATFORM_AUTHORIZATION_UNAVAILABLE' });
  }
}
