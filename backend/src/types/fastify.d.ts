/**
 * TaxBridge — Fastify Type Augmentation
 *
 * Extends FastifyInstance with the custom decorations registered at server startup:
 *   - prisma   : Prisma client (typed as any per C-01)
 *   - redis    : ioredis client
 *   - authenticate : onRequest hook for JWT verification
 *
 * Also extends FastifyContextConfig with rateLimit metadata used by route configs
 * (custom rate-limiting is handled in lib/security.ts, not @fastify/rate-limit).
 *
 * C-01: Never use Prisma.XxxWhereInput — always cast through `any`.
 */

import type { Redis } from 'ioredis';
import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Prisma client — always access through `(fastify.prisma as any)` per C-01.
     * Decorated on startup via getPrismaClient() in server.ts.
     */
    prisma: any;

    /**
     * ioredis client decorated on startup.
     */
    redis: Redis;

    /**
     * JWT authentication hook — registered as an onRequest handler.
     * Verifies the Bearer token and attaches `request.user` on success.
     */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyContextConfig {
    /**
     * Per-route rate-limit config passed to lib/security.ts checkRateLimit().
     * @fastify/rate-limit is NOT used — this is metadata only.
     */
    rateLimit?: {
      max: number;
      timeWindow: string;
    };
  }
}
