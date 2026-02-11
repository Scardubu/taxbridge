/**
 * Expense Management Routes (Phase 5)
 *
 * CRUD endpoints for business expense tracking with OCR receipt scanning.
 *
 * Endpoints:
 * POST   /api/v1/expenses                    — Create expense
 * POST   /api/v1/expenses/scan               — Create expense from receipt scan (OCR)
 * GET    /api/v1/expenses                     — List expenses (with filters)
 * GET    /api/v1/expenses/stats               — Expense statistics
 * GET    /api/v1/expenses/:id                 — Get expense detail
 * PUT    /api/v1/expenses/:id                 — Update expense
 * DELETE /api/v1/expenses/:id                 — Delete expense
 * POST   /api/v1/expenses/:id/approve         — Approve expense
 * POST   /api/v1/expenses/:id/reject          — Reject expense
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

import { ExpenseService, EXPENSE_CATEGORIES } from '../services/expense';
import { performOCR } from '../lib/performOCR';
import { AuthenticationError, ValidationError, NotFoundError } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('expense-routes');

export default async function expenseRoutes(
  app: FastifyInstance,
  opts: { prisma: PrismaClient }
) {
  const prisma = opts.prisma;
  const expenseService = new ExpenseService(prisma);

  // =========================================================================
  // Auth helper (same pattern as other route files)
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

  const CategoryEnum = z.enum(EXPENSE_CATEGORIES as [string, ...string[]]);

  const CreateExpenseSchema = z.object({
    businessId: z.string().uuid(),
    amount: z.number().positive(),
    category: CategoryEnum,
    description: z.string().min(1).max(500),
    date: z.string().refine(d => !isNaN(Date.parse(d)), 'Invalid date'),
    vatAmount: z.number().min(0).optional(),
    vatEligible: z.boolean().optional(),
    receiptImage: z.string().optional(),
  });

  const UpdateExpenseSchema = z.object({
    amount: z.number().positive().optional(),
    category: CategoryEnum.optional(),
    description: z.string().min(1).max(500).optional(),
    date: z.string().refine(d => !isNaN(Date.parse(d)), 'Invalid date').optional(),
    vatAmount: z.number().min(0).optional(),
    vatEligible: z.boolean().optional(),
    receiptImage: z.string().optional(),
  });

  const ScanReceiptSchema = z.object({
    businessId: z.string().uuid(),
    image: z.string().min(1), // base64 encoded
    mimeType: z.string().default('image/jpeg'),
  });

  // =========================================================================
  // POST /api/v1/expenses — Create expense
  // =========================================================================
  app.post('/api/v1/expenses', async (req, reply) => {
    const userId = await authenticate(req);
    const body = CreateExpenseSchema.parse(req.body);

    try {
      const expense = await expenseService.create(userId, body as import('../services/expense').CreateExpenseInput);
      return reply.status(201).send({
        success: true,
        data: { expense: formatExpense(expense) },
      });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        throw new NotFoundError('Business', body.businessId);
      }
      throw err;
    }
  });

  // =========================================================================
  // POST /api/v1/expenses/scan — Create expense from receipt scan (OCR)
  // =========================================================================
  app.post('/api/v1/expenses/scan', async (req, reply) => {
    const userId = await authenticate(req);
    const body = ScanReceiptSchema.parse(req.body);

    // Validate image size (max 5MB)
    const imageSizeBytes = body.image.length * (3 / 4);
    if (imageSizeBytes > 5 * 1024 * 1024) {
      throw new ValidationError('Image too large (max 5MB)');
    }

    log.info('OCR expense scan started', { userId, businessId: body.businessId });

    // Run OCR
    const ocrResult = await performOCR(body.image, body.mimeType);

    if (!ocrResult.amount && (!ocrResult.items || ocrResult.items.length === 0)) {
      return reply.status(200).send({
        success: true,
        data: {
          ocrResult: {
            amount: ocrResult.amount,
            date: ocrResult.date,
            items: ocrResult.items,
            confidence: ocrResult.confidence,
          },
          expense: null,
          message: 'Could not extract sufficient data from receipt. Please enter manually.',
        },
      });
    }

    // Create expense from OCR data
    const expense = await expenseService.createFromOCR(
      userId,
      body.businessId,
      ocrResult,
      body.image.length > 10000 ? undefined : body.image // Only store small images inline
    );

    log.info('OCR expense created', {
      expenseId: expense.id,
      confidence: ocrResult.confidence,
      amount: ocrResult.amount,
    });

    return reply.status(201).send({
      success: true,
      data: {
        ocrResult: {
          amount: ocrResult.amount,
          date: ocrResult.date,
          items: ocrResult.items,
          confidence: ocrResult.confidence,
        },
        expense: formatExpense(expense),
      },
    });
  });

  // =========================================================================
  // GET /api/v1/expenses — List expenses
  // =========================================================================
  app.get('/api/v1/expenses', async (req, reply) => {
    const userId = await authenticate(req);
    const query = req.query as Record<string, string>;

    const businessId = query.businessId;
    if (!businessId) {
      throw new ValidationError('businessId query parameter is required');
    }

    try {
      const result = await expenseService.list(userId, {
        businessId,
        category: query.category,
        status: query.status,
        fromDate: query.fromDate,
        toDate: query.toDate,
        minAmount: query.minAmount ? Number(query.minAmount) : undefined,
        maxAmount: query.maxAmount ? Number(query.maxAmount) : undefined,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });

      return reply.send({
        success: true,
        data: {
          expenses: result.expenses.map(formatExpense),
          pagination: result.pagination,
        },
      });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        throw new NotFoundError('Business', businessId);
      }
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/expenses/stats — Expense statistics
  // =========================================================================
  app.get('/api/v1/expenses/stats', async (req, reply) => {
    const userId = await authenticate(req);
    const query = req.query as Record<string, string>;

    const businessId = query.businessId;
    if (!businessId) {
      throw new ValidationError('businessId query parameter is required');
    }

    try {
      const stats = await expenseService.getStats(userId, businessId);
      return reply.send({ success: true, data: stats });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        throw new NotFoundError('Business', businessId);
      }
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/expenses/:id — Get expense detail
  // =========================================================================
  app.get('/api/v1/expenses/:id', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };

    const expense = await expenseService.getById(userId, id);
    if (!expense) {
      throw new NotFoundError('Expense', id);
    }

    return reply.send({
      success: true,
      data: { expense: formatExpense(expense) },
    });
  });

  // =========================================================================
  // PUT /api/v1/expenses/:id — Update expense
  // =========================================================================
  app.put('/api/v1/expenses/:id', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };
    const body = UpdateExpenseSchema.parse(req.body);

    try {
      const expense = await expenseService.update(userId, id, body as import('../services/expense').UpdateExpenseInput);
      return reply.send({
        success: true,
        data: { expense: formatExpense(expense) },
      });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        throw new NotFoundError('Expense', id);
      }
      if (err.message?.includes('Only pending')) {
        throw new ValidationError(err.message);
      }
      throw err;
    }
  });

  // =========================================================================
  // DELETE /api/v1/expenses/:id — Delete expense
  // =========================================================================
  app.delete('/api/v1/expenses/:id', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };

    try {
      await expenseService.delete(userId, id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        throw new NotFoundError('Expense', id);
      }
      if (err.message?.includes('Only pending')) {
        throw new ValidationError(err.message);
      }
      throw err;
    }
  });

  // =========================================================================
  // POST /api/v1/expenses/:id/approve — Approve expense
  // =========================================================================
  app.post('/api/v1/expenses/:id/approve', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };

    try {
      const expense = await expenseService.approve(userId, id);
      return reply.send({
        success: true,
        data: { expense: formatExpense(expense) },
      });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        throw new NotFoundError('Expense', id);
      }
      if (err.message?.includes('Only pending')) {
        throw new ValidationError(err.message);
      }
      throw err;
    }
  });

  // =========================================================================
  // POST /api/v1/expenses/:id/reject — Reject expense
  // =========================================================================
  app.post('/api/v1/expenses/:id/reject', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };

    try {
      const expense = await expenseService.reject(userId, id);
      return reply.send({
        success: true,
        data: { expense: formatExpense(expense) },
      });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        throw new NotFoundError('Expense', id);
      }
      if (err.message?.includes('Only pending')) {
        throw new ValidationError(err.message);
      }
      throw err;
    }
  });
}

// =============================================================================
// Response Formatter
// =============================================================================

function formatExpense(expense: any) {
  return {
    id: expense.id,
    businessId: expense.businessId,
    amount: Number(expense.amount),
    category: expense.category,
    description: expense.description,
    date: expense.date instanceof Date ? expense.date.toISOString() : expense.date,
    vatAmount: Number(expense.vatAmount || 0),
    vatEligible: expense.vatEligible,
    receiptImage: expense.receiptImage || null,
    ocrData: expense.ocrData || null,
    status: expense.status,
    approvedBy: expense.approvedBy || null,
    approvedAt: expense.approvedAt ? (expense.approvedAt instanceof Date ? expense.approvedAt.toISOString() : expense.approvedAt) : null,
    createdAt: expense.createdAt instanceof Date ? expense.createdAt.toISOString() : expense.createdAt,
    updatedAt: expense.updatedAt instanceof Date ? expense.updatedAt.toISOString() : expense.updatedAt,
  };
}
