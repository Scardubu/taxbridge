/**
 * TaxBridge — require2FA Fastify PreHandler
 *
 * Gates SUPER_ADMIN operations behind TOTP verification.
 * Checks Redis for a recent TOTP verification window (5 minutes).
 *
 * Usage:
 *   app.delete('/api/v1/admin/dangerous', {
 *     preHandler: [authenticate, requireRole('super_admin'), require2FA],
 *   }, handler);
 *
 * C-01: Uses `any` for Prisma types.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRedisConnection } from '../queue/client';
import { createLogger } from '../lib/logger';

const log = createLogger('require2FA');

/**
 * Fastify preHandler — requires TOTP verification within the last 5 minutes.
 *
 * Reads `totp:{userId}` key from Redis. If absent or expired, returns 403.
 * The TOTP verify endpoint sets this key with a 300s TTL.
 */
export async function require2FA(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = (request as any).user as { id?: string } | undefined;

  if (!user?.id) {
    return reply.code(401).send({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  const redis = getRedisConnection();

  if (!redis) {
    log.error('Redis unavailable — cannot verify 2FA state');
    return reply.code(503).send({
      success: false,
      error: 'Two-factor verification temporarily unavailable',
      code: '2FA_SERVICE_UNAVAILABLE',
    });
  }

  try {
    const verified = await redis.get(`totp:${user.id}`);

    if (verified !== '1') {
      log.warn('2FA verification required but not present', { userId: user.id });
      return reply.code(403).send({
        success: false,
        error: 'Two-factor authentication required for this operation',
        code: '2FA_REQUIRED',
      });
    }

    // 2FA verified within window — proceed
  } catch (err) {
    log.error('Redis error checking 2FA state', { error: err, userId: user.id });
    return reply.code(503).send({
      success: false,
      error: 'Two-factor verification temporarily unavailable',
      code: '2FA_SERVICE_UNAVAILABLE',
    });
  }
}
