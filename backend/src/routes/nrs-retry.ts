/**
 * TaxBridge — NRS Retry Routes
 * POST /api/v1/nrs/retry/:id     — manually retry failed NRS submission
 * POST /api/v1/nrs/retry-queue   — admin: flush dead-letter queue
 *
 * NOTE: GET /api/v1/nrs/health is handled by nrs-status.ts (already registered)
 *
 * Constraints:
 *   C-01  Prisma `any` types only — no Prisma.XxxWhereInput
 *   C-10  NRS threshold: ₦200,000 per invoice (NRS 2026 §3)
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { submitToNRS, retryFailedSubmissions } from '../services/nrs-submission';
import { getPrismaClient } from '../lib/prisma';

const prisma = getPrismaClient();

export default async function nrsRetryRoutes(fastify: FastifyInstance) {

  // ── POST /api/v1/nrs/retry/:id (auth required) ────────────────────────────
  fastify.post('/api/v1/nrs/retry/:id', {
    preHandler: [fastify.authenticate],
    config:    { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply) => {
    const userId  = request.user.userId;
    const { id }  = request.params as { id: string };

    const invoice = await (prisma as any).invoice.findFirst({
      where: { id, userId },
    });

    if (!invoice) {
      return reply.status(404).send({
        success: false,
        error:   'NOT_FOUND',
        message: 'Invoice not found',
      });
    }

    if (invoice.nrsStatus === 'STAMPED') {
      return reply.send({
        success: true,
        data:    { alreadyStamped: true, irn: invoice.irn },
      });
    }

    // C-10: NRS threshold ₦200,000 (NRS 2026 §3)
    if (invoice.amount < 200_000) {
      return reply.send({
        success: true,
        data:    { skipped: true, reason: 'Below NRS threshold of ₦200,000 (NRS 2026 §3)' },
      });
    }

    const result = await submitToNRS(invoice.id, { forceResubmit: true });

    return reply.send({ success: true, data: result });
  });

  // ── POST /api/v1/nrs/retry-queue (admin only) ──────────────────────────────
  fastify.post('/api/v1/nrs/retry-queue', {
    preHandler: [fastify.authenticate],
    config:    { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply) => {
    // Admin key guard
    const adminKey = request.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return reply.status(403).send({ success: false, error: 'FORBIDDEN' });
    }

    const result = await retryFailedSubmissions();

    return reply.send({ success: true, data: result });
  });
}

