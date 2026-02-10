/**
 * Bulk Operations Routes (Phase 9)
 *
 * Endpoints:
 * POST /api/v1/bulk/status-update   — Bulk update entity statuses
 * POST /api/v1/bulk/delete          — Bulk delete/cancel entities
 * POST /api/v1/bulk/export          — Bulk export entities (CSV/JSON)
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

import { BulkOperationsService } from '../services/bulk-operations';
import { AuthenticationError, ValidationError } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('bulk-routes');

export default async function bulkRoutes(
  app: FastifyInstance,
  opts: { prisma: PrismaClient },
) {
  const prisma = opts.prisma;
  const bulkService = new BulkOperationsService(prisma);

  // =========================================================================
  // Auth helper
  // =========================================================================
  async function authenticate(req: any): Promise<string> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      return decoded.userId || decoded.sub || decoded.id;
    } catch {
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  // =========================================================================
  // Schemas
  // =========================================================================
  const EntityTypeSchema = z.enum(['invoice', 'expense', 'payment']);

  const BulkStatusUpdateSchema = z.object({
    entityType: EntityTypeSchema,
    ids: z.array(z.string().uuid()).min(1).max(100),
    status: z.string().min(1),
  });

  const BulkDeleteSchema = z.object({
    entityType: EntityTypeSchema,
    ids: z.array(z.string().uuid()).min(1).max(100),
  });

  const BulkExportSchema = z.object({
    entityType: EntityTypeSchema,
    format: z.enum(['csv', 'json']).default('csv'),
    filters: z.object({
      status: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
    }).optional(),
  });

  // =========================================================================
  // POST /api/v1/bulk/status-update
  // =========================================================================
  app.post('/api/v1/bulk/status-update', async (req, reply) => {
    const userId = await authenticate(req);
    const body = BulkStatusUpdateSchema.parse(req.body);

    const result = await bulkService.bulkStatusUpdate({
      ...body,
      businessId: userId,
    });

    return reply.send({ success: true, data: result });
  });

  // =========================================================================
  // POST /api/v1/bulk/delete
  // =========================================================================
  app.post('/api/v1/bulk/delete', async (req, reply) => {
    const userId = await authenticate(req);
    const body = BulkDeleteSchema.parse(req.body);

    const result = await bulkService.bulkDelete({
      ...body,
      businessId: userId,
    });

    return reply.send({ success: true, data: result });
  });

  // =========================================================================
  // POST /api/v1/bulk/export
  // =========================================================================
  app.post('/api/v1/bulk/export', async (req, reply) => {
    const userId = await authenticate(req);
    const body = BulkExportSchema.parse(req.body);

    const result = await bulkService.bulkExport({
      ...body,
      businessId: userId,
    });

    reply.header('Content-Type', result.mimeType);
    reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
    reply.header('X-Record-Count', result.recordCount.toString());

    return reply.send(result.data);
  });
}
