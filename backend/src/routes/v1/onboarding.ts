/**
 * Onboarding Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v1/onboarding'
 * Registers sub-plugins: tin.ts | cac.ts | progress.ts
 */
import { FastifyPluginAsync } from 'fastify';
import tinRoute       from './onboarding/tin';
import cacRoute       from './onboarding/cac';
import progressRoute  from './onboarding/progress';

const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(tinRoute);
  await fastify.register(cacRoute);
  await fastify.register(progressRoute);
};

export default onboardingRoutes;
