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
import jwt from 'jsonwebtoken';

import { ReconciliationService } from '../services/reconciliation';
import { AuthenticationError, NotFoundError } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('reconciliation-routes');

export default async function reconciliationRoutes(
  app: FastifyInstance,
  opts: { prisma: PrismaClient }
) {
  const prisma = opts.prisma;
  const reconciliationService = new ReconciliationService(prisma);

  // =========================================================================
  // Auth helper
  // =========================================================================
  async function authenticate(req: any): Promise<string> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }
    const token = authHeader.slice(7);
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET not configured');
      const payload = jwt.verify(token, secret) as { sub?: string; userId?: string };
      const userId = payload.sub || payload.userId;
      if (!userId) throw new Error('Invalid token payload');
      return userId;
    } catch (err: any) {
      if (err instanceof AuthenticationError) throw err;
      throw new AuthenticationError('Invalid or expired token');
    }
  }

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
  app.post('/api/v1/reconciliation/run', async (req, reply) => {
    const userId = await authenticate(req);
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
