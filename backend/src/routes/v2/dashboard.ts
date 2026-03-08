/**
 * TaxBridge — API v2 Dashboard Route
 * GET /api/v2/dashboard
 *
 * Wraps the existing composite logic in the v2 ApiResponse envelope.
 * Adds deprecation header on v1 when accessed through v2-aware clients.
 *
 * Preserves full backward compatibility with v1.
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/requireRole';
import { buildDashboardCompositeResponse } from '../v1/dashboard';
import { successResponse, errorResponse } from '../../lib/api-envelope';

// ─── Route ───────────────────────────────────────────────────────────────────

export default async function v2DashboardRoute(fastify: FastifyInstance) {
  fastify.get('/api/v2/dashboard', {
    preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('VIEWER')],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const { userId } = request.user;

    try {
      const { response, meta } = await buildDashboardCompositeResponse(orgId, userId);
      return reply.send(successResponse(response, {
        fromCache: meta.cached,
        requestId: request.id,
      }));
    } catch (error) {
      request.log.error({ orgId, userId, error }, 'Failed to build v2 dashboard response');
      return reply.code(500).send(errorResponse('Failed to load dashboard', 'DASHBOARD_LOAD_FAILED', {
        requestId: request.id,
      }));
    }
  });
}
