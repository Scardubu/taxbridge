/**
 * TaxBridge — API v2 Onboarding Route
 * GET  /api/v2/onboarding/progress
 * POST /api/v2/onboarding/step
 *
 * Tracks user onboarding state (P2 OnboardingProgress model).
 * Feature-flagged — graceful degradation if model doesn't exist yet.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, errorResponse } from '../../lib/api-envelope';
import { prisma } from '../../lib/prisma';

const STEPS_ORDER = ['welcome', 'profile', 'business', 'tin', 'first_invoice', 'complete'] as const;

// ─── Routes ──────────────────────────────────────────────────────────────────

export default async function v2OnboardingRoute(fastify: FastifyInstance) {

  // Get onboarding progress
  fastify.get('/api/v2/onboarding/progress', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;

    try {
      let progress = await (prisma as any).onboardingProgress.findUnique({
        where: { userId },
      });

      if (!progress) {
        // Auto-create initial progress record
        progress = await (prisma as any).onboardingProgress.create({
          data: {
            userId,
            step: 'welcome',
            completedSteps: [],
            skippedSteps: [],
          },
        });
      }

      return reply.send(successResponse({
        currentStep:    progress.step,
        completedSteps: progress.completedSteps,
        skippedSteps:   progress.skippedSteps,
        isComplete:     progress.step === 'complete',
        completedAt:    progress.completedAt?.toISOString() ?? null,
        stepsOrder:     STEPS_ORDER,
      }, { requestId: request.id }));
    } catch (error) {
      request.log.error({ userId, error }, 'Failed to get onboarding progress');
      // Graceful fallback — return default state (C-07)
      return reply.send(successResponse({
        currentStep:    'welcome',
        completedSteps: [],
        skippedSteps:   [],
        isComplete:     false,
        completedAt:    null,
        stepsOrder:     STEPS_ORDER,
      }, { requestId: request.id }));
    }
  });

  // Complete a step
  fastify.post('/api/v2/onboarding/step', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const body = request.body as { step: string; action?: 'complete' | 'skip' } | undefined;

    if (!body?.step) {
      return reply.code(400).send(errorResponse('Missing step field', 'VALIDATION_ERROR'));
    }

    const { step, action = 'complete' } = body;

    if (!STEPS_ORDER.includes(step as any)) {
      return reply.code(400).send(errorResponse(
        `Invalid step: ${step}. Must be one of: ${STEPS_ORDER.join(', ')}`,
        'INVALID_STEP',
      ));
    }

    try {
      const existing = await (prisma as any).onboardingProgress.findUnique({
        where: { userId },
      });

      const completedSteps = existing?.completedSteps ?? [];
      const skippedSteps   = existing?.skippedSteps ?? [];

      if (action === 'complete' && !completedSteps.includes(step)) {
        completedSteps.push(step);
      }
      if (action === 'skip' && !skippedSteps.includes(step)) {
        skippedSteps.push(step);
      }

      // Determine next step
      const currentIndex = STEPS_ORDER.indexOf(step as typeof STEPS_ORDER[number]);
      const nextStep = currentIndex < STEPS_ORDER.length - 1
        ? STEPS_ORDER[currentIndex + 1]
        : 'complete';

      const isComplete = nextStep === 'complete';

      const progress = await (prisma as any).onboardingProgress.upsert({
        where:  { userId },
        create: {
          userId,
          step: nextStep,
          completedSteps,
          skippedSteps,
          lastStepAt: new Date(),
          completedAt: isComplete ? new Date() : null,
        },
        update: {
          step: nextStep,
          completedSteps,
          skippedSteps,
          lastStepAt: new Date(),
          completedAt: isComplete ? new Date() : null,
        },
      });

      return reply.send(successResponse({
        currentStep:    progress.step,
        completedSteps: progress.completedSteps,
        skippedSteps:   progress.skippedSteps,
        isComplete,
        stepsOrder:     STEPS_ORDER,
      }, { requestId: request.id }));
    } catch (error) {
      request.log.error({ userId, step, error }, 'Failed to update onboarding step');
      return reply.code(500).send(errorResponse('Failed to update onboarding progress', 'UPDATE_FAILED'));
    }
  });
}
