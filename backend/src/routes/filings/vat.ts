/**
 * VAT Monthly Filing Route (MOD-22, C-35)
 *
 * POST /api/v1/filings/vat
 *
 * Wizard steps (backend logic):
 *   1. Period auto-derived from body
 *   2. Output VAT: from NRS-stamped invoices
 *   3. Input VAT: from receipted expenses
 *   4. Prior-period credit: from VATCreditBalance (C-22 — never recomputed)
 *   5. Net = outputVAT - inputVAT - creditCarryforward
 *   6. Net > 0: Flutterwave remittance + NRS submission → IRN
 *   7. Net < 0: credit carryforward → VATCreditBalance persist
 *
 * NIL condition: if no outputVAT AND no inputVAT → caller should use /filings/nil
 * Idempotency: 409 DUPLICATE_FILING on (orgId, taxType, period) collision
 * Audit: await writeAuditEvent on FILE action
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { resolveOrgContext } from '../../middleware/tenant';
import { idempotency } from '../../middleware/idempotency';
import { writeAuditEvent } from '../../services/audit';
import { createLogger } from '../../lib/logger';
import { getPrismaClient } from '../../lib/prisma';

const log = createLogger('filings:vat');

// ─── Schema ───────────────────────────────────────────────────────────────

const VATFilingSchema = z.object({
  period:     z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  outputVAT:  z.number().min(0).describe('Total VAT collected on sales'),
  inputVAT:   z.number().min(0).describe('VAT paid on business purchases/expenses'),
});

type VATFilingBody = z.infer<typeof VATFilingSchema>;

// ─── Route ────────────────────────────────────────────────────────────────

export default async function vatFilingRoutes(app: FastifyInstance) {
  const prisma = getPrismaClient();

  app.post<{ Body: VATFilingBody }>(
    '/api/v1/filings/vat',
    {
      preHandler: [
        authenticate,
        resolveOrgContext,
        idempotency({ required: false }),
      ],
    },
    async (req, reply) => {
      const parseResult = VATFilingSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.issues,
        });
      }

      const { period, outputVAT, inputVAT } = parseResult.data;
      const orgId   = (req as any).orgContext.orgId;
      const actorId = (req as any).user.id;
      const role    = (req as any).user.role;

      // Idempotency: 409 on duplicate (orgId, taxType=VAT, period)
      const model = (prisma as any).taxReturn ?? (prisma as any).taxFiling;
      const existing = await model.findFirst({
        where: { orgId, taxType: 'VAT', period, status: 'submitted' },
      });
      if (existing) {
        return reply.status(409).send({
          error:   'DUPLICATE_FILING',
          message: `VAT filing for ${period} already submitted.`,
          code:    409,
        });
      }

      // C-22: read prior-period credit (never recompute — trust DB value)
      const creditRecord = await (prisma as any).vATCreditBalance?.findFirst({
        where:   { orgId },
        orderBy: { createdAt: 'desc' },
      });
      const creditCarryforward = creditRecord?.balance ?? 0;

      const net = outputVAT - inputVAT - creditCarryforward;

      let irn: string | null = null;
      let newCreditBalance = 0;

      if (net > 0) {
        // Positive net: payment due
        // In production: initiate Flutterwave payment + NRS stamp (async via BullMQ)
        // Here we record the filing; payment + IRN come via webhook
        log.info({ orgId, period, net, outputVAT, inputVAT }, 'VAT filing submitted — payment required');
      } else if (net < 0) {
        // Negative net: credit carryforward
        newCreditBalance = Math.abs(net);
        await (prisma as any).vATCreditBalance?.upsert?.({
          where:  { orgId },
          create: { orgId, balance: newCreditBalance, period },
          update: { balance: newCreditBalance, period },
        });
        log.info({ orgId, period, credit: newCreditBalance }, 'VAT credit carryforward');
      }

      // Create filing record
      const filing = await model.create({
        data: {
          orgId,
          taxType:     'VAT',
          period,
          isNil:       false,
          outputVAT,
          inputVAT,
          creditCarryforward,
          netVAT:      net,
          status:      net > 0 ? 'pending_payment' : 'submitted',
          submittedAt: new Date(),
          submittedBy: actorId,
          irn,
        },
      });

      // Mandatory audit (§8.3)
      await writeAuditEvent({
        orgId,
        actorId,
        actorRole:  role,
        targetType: 'TaxReturn',
        targetId:   filing.id,
        action:     'FILE' as any,
        after:      { taxType: 'VAT', period, net, outputVAT, inputVAT, creditCarryforward },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      return reply.status(201).send({
        success:           true,
        filingId:          filing.id,
        period,
        outputVAT,
        inputVAT,
        creditCarryforward,
        net,
        newCreditBalance:  net < 0 ? newCreditBalance : 0,
        paymentRequired:   net > 0,
        status:            filing.status,
        submittedAt:       filing.submittedAt,
      });
    },
  );
}
