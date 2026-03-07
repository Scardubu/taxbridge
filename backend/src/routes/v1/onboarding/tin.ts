/**
 * TIN Validation Route — TaxBridge V13 Sovereign
 *
 * POST /api/v1/onboarding/tin
 * Rate limit: 3/min per IP
 * 8-digit validation → Youverify TIN lookup → cross-reference NRS → await writeAuditEvent
 */
import { FastifyPluginAsync } from 'fastify';
import { z }                  from 'zod';
import { validate }           from '../../../plugins/validate';
import { writeAuditEvent }    from '../../../services/audit';
import { validateTIN }        from '../../../services/youverify';

const TINSchema = z.object({
  tin: z.string().regex(/^\d{8}$/, 'TIN must be exactly 8 digits'),
});

const tinRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/tin', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate, validate(TINSchema)],
  }, async (request, reply) => {
    const { tin } = request.body as z.infer<typeof TINSchema>;

    const result = await validateTIN(tin);

    await writeAuditEvent({
      actorId:   request.user.userId,
      action:    'TIN_LOOKUP',
      resource:  'TIN',
      ip:        request.ip,
      userAgent: request.headers['user-agent'],
    });

    if (!result.valid) {
      return reply.code(422).send({
        error:   'TIN_INVALID',
        message: 'TIN could not be verified',
      });
    }

    return reply.send({
      valid:            true,
      entityName:       result.entityName,
      entityType:       result.entityType,
      registrationDate: result.registrationDate,
    });
  });
};

export default tinRoute;
