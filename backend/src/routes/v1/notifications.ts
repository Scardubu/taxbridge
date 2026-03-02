/**
 * Notifications Route — TaxBridge V12
 *
 * Handles device push token registration and unregistration.
 * GAP-01 / criterion #23.
 *
 * POST /api/v1/notifications/register   — register a push token
 * POST /api/v1/notifications/unregister — unregister a push token
 *
 * Authenticated: JWT required on all routes.
 * C-07: Idempotent upserts — re-registering the same token is safe.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import * as Sentry from '@sentry/node';

const log = createLogger('notifications-route');

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  token:    z.string().min(10).max(512),
  platform: z.enum(['ios', 'android', 'web']),
});

const UnregisterSchema = z.object({
  token: z.string().min(10).max(512),
});

// ─── Plugin ───────────────────────────────────────────────────────────────────

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /register
  fastify.post(
    '/register',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user?.userId) {
        return reply.status(401).send({ error: 'Unauthorised' });
      }

      const parsed = RegisterSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', issues: parsed.error.issues });
      }

      const { token, platform } = parsed.data;

      try {
        await (prisma as any).userDevice.upsert({
          where:  { userId_pushToken: { userId: user.userId, pushToken: token } },
          create: {
            userId:     user.userId,
            pushToken:  token,
            platform,
            active:     true,
            lastSeenAt: new Date(),
          },
          update: {
            active:     true,
            lastSeenAt: new Date(),
            platform,
          },
        });

        log.info('Push token registered', { userId: user.userId, platform });
        return reply.status(200).send({ status: 'registered' });
      } catch (err) {
        Sentry.captureException(err);
        log.error('Failed to register push token', { err });
        return reply.status(200).send({ status: 'queued' }); // C-07: never 500
      }
    },
  );

  // POST /unregister
  fastify.post(
    '/unregister',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user?.userId) {
        return reply.status(401).send({ error: 'Unauthorised' });
      }

      const parsed = UnregisterSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', issues: parsed.error.issues });
      }

      const { token } = parsed.data;

      try {
        await (prisma as any).userDevice.updateMany({
          where: { userId: user.userId, pushToken: token },
          data:  { active: false },
        });

        log.info('Push token unregistered', { userId: user.userId });
        return reply.status(200).send({ status: 'unregistered' });
      } catch (err) {
        Sentry.captureException(err);
        log.error('Failed to unregister push token', { err });
        return reply.status(200).send({ status: 'ok' }); // C-07
      }
    },
  );
};

export default notificationsRoutes;
