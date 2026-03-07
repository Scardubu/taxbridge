/**
 * WHT Remittance Filing Route (MOD-23, C-35)
 *
 * POST /api/v1/filings/wht
 *
 * Rate decision tree (NTA 2025 §78):
 *   10% — professional/consultancy/management/technical/dividends/interest/royalties/rent
 *    5% — construction/survey/contracts
 *   10% — non-resident (same rate, different NRS remittance channel — COMP-01)
 *
 * Exemption check (C-23): BOTH conditions must be met simultaneously:
 *   1. Recipient has a valid TIN
 *   2. Amount ≤ ₦2,000,000 (TWO_MILLION_THRESHOLD)
 *
 * Inline warning: professional_fee at 5% → warn "Professional fees are 10%"
 * Deadline: 21st of the following month
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { resolveOrgContext } from '../../middleware/tenant';
import { idempotency } from '../../middleware/idempotency';
import { writeAuditEvent } from '../../services/audit';
import { createLogger } from '../../lib/logger';
import { getPrismaClient } from '../../lib/prisma';

const log = createLogger('filings:wht');

// C-04 / C-10: All rates from packages/contracts/src/constants.ts — never inline
import { WHT_RATES, WHT_EXEMPTION_MONTHLY_THRESHOLD } from '@taxbridge/contracts/constants';

const CATEGORY_TO_RATE: Record<string, number> = {
  professional_fee:  WHT_RATES.professional,
  rent:              WHT_RATES.rent,
  dividend:          WHT_RATES.dividends,
  interest:          WHT_RATES.interest,
  royalty:           WHT_RATES.royalties,
  construction:      WHT_RATES.construction,
  contract:          WHT_RATES.contracts,
  commission:        WHT_RATES.professional,
  director_fee:      WHT_RATES.management,
};

const TWO_MILLION_THRESHOLD = WHT_EXEMPTION_MONTHLY_THRESHOLD;

// ─── Schema (C-34) ────────────────────────────────────────────────────────

const WHTFilingSchema = z.object({
  period:        z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  transactions:  z.array(z.object({
    recipientName: z.string().min(1),
    recipientTin:  z.string().optional(),
    amount:        z.number().positive(),
    category:      z.string(),
    rateOverride:  z.number().min(0).max(0.30).optional(),
  })).min(1),
});

type WHTFilingBody = z.infer<typeof WHTFilingSchema>;

// ─── Route ────────────────────────────────────────────────────────────────

export default async function whtFilingRoutes(app: FastifyInstance) {
  const prisma = getPrismaClient();

  app.post<{ Body: WHTFilingBody }>(
    '/api/v1/filings/wht',
    {
      preHandler: [
        authenticate,
        resolveOrgContext,
        idempotency({ required: false }),
      ],
    },
    async (req, reply) => {
      const parseResult = WHTFilingSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.issues,
        });
      }

      const { period, transactions } = parseResult.data;
      const orgId   = (req as any).orgContext.orgId;
      const actorId = (req as any).user.id;
      const role    = (req as any).user.role;

      // Idempotency check
      const model = (prisma as any).taxReturn ?? (prisma as any).taxFiling;
      const existing = await model.findFirst({
        where: { orgId, taxType: 'WHT', period, status: 'submitted' },
      });
      if (existing) {
        return reply.status(409).send({
          error: 'DUPLICATE_FILING',
          message: `WHT filing for ${period} already submitted.`,
          code: 409,
        });
      }

      // Process each transaction: rate decision tree + exemption check
      const warnings: string[] = [];
      const processedTransactions = transactions.map((txn) => {
        const rate = txn.rateOverride ?? (CATEGORY_TO_RATE[txn.category] ?? WHT_RATES.professional);

        // Warn if professional_fee charged at rate < 10%
        if (txn.category === 'professional_fee' && rate < 0.10) {
          warnings.push(`${txn.recipientName}: Professional fees should be 10%, not ${(rate * 100).toFixed(0)}%.`);
        }

        // C-23 exemption: BOTH tin AND amount ≤ ₦2M
        const isExempt = !!txn.recipientTin && txn.amount <= TWO_MILLION_THRESHOLD;

        const whtAmount = isExempt ? 0 : Math.round(txn.amount * rate);
        const netPayment = txn.amount - whtAmount;

        return {
          ...txn,
          rate,
          whtAmount,
          netPayment,
          isExempt,
        };
      });

      const totalWHT = processedTransactions.reduce((s, t) => s + t.whtAmount, 0);

      // Create filing
      const filing = await model.create({
        data: {
          orgId,
          taxType:       'WHT',
          period,
          isNil:         totalWHT === 0,
          totalWHT,
          status:        totalWHT > 0 ? 'pending_payment' : 'submitted',
          submittedAt:   new Date(),
          submittedBy:   actorId,
          metadata:      { transactions: processedTransactions, warnings },
        },
      });

      // Mandatory audit
      await writeAuditEvent({
        orgId,
        actorId,
        actorRole:  role,
        targetType: 'TaxReturn',
        targetId:   filing.id,
        action:     'FILE' as any,
        after:      { taxType: 'WHT', period, totalWHT, transactionCount: transactions.length },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      log.info({ orgId, period, totalWHT, filingId: filing.id }, 'WHT filing submitted');

      return reply.status(201).send({
        success:         true,
        filingId:        filing.id,
        period,
        totalWHT,
        paymentRequired: totalWHT > 0,
        transactions:    processedTransactions,
        warnings,
        deadline:        `21st of the month following ${period}`,
      });
    },
  );
}
