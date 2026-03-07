/**
 * DLQ Management Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v2'
 * GET  /dlq           — list failed jobs (ADMIN+)
 * POST /dlq/:id/retry — retry a specific job (require2FA if depth > 10)
 * POST /dlq/:id/resolve — mark a job resolved
 */
import { FastifyPluginAsync }   from 'fastify';
import { requireRole }          from '../../plugins/requireRole';
import { require2FA }           from '../../plugins/require2FA';
import { prisma }               from '../../lib/prisma';
import { writeAuditEvent }      from '../../services/audit';

const dlqRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /dlq — list DLQ jobs
  fastify.get('/dlq', {
    preHandler: [fastify.authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const cursor = (request.query as any).cursor;
    const limit  = Math.min(parseInt((request.query as any).limit ?? '20', 10), 100);

    const jobs = await (prisma as any).dLQJob?.findMany({
      where:   cursor ? { id: { gt: cursor } } : {},
      take:    limit + 1,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []) ?? [];

    const hasNext = jobs.length > limit;
    const items   = hasNext ? jobs.slice(0, limit) : jobs;

    return reply.send({
      data:    items,
      meta:    { hasNextPage: hasNext, nextCursor: hasNext ? items[items.length - 1]?.id : null },
    });
  });

  // POST /dlq/:id/retry
  fastify.post('/dlq/:id/retry', {
    preHandler: [fastify.authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const jobId = (request.params as any).id;

    // require2FA for bulk retry of > 10 jobs (here: single retry is unrestricted)
    const dlqDepth = await (prisma as any).dLQJob?.count({ where: { status: 'FAILED' } }).catch(() => 0) ?? 0;
    if (dlqDepth > 10) {
      await require2FA(request, reply);
      if (reply.sent) return;
    }

    const job = await (prisma as any).dLQJob?.update({
      where:  { id: jobId },
      update: { status: 'RETRYING', retryAt: new Date() },
    }).catch(() => null);

    if (!job) return reply.code(404).send({ error: 'JOB_NOT_FOUND' });

    await writeAuditEvent({
      actorId:  request.user.userId,
      actorRole: request.orgContext?.role,
      action:   'DLQ_RETRY',
      resource: 'DLQJob',
      resourceId: jobId,
      ip:       request.ip,
    });

    return reply.send({ status: 'queued' });
  });

  // POST /dlq/:id/resolve
  fastify.post('/dlq/:id/resolve', {
    preHandler: [fastify.authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const jobId = (request.params as any).id;

    const job = await (prisma as any).dLQJob?.update({
      where:  { id: jobId },
      update: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: request.user.userId },
    }).catch(() => null);

    if (!job) return reply.code(404).send({ error: 'JOB_NOT_FOUND' });

    await writeAuditEvent({
      actorId:  request.user.userId,
      actorRole: request.orgContext?.role,
      action:   'DLQ_RESOLVE',
      resource: 'DLQJob',
      resourceId: jobId,
      ip:       request.ip,
    });

    return reply.send({ status: 'resolved' });
  });
};

export default dlqRoutes;
