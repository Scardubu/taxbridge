/**
 * TaxBridge — NRS Queue Routes
 * Admin endpoints for NRS submission queue health monitoring and manual requeue
 *
 * CONSTRAINT: All invoice submission must go through the NRS queue — never
 * call DigiTax/NRS directly. Reference: windsurfrules §7.1
 */

import type { FastifyInstance } from 'fastify';
import { getQueueHealth, enqueueNRSSubmission, QUEUE_NAMES } from '../queues/index.js';

export default async function nrsQueueRoutes(fastify: FastifyInstance) {

  // GET /health/queues is registered in server.ts (canonical — updates component metrics).

  /**
   * POST /api/v1/nrs/requeue/:invoiceId
   * Manually requeue a failed NRS submission (admin only).
   * Idempotent: uses invoiceId as BullMQ jobId — safe to call multiple times.
   */
  fastify.post<{ Params: { invoiceId: string } }>(
    '/api/v1/nrs/requeue/:invoiceId',
    { preHandler: [(fastify as any).authenticateAdmin] },
    async (req, reply) => {
      const { invoiceId } = req.params;

      const invoice = await (fastify as any).prisma.invoice.findUnique({
        where:  { id: invoiceId },
        select: { id: true, businessId: true, status: true },
      });

      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }

      const job = await enqueueNRSSubmission(invoice.id, invoice.businessId);
      return reply.code(200).send({
        success:  true,
        jobId:    job.id,
        queue:    QUEUE_NAMES.NRS_SUBMISSION,
        message:  `Invoice ${invoiceId} requeued for NRS submission`,
      });
    }
  );

  /**
   * GET /api/v1/nrs/queue-status
   * Returns NRS-specific queue metrics (subset of /health/queues).
   * Used by admin NRS Operations Center.
   */
  fastify.get('/api/v1/nrs/queue-status', async (_req, reply) => {
    const health = await getQueueHealth();
    const nrsQueue = health.queues.find((q) => q.name === QUEUE_NAMES.NRS_SUBMISSION);
    return reply.code(200).send({
      status:    health.status,
      queue:     nrsQueue ?? null,
      timestamp: health.timestamp,
    });
  });
}
