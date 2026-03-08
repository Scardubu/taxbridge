/**
 * Onboarding Progress Route — TaxBridge V13 Sovereign
 *
 * PATCH /api/v1/onboarding/progress
 * Upsert OnboardingProgress; resume from last step; idempotent on replay
 */
import { FastifyPluginAsync } from 'fastify';
import { z }                  from 'zod';
import { prisma }             from '../../../lib/prisma';
import { validate }           from '../../../plugins/validate';

const ProgressSchema = z.object({
  step:      z.number().int().min(1).max(5),
  completed: z.boolean().optional(),
  data:      z.record(z.string(), z.unknown()).optional(),
});

const progressRoute: FastifyPluginAsync = async (fastify) => {
  fastify.patch('/progress', {
    preHandler: [fastify.authenticate, validate(ProgressSchema)],
  }, async (request, reply) => {
    const { step, completed, data } = request.body as z.infer<typeof ProgressSchema>;
    const { userId } = request.user;

    await (prisma as any).onboardingProgress.upsert({
      where:  { userId },
      update: { step, completed: completed ?? false, data, updatedAt: new Date() },
      create: { userId, step, completed: completed ?? false, data },
    }).catch(() => null);

    return reply.send({ step, completed: completed ?? false });
  });
};

export default progressRoute;
