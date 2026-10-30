import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { computeRequestHash, isIdempotencyExpired } from '../lib/idempotency';

const EVENT_TYPES = [
  'onboarding_complete',
  'onboarding_preview_enter',
  'tin_verified',
  'tin_failed',
  'receipt_scanned',
  'receipt_submitted',
  'vat_registration_attempted',
  'einvoice_submitted',
  'invoice_submitted',
  'invoice_overdue',
  'tax_payment_initiated',
  'tax_payment_successful',
  'tax_payment_failed',
  'deadline_approaching',
  'deadline_missed',
  'admin_alert_received',
  'obligation_override',
  'vat_return_submitted',
] as const;

const ComplianceEventSchema = z.object({
  event_type: z.enum(EVENT_TYPES),
  business_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  client_timestamp: z.string().datetime().optional(),
  idempotency_key: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  source: z.literal('mobile').optional(),
}).strict();

type CachedEventResponse = { id: string; logged_at: string };

function isPrismaUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    'code' in error && (error as { code?: unknown }).code === 'P2002';
}

const complianceEventRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/v1/compliance-events', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    preHandler: [app.authenticate, app.resolveOrgContext],
  }, async (request, reply) => {
    const parsed = ComplianceEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Compliance event payload is invalid',
        issues: parsed.error.issues,
      });
    }

    const { event_type, business_id, metadata, client_timestamp, idempotency_key } = parsed.data;
    const userId = request.user.userId;
    const orgId = request.orgContext.orgId;

    if (Buffer.byteLength(JSON.stringify(metadata), 'utf8') > 4096) {
      return reply.code(413).send({ error: 'COMPLIANCE_METADATA_TOO_LARGE' });
    }

    if (business_id) {
      const business = await prisma.business.findFirst({
        where: { id: business_id, organizationId: orgId },
        select: { id: true },
      });
      if (!business) return reply.code(404).send({ error: 'BUSINESS_NOT_FOUND' });
    }

    const scopedKey = 'compliance-event:' + userId + ':' + idempotency_key;
    const requestHash = computeRequestHash({
      method: request.method,
      path: request.url,
      body: { userId, orgId, event_type, business_id, metadata, client_timestamp },
    });

    const cached = await prisma.idempotencyCache.findUnique({ where: { key: scopedKey } });
    if (cached && !isIdempotencyExpired(cached.createdAt)) {
      if (cached.requestHash !== requestHash) {
        return reply.code(409).send({ error: 'IDEMPOTENCY_KEY_REUSED' });
      }
      return reply.send(cached.responseBody as CachedEventResponse);
    }
    if (cached) {
      await prisma.idempotencyCache.deleteMany({
        where: { key: scopedKey, createdAt: cached.createdAt },
      });
    }

    try {
      const response = await prisma.$transaction(async (tx) => {
        const event = await tx.auditEvent.create({
          data: {
            orgId,
            userId,
            action: 'MOBILE_COMPLIANCE_EVENT',
            resource: 'ComplianceEvent',
            metadata: JSON.parse(JSON.stringify({
              ...metadata,
              eventType: event_type,
              businessId: business_id ?? null,
              clientTimestamp: client_timestamp ?? null,
              source: 'mobile',
            })) as Prisma.InputJsonValue,
            ipAddress: request.ip ?? null,
            userAgent: request.headers['user-agent'] ?? null,
          },
          select: { id: true, createdAt: true },
        });

        const body: CachedEventResponse = {
          id: event.id,
          logged_at: event.createdAt.toISOString(),
        };
        await tx.idempotencyCache.create({
          data: {
            key: scopedKey,
            requestHash,
            method: request.method,
            path: request.url,
            statusCode: 201,
            responseBody: body as Prisma.InputJsonValue,
          },
        });
        return body;
      });
      return reply.code(201).send(response);
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        const raced = await prisma.idempotencyCache.findUnique({ where: { key: scopedKey } });
        if (raced) {
          if (raced.requestHash !== requestHash) {
            return reply.code(409).send({ error: 'IDEMPOTENCY_KEY_REUSED' });
          }
          return reply.send(raced.responseBody as CachedEventResponse);
        }
      }
      request.log.error({ err: error }, 'Compliance event persistence failed');
      return reply.code(503).send({ error: 'COMPLIANCE_EVENT_PERSISTENCE_FAILED' });
    }
  });
};

export default complianceEventRoutes;
