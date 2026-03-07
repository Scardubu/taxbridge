/**
 * Onboarding Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v1/onboarding'
 * Routes: POST /tin | POST /cac | PATCH /progress
 */
import { FastifyPluginAsync }  from 'fastify';
import { z }                   from 'zod';
import { prisma }              from '../../lib/prisma';
import { validate }            from '../../plugins/validate';
import { requireRole }         from '../../plugins/requireRole';
import { writeAuditEvent }     from '../../services/audit';
import { validateTIN, validateCAC } from '../../services/youverify';

const TINSchema = z.object({
  tin: z.string().regex(/^\d{8}$/, 'TIN must be exactly 8 digits'),
});

const CACSchema = z.object({
  rcNumber: z.string().regex(/^RC-?\d{6}$/i, 'CAC format: RC-NNNNNN'),
});

const ProgressSchema = z.object({
  step:      z.number().int().min(1).max(5),
  completed: z.boolean().optional(),
  data:      z.record(z.string(), z.unknown()).optional(),
});

const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /tin — Youverify TIN lookup
  fastify.post('/tin', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate, validate(TINSchema)],
  }, async (request, reply) => {
    const { tin } = request.body as z.infer<typeof TINSchema>;

    const result = await validateTIN(tin);

    await writeAuditEvent({
      actorId:  request.user.userId,
      action:   'TIN_LOOKUP',
      resource: 'TIN',
      ip:       request.ip,
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

  // POST /cac — Youverify CAC lookup
  fastify.post('/cac', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate, validate(CACSchema)],
  }, async (request, reply) => {
    const { rcNumber } = request.body as z.infer<typeof CACSchema>;

    const result = await validateCAC(rcNumber);

    await writeAuditEvent({
      actorId:  request.user.userId,
      action:   'CAC_LOOKUP',
      resource: 'CAC',
      ip:       request.ip,
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

  // PATCH /progress — upsert onboarding progress (idempotent)
  fastify.patch('/progress', {
    preHandler: [fastify.authenticate, validate(ProgressSchema)],
  }, async (request, reply) => {
    const { step, completed, data } = request.body as z.infer<typeof ProgressSchema>;
    const { userId } = request.user;

    await (prisma as any).onboardingProgress.upsert({
      where:  { userId },
      update: { step, completed: completed ?? false, data, updatedAt: new Date() },
      create: { userId, step, completed: completed ?? false, data },
    }).catch(() => null); // Non-fatal — best effort

    return reply.send({ step, completed: completed ?? false });
  });
};

export default onboardingRoutes;
