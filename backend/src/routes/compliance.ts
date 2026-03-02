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
import { runCompliancePreFlight } from '../services/compliancePreFlight';
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

  // =========================================================================
  // Module 8 — Smart Compliance Calendar endpoints
  // =========================================================================

  // GET /api/v1/compliance/deadlines — NTA 2025 canonical deadline reference
  app.get('/api/v1/compliance/deadlines', async (_req, reply) => {
    return reply.send({
      success: true,
      data: ComplianceService.NTA2025_DEADLINES,
    });
  });

  // GET /api/v1/compliance/projected-liability
  app.get<{
    Querystring: { businessId: string; taxType?: string; periods?: string }
  }>('/api/v1/compliance/projected-liability', async (req, reply) => {
    const userId = await authenticate(req);
    const { businessId, taxType = 'VAT', periods = '3' } = req.query;
    if (!businessId) return reply.code(400).send({ success: false, error: 'businessId required' });

    const projections = await complianceService.computeProjectedLiability(
      userId,
      businessId,
      taxType as any,
      parseInt(periods, 10),
    );
    return reply.send({ success: true, data: projections });
  });

  // POST /api/v1/compliance/smart-generate — Adaptive cadence reminder generation
  app.post<{
    Body: { businessId: string; monthsAhead?: number }
  }>('/api/v1/compliance/smart-generate', async (req, reply) => {
    const userId = await authenticate(req);
    const { businessId, monthsAhead = 3 } = req.body ?? {};
    if (!businessId) return reply.code(400).send({ success: false, error: 'businessId required' });

    const result = await complianceService.generateSmartReminders(userId, businessId, monthsAhead);
    return reply.send({ success: true, data: result });
  });

  // GET /api/v1/compliance/savings-windows
  app.get<{ Querystring: { businessId: string } }>(
    '/api/v1/compliance/savings-windows',
    async (req, reply) => {
      const userId = await authenticate(req);
      const { businessId } = req.query;
      if (!businessId) return reply.code(400).send({ success: false, error: 'businessId required' });

      const windows = await complianceService.identifySavingsWindow(userId, businessId);
      return reply.send({ success: true, data: windows });
    },
  );

  // GET /api/v1/compliance/penalty-accrual
  app.get<{ Querystring: { businessId: string } }>(
    '/api/v1/compliance/penalty-accrual',
    async (req, reply) => {
      const userId = await authenticate(req);
      const { businessId } = req.query;
      if (!businessId) return reply.code(400).send({ success: false, error: 'businessId required' });

      const accrual = await complianceService.computePenaltyAccrual(userId, businessId);
      return reply.send({ success: true, data: accrual });
    },
  );

  // =========================================================================
  // V12 — Pre-Flight Compliance Checks (GAP-13, smoke test #9)
  // GET /api/v1/filings/preflight?taxType=CIT&turnoverHint=95000000
  // =========================================================================
  app.get<{
    Querystring: {
      taxType: string;
      turnoverHint?: string;
      orgId?: string;
    };
  }>(
    '/api/v1/filings/preflight',
    async (req, reply) => {
      const userId = await authenticate(req);
      const { taxType, turnoverHint, orgId } = req.query;

      if (!taxType) {
        return reply.code(400).send({ success: false, error: 'taxType query parameter required (VAT|WHT|PAYE|CIT|NIL)' });
      }

      // Resolve org context — either from query or from user's default org
      let resolvedOrgId = orgId;
      if (!resolvedOrgId) {
        try {
          const membership = await (prisma as any).orgMembership.findFirst({
            where:  { userId },
            select: { orgId: true },
          });
          resolvedOrgId = membership?.orgId;
        } catch {
          // Fallback to userId-based org lookup
          const user = await (prisma as any).user.findUnique({
            where:  { id: userId },
            select: { defaultOrgId: true },
          });
          resolvedOrgId = user?.defaultOrgId;
        }
      }

      if (!resolvedOrgId) {
        return reply.code(400).send({ success: false, error: 'Could not resolve organisation. Provide orgId query parameter.' });
      }

      const hint = turnoverHint ? Number(turnoverHint) : undefined;
      const result = await runCompliancePreFlight(resolvedOrgId, taxType.toUpperCase(), hint);

      return reply.send({
        success: true,
        data:    result,
      });
    },
  );
}
