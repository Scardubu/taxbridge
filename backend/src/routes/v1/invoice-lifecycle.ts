import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  InvoiceDraftUpdateRequestSchema,
  InvoiceLifecycleVersionRequestSchema,
  InvoiceRejectRequestSchema,
} from '@taxbridge/contracts';
import {
  approveInvoice,
  getInvoiceLifecycle,
  InvoiceLifecycleError,
  rejectInvoice,
  submitInvoiceForApproval,
  updateInvoiceDraft,
} from '../../services/invoice-lifecycle';

const ParamsSchema = (await import('zod')).z.object({ id: (await import('zod')).z.string().uuid() });

function sendLifecycleError(error: unknown, reply: FastifyReply) {
  if (error instanceof InvoiceLifecycleError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
      retryable: false,
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || error.code === 'P2028')) {
    return reply.code(409).send({
      error: 'INVOICE_TRANSACTION_CONFLICT',
      message: 'The invoice changed during this request. Reload and retry using the current revision.',
      retryable: true,
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return reply.code(409).send({
      error: 'INVOICE_REVISION_CONFLICT',
      message: 'A competing revision was committed. Reload the invoice lifecycle.',
      retryable: true,
    });
  }
  requestLog(reply, error);
  return reply.code(500).send({
    error: 'INVOICE_LIFECYCLE_UNAVAILABLE',
    message: 'The invoice lifecycle request could not be completed.',
    retryable: true,
  });
}

function requestLog(reply: FastifyReply, error: unknown): void {
  reply.log.error({ err: error }, 'Invoice lifecycle request failed');
}

function parseId(request: FastifyRequest, reply: FastifyReply): string | null {
  const parsed = ParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    reply.code(400).send({ error: 'INVALID_INVOICE_ID', message: 'A valid invoice UUID is required.' });
    return null;
  }
  return parsed.data.id;
}

export default async function invoiceLifecycleRoutes(app: FastifyInstance): Promise<void> {
  const protectedRoute = { preHandler: [app.authenticate, app.resolveOrgContext] } as const;

  app.patch('/invoices/:id/draft', protectedRoute, async (request, reply) => {
    const invoiceId = parseId(request, reply);
    if (!invoiceId) return;
    const parsed = InvoiceDraftUpdateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
    }
    try {
      const result = await updateInvoiceDraft({
        invoiceId,
        organizationId: request.orgContext.orgId,
        actorUserId: request.user.userId,
        expectedVersion: parsed.data.expectedVersion,
        draft: parsed.data.draft,
      });
      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendLifecycleError(error, reply);
    }
  });

  app.post('/invoices/:id/submit-for-approval', protectedRoute, async (request, reply) => {
    const invoiceId = parseId(request, reply);
    if (!invoiceId) return;
    const parsed = InvoiceLifecycleVersionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
    }
    try {
      const result = await submitInvoiceForApproval({
        invoiceId,
        organizationId: request.orgContext.orgId,
        actorUserId: request.user.userId,
        expectedVersion: parsed.data.expectedVersion,
      });
      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendLifecycleError(error, reply);
    }
  });

  app.post('/invoices/:id/approve', protectedRoute, async (request, reply) => {
    const invoiceId = parseId(request, reply);
    if (!invoiceId) return;
    const parsed = InvoiceLifecycleVersionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
    }
    try {
      const result = await approveInvoice({
        invoiceId,
        organizationId: request.orgContext.orgId,
        actorUserId: request.user.userId,
        expectedVersion: parsed.data.expectedVersion,
      });
      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendLifecycleError(error, reply);
    }
  });

  app.post('/invoices/:id/reject', protectedRoute, async (request, reply) => {
    const invoiceId = parseId(request, reply);
    if (!invoiceId) return;
    const parsed = InvoiceRejectRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
    }
    try {
      const result = await rejectInvoice({
        invoiceId,
        organizationId: request.orgContext.orgId,
        actorUserId: request.user.userId,
        expectedVersion: parsed.data.expectedVersion,
        reason: parsed.data.reason,
      });
      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendLifecycleError(error, reply);
    }
  });

  app.get('/invoices/:id/lifecycle', protectedRoute, async (request, reply) => {
    const invoiceId = parseId(request, reply);
    if (!invoiceId) return;
    try {
      const result = await getInvoiceLifecycle({
        invoiceId,
        organizationId: request.orgContext.orgId,
        actorUserId: request.user.userId,
      });
      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendLifecycleError(error, reply);
    }
  });
}
