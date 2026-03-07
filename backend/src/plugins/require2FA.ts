/**
 * require2FA preHandler — TaxBridge V13 Sovereign
 *
 * Checks totp:verified:${userId} in Redis (TTL 300s).
 * C-29: NRS circuit override requires SUPER_ADMIN + 2FA.
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { redis }                        from '../lib/redis';

export async function require2FA(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  const userId = request.user?.userId;
  if (!userId) {
    return reply.code(401).send({ error: 'UNAUTHORIZED' });
  }

  const verified = await redis.get(`totp:verified:${userId}`);
  if (!verified) {
    return reply.code(403).send({
      error:   '2FA_REQUIRED',
      message: 'Two-factor authentication is required for this action',
    });
  }
}
