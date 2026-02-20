import type { FastifyInstance } from 'fastify';
import { getNRSQueueHealth, enqueueNRSSubmission } from '../queues/nrs-queue.js';

export default async function nrsQueueRoutes(fastify: FastifyInstance) {
  /**
   * GET /health/queues
   * Returns NRS queue stats — used by admin NRS monitor + deployment verification
   */
  fastify.get('/health/queues', async (_req, reply) => {
    const health = await getNRSQueueHealth();
    return reply.send({
      nrs: health,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/v1/nrs/requeue/:invoiceId
   * Admin: manually requeue a failed NRS submission
   */
  fastify.post(
    '/api/v1/nrs/requeue/:invoiceId',
    { preHandler: [(fastify as any).authenticateAdmin] },
    async (req, reply) => {
      const { invoiceId } = req.params as { invoiceId: string };

      const invoice = await (fastify as any).prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, businessId: true },
      });

      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }

      const jobId = await enqueueNRSSubmission(invoice.id, invoice.businessId);
      return reply.send({ success: true, jobId, message: 'Requeued for NRS submission' });
    }
  );
}
