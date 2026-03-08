/**
 * Reconciliation Routes (Phase 6)
 *
 * Invoice-payment reconciliation endpoints.
 *
 * Endpoints:
 * POST /api/v1/reconciliation/run — Run reconciliation for a business
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

import { ReconciliationService } from '../services/reconciliation';
import { NotFoundError } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('reconciliation-routes');

export default async function reconciliationRoutes(
  app: FastifyInstance,
  opts: { prisma: PrismaClient }
) {
  const prisma = opts.prisma;
  const reconciliationService = new ReconciliationService(prisma);

  // =========================================================================
  // Validation Schemas
  // =========================================================================

  const ReconcileSchema = z.object({
    businessId: z.string().uuid(),
    fromDate: z.string().refine(d => !isNaN(Date.parse(d)), 'Invalid date').optional(),
    toDate: z.string().refine(d => !isNaN(Date.parse(d)), 'Invalid date').optional(),
    fuzzyThreshold: z.number().min(0).max(50).optional(),
  });

  // =========================================================================
  // POST /api/v1/reconciliation/run — Run reconciliation
  // =========================================================================
  app.post('/api/v1/reconciliation/run', { preHandler: [app.authenticate, app.resolveOrgContext] }, async (req, reply) => {
    const userId = req.user.userId;
    const body = ReconcileSchema.parse(req.body);

    try {
      const report = await reconciliationService.reconcile(userId, body.businessId, {
        fromDate: body.fromDate,
        toDate: body.toDate,
        fuzzyThreshold: body.fuzzyThreshold,
      });

      return reply.send({ success: true, data: { report } });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', body.businessId);
      throw err;
    }
  });
}
