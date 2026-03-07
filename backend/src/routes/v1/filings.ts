/**
 * Filing Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v1/filings'
 * Registers sub-plugins for each tax type.
 */
import { FastifyPluginAsync }    from 'fastify';
import { z }                     from 'zod';
import { createId }              from '@paralleldrive/cuid2';
import { prisma }                from '../../lib/prisma';
import { validate }              from '../../plugins/validate';
import { idempotency }           from '../../plugins/idempotency';
import { requireRole }           from '../../plugins/requireRole';
import { writeAuditEvent }       from '../../services/audit';
import {
  calculateVAT,
  calculateWHT,
  calculatePIT,
  calculateCIT,
} from '@taxbridge/contracts';
import { vatCreditService }      from '../../services/vatCredit.service';
import { runPreFlight }          from '../../services/compliancePreFlight';

// ─── NIL Return Schema ───────────────────────────────────────────────────────
const NilSchema = z.object({
  taxType:   z.enum(['VAT', 'WHT', 'PAYE', 'CIT']),
  period:    z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  nilReason: z.enum([
    'NO_REVENUE_THIS_PERIOD',
    'BUSINESS_INACTIVE',
    'EXEMPT_SUPPLY_ONLY',
    'BELOW_REGISTRATION_THRESHOLD',
  ]),
});

// ─── VAT Schema ──────────────────────────────────────────────────────────────
const VATSchema = z.object({
  period:    z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  outputVAT: z.number().nonnegative(),
  inputVAT:  z.number().nonnegative(),
});

// ─── WHT Schema ──────────────────────────────────────────────────────────────
const WHTSchema = z.object({
  period:       z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amount:       z.number().positive(),
  category:     z.enum(['professional', 'consultancy', 'management', 'technical', 'dividends', 'interest', 'royalties', 'rent', 'commission', 'construction', 'survey', 'contracts', 'nonResident']),
  counterpartyTin: z.string().optional(),
  monthlyTotal: z.number().nonnegative().optional(),
});

// ─── PAYE Schema ─────────────────────────────────────────────────────────────
const PAYESchema = z.object({
  period:    z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  employees: z.array(z.object({
    employeeId:  z.string(),
    grossIncome: z.number().nonnegative(),
    rentPaid:    z.number().nonnegative().optional(),
    pension:     z.number().nonnegative().optional(),
  })),
});

// ─── CIT Schema ──────────────────────────────────────────────────────────────
const CITSchema = z.object({
  period:        z.string().regex(/^\d{4}$/),
  turnover:      z.number().nonnegative(),
  taxableProfit: z.number(),
});

const filingsRoutes: FastifyPluginAsync = async (fastify) => {
  // ── NIL Return ──────────────────────────────────────────────────────────────
  fastify.post('/nil', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preHandler: [
      fastify.authenticate,
      fastify.resolveOrgContext,
      requireRole('ACCOUNTANT'),
      validate(NilSchema),
      idempotency,
    ],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const { taxType, period, nilReason } = request.body as z.infer<typeof NilSchema>;

    const existing = await (prisma as any).taxReturn.findUnique({
      where: { orgId_taxType_period: { orgId, taxType, period } },
    });
    if (existing) {
      return reply.code(409).send({ error: 'DUPLICATE_FILING', message: 'Filing already submitted for this period' });
    }

    const dueDate = getTaxDueDate(taxType, period);
    const penaltyWarning = new Date() > dueDate;

    const filing = await (prisma as any).taxReturn.create({
      data: {
        orgId, taxType, period, isNil: true, nilReason,
        status:           'SUBMITTED',
        filingReference:  `NIL-${taxType}-${period}-${createId()}`,
        submittedAt:      new Date(),
      },
    });

    await writeAuditEvent({
      orgId, actorId: request.user.userId, actorRole: request.orgContext.role,
      targetType: 'TaxReturn', targetId: filing.id, action: 'FILE',
      ip: request.ip, userAgent: request.headers['user-agent'],
    });

    request.log.info({ filingId: filing.id, orgId, taxType, period }, 'NIL filing submitted');
    return reply.send({
      filingReference: filing.filingReference,
      period, taxType,
      ...(penaltyWarning ? { warning: 'LATE_FILING_PENALTY_MAY_APPLY' } : {}),
    });
  });

  // ── VAT ─────────────────────────────────────────────────────────────────────
  fastify.post('/vat', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [
      fastify.authenticate,
      fastify.resolveOrgContext,
      requireRole('ACCOUNTANT'),
      validate(VATSchema),
      idempotency,
    ],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const { period, outputVAT, inputVAT } = request.body as z.infer<typeof VATSchema>;

    const creditBalance  = await vatCreditService.getBalance(orgId);
    const vatResult      = calculateVAT({ outputVAT, inputVAT, creditBalance });

    const filing = await (prisma as any).taxReturn.create({
      data: {
        orgId, taxType: 'VAT', period, isNil: false,
        status:          'SUBMITTED',
        filingReference: `VAT-${period}-${createId()}`,
        amount:          vatResult.netPayable,
        submittedAt:     new Date(),
        metadata:        { outputVAT, inputVAT, creditApplied: vatResult.creditApplied, creditCarryover: vatResult.creditCarryover },
      },
    });

    if (vatResult.creditCarryover > 0) {
      await vatCreditService.setBalance(orgId, vatResult.creditCarryover);
    } else {
      await vatCreditService.setBalance(orgId, 0);
    }

    await writeAuditEvent({
      orgId, actorId: request.user.userId, actorRole: request.orgContext.role,
      targetType: 'TaxReturn', targetId: filing.id, action: 'FILE',
      ip: request.ip, userAgent: request.headers['user-agent'],
    });

    return reply.send({
      filingReference: filing.filingReference,
      period,
      taxType: 'VAT',
      netPayable:      vatResult.netPayable,
      creditCarryover: vatResult.creditCarryover,
    });
  });

  // ── WHT ─────────────────────────────────────────────────────────────────────
  fastify.post('/wht', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [
      fastify.authenticate,
      fastify.resolveOrgContext,
      requireRole('ACCOUNTANT'),
      validate(WHTSchema),
      idempotency,
    ],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const { period, amount, category, counterpartyTin, monthlyTotal } = request.body as z.infer<typeof WHTSchema>;

    const whtResult = calculateWHT({
      amount,
      category: category as any,
      hasTIN:       !!counterpartyTin,
      monthlyTotal: monthlyTotal ?? Infinity,
    });

    const filing = await (prisma as any).taxReturn.create({
      data: {
        orgId, taxType: 'WHT', period, isNil: false,
        status:          'SUBMITTED',
        filingReference: `WHT-${period}-${createId()}`,
        amount:          whtResult.whtAmount,
        submittedAt:     new Date(),
        metadata:        { category, rate: whtResult.rate, exempt: whtResult.exempt },
      },
    });

    await writeAuditEvent({
      orgId, actorId: request.user.userId, actorRole: request.orgContext.role,
      targetType: 'TaxReturn', targetId: filing.id, action: 'FILE',
      ip: request.ip, userAgent: request.headers['user-agent'],
    });

    return reply.send({
      filingReference: filing.filingReference,
      period, taxType: 'WHT',
      whtAmount:  whtResult.whtAmount,
      rate:       whtResult.rate,
      exempt:     whtResult.exempt,
    });
  });

  // ── PAYE ────────────────────────────────────────────────────────────────────
  fastify.post('/paye', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [
      fastify.authenticate,
      fastify.resolveOrgContext,
      requireRole('ACCOUNTANT'),
      validate(PAYESchema),
      idempotency,
    ],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const { period, employees } = request.body as z.infer<typeof PAYESchema>;

    const breakdown = employees.map(emp => {
      const pit = calculatePIT({
        grossIncome: emp.grossIncome,
        rentPaid:    emp.rentPaid ?? 0,
        pension:     emp.pension,
      });
      return { employeeId: emp.employeeId, grossIncome: emp.grossIncome, taxLiability: pit.taxLiability };
    });

    const totalTax = breakdown.reduce((sum, e) => sum + e.taxLiability, 0);

    const filing = await (prisma as any).taxReturn.create({
      data: {
        orgId, taxType: 'PAYE', period, isNil: false,
        status:          'SUBMITTED',
        filingReference: `PAYE-${period}-${createId()}`,
        amount:          totalTax,
        submittedAt:     new Date(),
        metadata:        { employeeCount: employees.length, breakdown },
      },
    });

    await writeAuditEvent({
      orgId, actorId: request.user.userId, actorRole: request.orgContext.role,
      targetType: 'TaxReturn', targetId: filing.id, action: 'FILE',
      ip: request.ip, userAgent: request.headers['user-agent'],
    });

    return reply.send({
      filingReference: filing.filingReference,
      period, taxType: 'PAYE',
      totalTax,
      employeeCount: employees.length,
    });
  });

  // ── CIT ─────────────────────────────────────────────────────────────────────
  fastify.post('/cit', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [
      fastify.authenticate,
      fastify.resolveOrgContext,
      requireRole('ACCOUNTANT'),
      validate(CITSchema),
      idempotency,
    ],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const { period, turnover, taxableProfit } = request.body as z.infer<typeof CITSchema>;

    // C-41: calculateCIT() only — no inline math
    const citResult = calculateCIT({ turnover, taxableProfit });

    const filing = await (prisma as any).taxReturn.create({
      data: {
        orgId, taxType: 'CIT', period, isNil: false,
        status:          'SUBMITTED',
        filingReference: `CIT-${period}-${createId()}`,
        amount:          citResult.citLiability,
        submittedAt:     new Date(),
        metadata:        { turnover, taxableProfit, band: citResult.band, rate: citResult.rate },
      },
    });

    await writeAuditEvent({
      orgId, actorId: request.user.userId, actorRole: request.orgContext.role,
      targetType: 'TaxReturn', targetId: filing.id, action: 'FILE',
      ip: request.ip, userAgent: request.headers['user-agent'],
    });

    return reply.send({
      filingReference: filing.filingReference,
      period, taxType: 'CIT',
      citLiability: citResult.citLiability,
      band:         citResult.band,
    });
  });

  // ── Preflight ───────────────────────────────────────────────────────────────
  fastify.get('/preflight', {
    preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('VIEWER')],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const taxType = (request.query as any).taxType ?? 'VAT';

    // C-07: runPreFlight never throws — always returns PreFlightResult
    const result = await runPreFlight(orgId, taxType);
    return reply.send(result);
  });
};

function getTaxDueDate(taxType: string, period: string): Date {
  const [year, month] = period.split('-').map(Number);
  const due = new Date(year, month, taxType === 'PAYE' ? 10 : 21);
  return due;
}

export default filingsRoutes;
