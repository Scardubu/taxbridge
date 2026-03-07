/**
 * Compliance Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v1/compliance'
 */
import { FastifyPluginAsync }  from 'fastify';
import { requireRole }         from '../../plugins/requireRole';
import { runPreFlight }        from '../../services/compliancePreFlight';
import { calculatePenalty }    from '@taxbridge/contracts';
import { validate }            from '../../plugins/validate';
import { z }                   from 'zod';
import { vatCreditService }    from '../../services/vatCredit.service';

const PenaltySchema = z.object({
  entityType:       z.enum(['individual', 'company']),
  daysLate:         z.number().int().nonnegative(),
  taxAmountDue:     z.number().nonnegative(),
  disclosurePhase:  z.enum(['before_audit', 'during_audit', 'after_assessment']),
  taxType:          z.enum(['VAT', 'PIT', 'CIT', 'WHT', 'PAYE']).optional(),
});

const complianceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /preflight?taxType=VAT — C-07: never throws; always returns 200
  fastify.get('/preflight', {
    preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('VIEWER')],
  }, async (request, reply) => {
    const { orgId }  = request.orgContext;
    const taxType    = (request.query as any).taxType ?? 'VAT';
    const result     = await runPreFlight(orgId, taxType);
    return reply.send(result);
  });

  // POST /penalty-estimate
  fastify.post('/penalty-estimate', {
    preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('VIEWER'), validate(PenaltySchema)],
  }, async (request, reply) => {
    const input  = request.body as z.infer<typeof PenaltySchema>;
    const result = calculatePenalty(input as any);
    return reply.send(result);
  });

  // GET /vat-credit
  fastify.get('/vat-credit', {
    preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('VIEWER')],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const balance   = await vatCreditService.getBalance(orgId);
    return reply.send({ balance, orgId });
  });
};

export default complianceRoutes;
