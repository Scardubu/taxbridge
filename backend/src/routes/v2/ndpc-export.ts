/**
 * TaxBridge — NDPC Data Export (P9)
 *
 * Admin-only endpoint for NDPC-compliant user data export.
 * Requires 'ndpc:export' resource access (admin role only).
 *
 * Routes:
 *   GET /api/v2/privacy/ndpc-export/:userId — Full NDPC data export
 *
 * Compliance:
 *   - NDPC/NDPR: Right of access, data portability
 *   - Audit-logged via AuditLog model
 *   - C-08: No Math.random()
 *   - C-07: Graceful degradation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, errorResponse } from '../../lib/api-envelope';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../plugins/requireRole';

// ─── Route ───────────────────────────────────────────────────────────────────

export default async function v2NdpcExportRoute(fastify: FastifyInstance) {

  fastify.get('/api/v2/privacy/ndpc-export/:userId', {
    preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const adminId = request.user.userId;
    const { userId } = request.params as { userId: string };

    // RBAC enforcement is handled by the rbac-plugin (ndpc:export → admin only)
    // This is a defense-in-depth check
    try {
      const adminUser = await (prisma as any).user.findUnique({
        where: { id: adminId },
        select: { role: true },
      });
      if (adminUser?.role !== 'admin') {
        return reply.code(403).send(errorResponse('Admin access required for NDPC export', 'FORBIDDEN'));
      }
    } catch (err) {
      request.log.error({ adminId, error: err }, 'Failed to verify admin role for NDPC export');
      return reply.code(403).send(errorResponse('Access verification failed', 'FORBIDDEN'));
    }

    try {
      // Fetch comprehensive user data
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        include: {
          businesses: {
            include: {
              invoices: { take: 500, orderBy: { createdAt: 'desc' } },
              expenses: { take: 500, orderBy: { createdAt: 'desc' } },
              employees: true,
            },
          },
          auditLogs: { take: 200, orderBy: { createdAt: 'desc' } },
          consents: true,
          devices: true,
        },
      });

      if (!user) {
        return reply.code(404).send(errorResponse('User not found', 'NOT_FOUND'));
      }

      // Scrub sensitive fields before export (passwordHash, mfaSecret, etc.)
      const scrubbed = {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        tin: user.tin ? '****' + user.tin.slice(-4) : null,
        nin: user.nin ? '****' + user.nin.slice(-4) : null,
        role: user.role,
        verified: user.verified,
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      // Build NDPC-compliant export
      const ndpcExport = {
        exportMetadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: adminId,
          regulation: 'NDPC/NDPR',
          format: 'JSON',
          version: '1.0',
        },
        personalData: scrubbed,
        businesses: (user.businesses || []).map((biz: any) => ({
          id: biz.id,
          name: biz.name,
          businessType: biz.businessType,
          status: biz.status,
          createdAt: biz.createdAt,
          invoiceCount: biz.invoices?.length ?? 0,
          expenseCount: biz.expenses?.length ?? 0,
          employeeCount: biz.employees?.length ?? 0,
        })),
        consents: (user.consents || []).map((c: any) => ({
          type: c.consentType,
          granted: c.granted,
          grantedAt: c.grantedAt,
          revokedAt: c.revokedAt,
        })),
        registeredDevices: (user.devices || []).map((d: any) => ({
          id: d.id,
          deviceName: d.deviceName,
          lastSyncAt: d.lastSyncAt,
          isActive: d.isActive,
        })),
        auditTrail: {
          totalEntries: user.auditLogs?.length ?? 0,
          recentActions: (user.auditLogs || []).slice(0, 50).map((al: any) => ({
            action: al.action,
            createdAt: al.createdAt,
          })),
        },
      };

      // Create audit log for this NDPC export
      try {
        await (prisma as any).auditLog.create({
          data: {
            userId: adminId,
            action: 'NDPC_DATA_EXPORT',
            details: {
              targetUserId: userId,
              exportedAt: new Date().toISOString(),
            },
          },
        });
      } catch {
        // Audit log failure should not block export
      }

      request.log.info({ adminId, targetUserId: userId }, 'NDPC data export completed');

      return reply.send(successResponse(ndpcExport, { requestId: request.id }));
    } catch (error) {
      request.log.error({ adminId, userId, error }, 'NDPC export failed');
      return reply.code(500).send(errorResponse('Export failed', 'EXPORT_FAILED'));
    }
  });
}
