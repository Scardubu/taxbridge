/**
 * Compliance Alerts Routes (Phase 6)
 *
 * Tax compliance reminder management endpoints.
 *
 * Endpoints:
 * POST   /api/v1/compliance/generate              — Generate reminders for next N months
 * GET    /api/v1/compliance/dashboard              — Get compliance dashboard
 * GET    /api/v1/compliance/reminders              — List reminders with filters
 * POST   /api/v1/compliance/reminders              — Create custom reminder
 * POST   /api/v1/compliance/reminders/:id/file     — Mark reminder as filed
 * POST   /api/v1/compliance/reminders/:id/dismiss  — Dismiss reminder
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

import { ComplianceService } from '../services/compliance';
import { AuthenticationError, NotFoundError } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('compliance-routes');

export default async function complianceRoutes(
  app: FastifyInstance,
  opts: { prisma: PrismaClient }
) {
  const prisma = opts.prisma;
  const complianceService = new ComplianceService(prisma);

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
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET not configured');
      const payload = jwt.verify(token, secret) as { sub?: string; userId?: string };
      const userId = payload.sub || payload.userId;
      if (!userId) throw new Error('Invalid token payload');
      return userId;
    } catch (err: any) {
      if (err instanceof AuthenticationError) throw err;
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  // =========================================================================
  // Validation Schemas
  // =========================================================================

  const GenerateSchema = z.object({
    businessId: z.string().uuid(),
    monthsAhead: z.number().int().min(1).max(12).optional(),
  });

  const CreateReminderSchema = z.object({
    businessId: z.string().uuid(),
    taxType: z.enum(['VAT', 'PAYE', 'CIT', 'WHT', 'PIT']),
    dueDate: z.string().refine(d => !isNaN(Date.parse(d)), 'Invalid date'),
    amount: z.number().min(0).optional(),
    description: z.string().max(500).optional(),
  });

  const FileReminderSchema = z.object({
    amount: z.number().min(0).optional(),
  });

  // =========================================================================
  // POST /api/v1/compliance/generate — Generate reminders
  // =========================================================================
  app.post('/api/v1/compliance/generate', async (req, reply) => {
    const userId = await authenticate(req);
    const body = GenerateSchema.parse(req.body);

    try {
      const result = await complianceService.generateReminders(
        userId,
        body.businessId,
        body.monthsAhead
      );
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', body.businessId);
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/compliance/dashboard — Get compliance dashboard
  // =========================================================================
  app.get('/api/v1/compliance/dashboard', async (req, reply) => {
    const userId = await authenticate(req);
    const query = req.query as Record<string, string>;

    const businessId = query.businessId;
    if (!businessId) {
      return reply.status(400).send({ success: false, error: 'businessId query parameter required' });
    }

    try {
      const dashboard = await complianceService.getDashboard(userId, businessId);
      return reply.send({ success: true, data: dashboard });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', businessId);
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/compliance/reminders — List reminders
  // =========================================================================
  app.get('/api/v1/compliance/reminders', async (req, reply) => {
    const userId = await authenticate(req);
    const query = req.query as Record<string, string>;

    const businessId = query.businessId;
    if (!businessId) {
      return reply.status(400).send({ success: false, error: 'businessId query parameter required' });
    }

    try {
      const result = await complianceService.listReminders(userId, businessId, {
        status: query.status,
        taxType: query.taxType,
        page: query.page ? parseInt(query.page) : undefined,
        limit: query.limit ? parseInt(query.limit) : undefined,
      });

      return reply.send({ success: true, data: result });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', businessId);
      throw err;
    }
  });

  // =========================================================================
  // POST /api/v1/compliance/reminders — Create custom reminder
  // =========================================================================
  app.post('/api/v1/compliance/reminders', async (req, reply) => {
    const userId = await authenticate(req);
    const body = CreateReminderSchema.parse(req.body);

    try {
      const reminder = await complianceService.createReminder(userId, body);
      return reply.status(201).send({
        success: true,
        data: {
          reminder: {
            id: reminder.id,
            taxType: reminder.taxType,
            dueDate: reminder.dueDate.toISOString(),
            status: reminder.status,
            priority: reminder.priority,
            description: reminder.description,
            amount: reminder.amount ? Number(reminder.amount) : null,
          },
        },
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', body.businessId);
      throw err;
    }
  });

  // =========================================================================
  // POST /api/v1/compliance/reminders/:id/file — Mark as filed
  // =========================================================================
  app.post('/api/v1/compliance/reminders/:id/file', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };
    const body = req.body ? FileReminderSchema.parse(req.body) : {};

    try {
      const reminder = await complianceService.markFiled(userId, id, body.amount);
      return reply.send({
        success: true,
        data: {
          reminder: {
            id: reminder.id,
            taxType: reminder.taxType,
            status: reminder.status,
            filedAt: reminder.filedAt?.toISOString() || null,
          },
        },
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Reminder', id);
      if (err.message?.includes('Already filed') || err.message?.includes('dismissed')) {
        return reply.status(400).send({ success: false, error: err.message });
      }
      throw err;
    }
  });

  // =========================================================================
  // POST /api/v1/compliance/reminders/:id/dismiss — Dismiss reminder
  // =========================================================================
  app.post('/api/v1/compliance/reminders/:id/dismiss', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };

    try {
      const reminder = await complianceService.dismiss(userId, id);
      return reply.send({
        success: true,
        data: {
          reminder: {
            id: reminder.id,
            taxType: reminder.taxType,
            status: reminder.status,
          },
        },
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Reminder', id);
      if (err.message?.includes('Cannot dismiss')) {
        return reply.status(400).send({ success: false, error: err.message });
      }
      throw err;
    }
  });
}
