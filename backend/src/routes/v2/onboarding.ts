/**
 * TaxBridge — API v2 Onboarding Route
 * GET  /api/v2/onboarding/progress
 * POST /api/v2/onboarding/step
 *
 * Tracks user onboarding state (P2 OnboardingProgress model).
 * Feature-flagged — graceful degradation if model doesn't exist yet.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse } from '../../lib/api-envelope';
import { getPrismaClient } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';

const log = createLogger('v2-onboarding');
const prisma = getPrismaClient();

const STEPS_ORDER = ['welcome', 'profile', 'business', 'tin', 'first_invoice', 'complete'] as const;

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = typeof req.headers?.authorization === 'string'
    ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    return reply.code(401).send(errorResponse('Unauthorized', 'AUTH_REQUIRED'));
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secrets = [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS].filter(Boolean) as string[];
  let userId: string | undefined;
  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret) as { userId?: string };
      if (decoded?.userId) { userId = decoded.userId; break; }
    } catch { /* try next */ }
  }
  if (!userId) return reply.code(401).send(errorResponse('Invalid or expired token', 'AUTH_INVALID'));
  (req as any).user = { id: userId };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export default async function v2OnboardingRoute(fastify: FastifyInstance) {

  // Get onboarding progress
  fastify.get('/api/v2/onboarding/progress', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id as string;

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
      log.error('Failed to get onboarding progress', { userId, error });
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
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id as string;
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
      log.error('Failed to update onboarding step', { userId, step, error });
      return reply.code(500).send(errorResponse('Failed to update onboarding progress', 'UPDATE_FAILED'));
    }
  });
}
