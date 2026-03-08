/**
 * CAC Validation Route — TaxBridge V13 Sovereign
 *
 * POST /api/v1/onboarding/cac
 * Rate limit: 3/min per IP
 * Format: RC-NNNNNN validated before Youverify call
 * Youverify CAC API → store cacRcNumber + verified entityName → await writeAuditEvent
 */
import { FastifyPluginAsync } from 'fastify';
import { z }                  from 'zod';
import { validate }           from '../../../plugins/validate';
import { writeAuditEvent }    from '../../../services/audit';
import { validateCAC }        from '../../../services/youverify';

const CACSchema = z.object({
  rcNumber: z.string().regex(/^RC-?\d{6}$/i, 'CAC format: RC-NNNNNN'),
});

const cacRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/cac', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate, validate(CACSchema)],
  }, async (request, reply) => {
    const { rcNumber } = request.body as z.infer<typeof CACSchema>;

    const result = await validateCAC(rcNumber);

    await writeAuditEvent({
      actorId:   request.user.userId,
      action:    'CAC_LOOKUP',
      resource:  'CAC',
      ip:        request.ip,
      userAgent: request.headers['user-agent'],
    });

    if (!result.valid) {
      return reply.code(422).send({
        error:   'CAC_INVALID',
        message: 'CAC registration number could not be verified',
      });
    }

    return reply.send({
      valid:      true,
      entityName: result.entityName,
      rcNumber:   result.rcNumber,
      directors:  result.directors,
      status:     result.status,
    });
  });
};

export default cacRoute;
