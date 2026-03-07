/**
 * NIL Return Filing Route (MOD-21, C-35)
 *
 * POST /api/v1/filings/nil
 *
 * Idempotency: 409 DUPLICATE_FILING if same (orgId, taxType, period) already filed.
 * Penalty warning included if filing is late.
 * Audit: await writeAuditEvent on FILE action.
 *
 * Middleware chain (C-34, C-35):
 *   authenticate → resolveOrgContext → idempotency() → validate(schema) → handler
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { resolveOrgContext } from '../../middleware/tenant';
import { idempotency } from '../../middleware/idempotency';
import { writeAuditEvent } from '../../services/audit';
import { calculatePenalty } from '@taxbridge/contracts';
import { createLogger } from '../../lib/logger';
import { getPrismaClient } from '../../lib/prisma';

const log = createLogger('filings:nil');

// ─── NilReason enum ────────────────────────────────────────────────────────

export const NIL_REASONS = [
  'NO_REVENUE_THIS_PERIOD',
  'BUSINESS_INACTIVE',
  'EXEMPT_SUPPLY_ONLY',
  'BELOW_REGISTRATION_THRESHOLD',
] as const;

export type NilReason = typeof NIL_REASONS[number];

// ─── Schema (C-34) ────────────────────────────────────────────────────────

const NilFilingSchema = z.object({
  taxType: z.enum(['VAT', 'WHT', 'PAYE', 'CIT']),
  period:  z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  reason:  z.enum(NIL_REASONS),
});

type NilFilingBody = z.infer<typeof NilFilingSchema>;

// ─── Deadline helpers ──────────────────────────────────────────────────────

function getDeadlineForPeriod(taxType: NilFilingBody['taxType'], period: string): Date {
  const [year, month] = period.split('-').map(Number);
  switch (taxType) {
    case 'VAT':  return new Date(year, month, 21);  // 21st of following month
    case 'WHT':  return new Date(year, month, 21);  // 21st of following month
    case 'PAYE': return new Date(year, month, 10);  // 10th of following month
    case 'CIT':  return new Date(year + 1, 5, 30);  // 6 months after year-end (simplified)
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────

export default async function nilFilingRoutes(app: FastifyInstance) {
  const prisma = getPrismaClient();

  app.post<{ Body: NilFilingBody }>(
    '/api/v1/filings/nil',
    {
      preHandler: [
        authenticate,
        resolveOrgContext,
        idempotency({ required: false }),
      ],
    },
    async (req, reply) => {
      // C-34: body is validated by idempotency/validate middleware; schema applied below
      const parseResult = NilFilingSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error:  'VALIDATION_ERROR',
          issues: parseResult.error.issues,
        });
      }

      const { taxType, period, reason } = parseResult.data;
      const orgId   = (req as any).orgContext.orgId;
      const actorId = (req as any).user.id;
      const role    = (req as any).user.role;

      // Idempotency check: prevent duplicate filing for same (orgId, taxType, period)
      const existing = await (prisma as any).taxReturn?.findFirst({
        where: { orgId, taxType, period, isNil: true },
      }) ?? await (prisma as any).taxFiling?.findFirst({
        where: { orgId, taxType, period, isNil: true },
      });

      if (existing) {
        return reply.status(409).send({
          error:   'DUPLICATE_FILING',
          message: `NIL ${taxType} filing for ${period} already submitted.`,
          code:    409,
        });
      }

      // Penalty check (C-05: always compute penalty, show to client)
      const deadline   = getDeadlineForPeriod(taxType, period);
      const daysLate   = Math.max(0, Math.floor((Date.now() - deadline.getTime()) / 86_400_000));
      const penaltyInfo = calculatePenalty({
        entityType:      role === 'OWNER' ? 'company' : 'individual',
        daysLate,
        taxAmountDue:    0,
        disclosurePhase: 'after_assessment',
      });

      if (daysLate > 0) {
        log.warn({ orgId, taxType, period, daysLate, penalty: penaltyInfo.netPenalty }, 'Late NIL filing');
      }

      // Create the filing record
      const model = (prisma as any).taxReturn ?? (prisma as any).taxFiling;
      const filing = await model.create({
        data: {
          orgId,
          taxType,
          period,
          isNil:      true,
          nilReason:  reason,
          status:     'submitted',
          submittedAt: new Date(),
          submittedBy: actorId,
        },
      });

      // Mandatory audit (§8.3, C-25)
      await writeAuditEvent({
        orgId,
        actorId,
        actorRole:  role,
        targetType: 'TaxReturn',
        targetId:   filing.id,
        action:     'FILE' as any,
        after:      { taxType, period, isNil: true, nilReason: reason },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      log.info({ orgId, taxType, period, filingId: filing.id }, 'NIL return filed');

      return reply.status(201).send({
        success:       true,
        filingId:      filing.id,
        taxType,
        period,
        isNil:         true,
        submittedAt:   filing.submittedAt,
        penaltyInfo:   daysLate > 0 ? penaltyInfo : null,
        daysLate,
      });
    },
  );
}
