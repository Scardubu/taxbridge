import { createHash } from 'node:crypto';
import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { OperationEnvelopeSchema } from '@taxbridge/contracts';
import { prisma } from '../lib/prisma';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const routes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { operationId: string } }>('/api/v1/sync/operations/:operationId', {
    preHandler: [app.authenticate, app.resolveOrgContext],
  }, async (request, reply) => {
    const operationId = request.params.operationId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
      return reply.code(400).send({ error: 'INVALID_OPERATION_ID', code: 'INVALID_OPERATION_ID' });
    }
    const operation = await prisma.syncOperation.findFirst({
      where: { operationId, organizationId: request.orgContext.orgId, userId: request.user.userId },
      select: { operationId: true, status: true, acknowledgedAt: true, nextAttemptAt: true, lastErrorCode: true },
    });
    if (!operation) return reply.code(404).send({ error: 'OPERATION_NOT_FOUND', code: 'OPERATION_NOT_FOUND' });
    return reply.send({
      operationId: operation.operationId,
      status: operation.status,
      acknowledgedAt: operation.acknowledgedAt?.toISOString() ?? null,
      retryAt: operation.nextAttemptAt?.toISOString() ?? null,
      errorCode: operation.lastErrorCode,
    });
  });

  app.post('/api/v1/sync/operations', {
    preHandler: [app.authenticate, app.resolveOrgContext],
  }, async (request, reply) => {
    const parsed = OperationEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Operation payload is invalid',
        code: 'VALIDATION_ERROR',
        requestId: request.id,
        retryable: false,
      });
    }

    const input = parsed.data;
    // Persist first. The operation worker records an explicit dead-letter state
    // when no approved handler is registered; clients can observe that outcome.
    const { orgId } = request.orgContext;
    const fingerprint = createHash('sha256')
      .update(canonical({ operationType: input.operationType, schemaVersion: input.schemaVersion, payload: input.payload }))
      .digest('hex');
    const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.syncOperation.findUnique({
          where: {
            organizationId_operationType_idempotencyKey: {
              organizationId: orgId,
              operationType: input.operationType,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.userId !== request.user.userId) return { forbidden: true as const };
          if (existing.payloadFingerprint !== fingerprint) {
            return { conflict: true as const };
          }
          return { operation: existing, created: false as const };
        }

        const operation = await tx.syncOperation.create({
          data: {
            organizationId: orgId,
            userId: request.user.userId,
            operationId: input.operationId,
            operationType: input.operationType,
            schemaVersion: input.schemaVersion,
            idempotencyKey: input.idempotencyKey,
            payloadFingerprint: fingerprint,
            payload: input.payload as Prisma.InputJsonValue,
            status: 'pending',
            deadlineAt,
          },
        });
        await tx.operationOutbox.create({
          data: {
            operationId: operation.operationId,
            topic: `taxbridge.operation.${input.operationType}`,
            payload: { operationId: operation.operationId } as Prisma.InputJsonValue,
          },
        });
        return { operation, created: true as const };
      });

      if ('forbidden' in result) {
        return reply.code(403).send({
          error: 'OPERATION_ACCESS_DENIED',
          message: 'Operation belongs to another user',
          code: 'OPERATION_ACCESS_DENIED',
          requestId: request.id,
          retryable: false,
        });
      }

      if ('conflict' in result) {
        return reply.code(409).send({
          error: 'IDEMPOTENCY_KEY_REUSED',
          message: 'The idempotency key was previously used with a different payload',
          code: 'IDEMPOTENCY_KEY_REUSED',
          requestId: request.id,
          retryable: false,
        });
      }

      return reply.code(result.created ? 202 : 200).send({
        operationId: result.operation.operationId,
        status: result.operation.status,
        acknowledgedAt: result.operation.acknowledgedAt?.toISOString() ?? null,
        retryAt: result.operation.nextAttemptAt?.toISOString() ?? null,
        errorCode: result.operation.lastErrorCode,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // A concurrent request may win the unique-key race. Re-read and apply
        // the same fingerprint rule instead of creating a duplicate effect.
        const existing = await prisma.syncOperation.findUnique({
          where: {
            organizationId_operationType_idempotencyKey: {
              organizationId: orgId,
              operationType: input.operationType,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing && existing.userId === request.user.userId && existing.payloadFingerprint === fingerprint) {
          return reply.code(200).send({
            operationId: existing.operationId,
            status: existing.status,
            acknowledgedAt: existing.acknowledgedAt?.toISOString() ?? null,
            retryAt: existing.nextAttemptAt?.toISOString() ?? null,
            errorCode: existing.lastErrorCode,
          });
        }
        return reply.code(409).send({
          error: 'IDEMPOTENCY_KEY_REUSED',
          message: 'The idempotency key conflicts with another operation',
          code: 'IDEMPOTENCY_KEY_REUSED',
          requestId: request.id,
          retryable: false,
        });
      }
      request.log.error({ err: error }, 'Failed to persist sync operation');
      return reply.code(503).send({
        error: 'OPERATION_PERSISTENCE_UNAVAILABLE',
        message: 'Operation was not accepted; retry with the same idempotency key',
        code: 'OPERATION_PERSISTENCE_UNAVAILABLE',
        requestId: request.id,
        retryable: true,
      });
    }
  });
};

export default routes;
