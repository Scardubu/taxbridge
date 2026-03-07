/**
 * CIT Annual Assessment Filing (MOD-28, GAP-05, C-41)
 *
 * POST /api/v1/filings/cit — File annual CIT assessment
 *
 * Uses calculateCIT() from @taxbridge/contracts exclusively (C-41).
 * 8 steps on mobile: tax year → P&L → loss carry-forward → dev levy →
 * education tax → assessment summary → payment → receipt.
 *
 * Backend: authenticate + resolveOrgContext + requireRole('ACCOUNTANT') +
 * validate(CITSchema) + idempotency
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { resolveTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/requireRole';
import { idempotency } from '../../middleware/idempotency';
import { writeAuditEvent } from '../../services/audit';
import { createLogger } from '../../lib/logger';
import { getPrismaClient } from '../../lib/prisma';
import { calculateCIT } from '@taxbridge/contracts';
import { SMALL_CO_CIT_THRESHOLD } from '@taxbridge/contracts';
import crypto from 'node:crypto';

const log = createLogger('filing-cit');

const CITSchema = z.object({
  taxYear: z.string().regex(/^\d{4}$/),
  turnover: z.number().min(0),
  profit: z.number(),
  devLevyApplies: z.boolean(),
  taxLossCarryforward: z.number().min(0).optional().default(0),
});

export default async function citFilingRoutes(app: FastifyInstance) {
  const prisma = getPrismaClient();

  app.post(
    '/api/v1/filings/cit',
    { preHandler: [authenticate, resolveTenant, requireRole('ACCOUNTANT'), idempotency()] },
    async (req, reply) => {
      const parsed = CITSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parsed.error.issues,
        });
      }

      const { taxYear, turnover, profit, devLevyApplies, taxLossCarryforward } = parsed.data;
      const orgId = (req as any).orgContext.orgId;
      const userId = (req as any).user.id;

      const existing = await (prisma as any).taxReturn?.findFirst({
        where: { orgId, taxType: 'CIT', period: taxYear },
      });
      if (existing) {
        return reply.status(409).send({
          error: 'DUPLICATE_FILING',
          filingReference: existing.filingReference,
        });
      }

      const result = calculateCIT({ turnover, profit, devLevyApplies, taxLossCarryforward });

      const warnings: string[] = [];
      if (turnover >= SMALL_CO_CIT_THRESHOLD * 0.9 && turnover < SMALL_CO_CIT_THRESHOLD) {
        warnings.push('APPROACHING_CIT_THRESHOLD');
      }

      const filingReference = `TB-${taxYear}-CIT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      const filing = await (prisma as any).taxReturn?.create({
        data: {
          orgId,
          userId,
          taxType: 'CIT',
          period: taxYear,
          filingReference,
          status: 'FILED',
          submittedAt: new Date(),
          amount: result.total,
          metadata: {
            turnover,
            profit,
            devLevyApplies,
            taxLossCarryforward,
            ...result,
          },
        },
      });

      await writeAuditEvent({
        orgId,
        actorId: userId,
        action: 'FILE',
        targetType: 'TaxReturn',
        targetId: filing?.id ?? filingReference,
        after: { taxType: 'CIT', period: taxYear, total: result.total },
        ip: req.ip ?? '0.0.0.0',
        userAgent: req.headers['user-agent'],
      });

      log.info('CIT filing submitted', { orgId, taxYear, total: result.total });

      return reply.status(201).send({
        filingReference,
        assessment: result,
        warnings,
      });
    },
  );
}
