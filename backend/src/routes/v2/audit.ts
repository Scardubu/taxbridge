/**
 * Audit Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v2'
 * GET  /audit        — cursor-paginated AuditEvent viewer (ADMIN+)
 * GET  /audit/export — NDJSON streaming export (ADMIN+)
 */
import { FastifyPluginAsync }   from 'fastify';
import { requireRole }          from '../../plugins/requireRole';
import { prisma }               from '../../lib/prisma';
import { writeAuditEvent }      from '../../services/audit';

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /audit — cursor-paginated audit log
  fastify.get('/audit', {
    preHandler: [fastify.authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const cursor = (request.query as any).cursor;
    const limit  = Math.min(parseInt((request.query as any).limit ?? '50', 10), 200);
    const orgId  = (request.query as any).orgId;

    const where: any = {};
    if (cursor) where.id = { gt: cursor };
    if (orgId)  where.orgId = orgId;

    const events = await (prisma as any).auditEvent.findMany({
      where,
      take:    limit + 1,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []);

    const hasNext  = events.length > limit;
    const items    = hasNext ? events.slice(0, limit) : events;
    const nextCursor = hasNext ? items[items.length - 1]?.id : null;

    return reply.send({
      data: items,
      meta: { hasNextPage: hasNext, nextCursor },
    });
  });

  // GET /audit/export — NDJSON streaming export
  fastify.get('/audit/export', {
    preHandler: [fastify.authenticate, requireRole('ADMIN')],
  }, async (request, reply) => {
    const orgId = (request.query as any).orgId;

    await writeAuditEvent({
      actorId:  request.user.userId,
      action:   'AUDIT_EXPORT',
      resource: 'AuditEvent',
      ip:       request.ip,
      details:  { orgId },
    });

    reply.raw.setHeader('Content-Type', 'application/x-ndjson');
    reply.raw.setHeader('Transfer-Encoding', 'chunked');

    const where: any = orgId ? { orgId } : {};

    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const batch: any[] = await (prisma as any).auditEvent.findMany({
        where:   cursor ? { ...where, id: { gt: cursor } } : where,
        take:    500,
        orderBy: { createdAt: 'asc' },
      }).catch(() => []);

      for (const event of batch) {
        reply.raw.write(JSON.stringify(event) + '\n');
      }

      hasMore = batch.length === 500;
      if (hasMore) cursor = batch[batch.length - 1].id;
    }

    reply.raw.end();
  });
};

export default auditRoutes;
