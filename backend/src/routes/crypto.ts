/**
 * Crypto & Digital Asset Tax Routes (Phase 6)
 *
 * Cryptocurrency transaction management and CGT calculation endpoints.
 *
 * Endpoints:
 * POST   /api/v1/crypto/transactions              — Record transaction
 * GET    /api/v1/crypto/transactions              — List transactions
 * GET    /api/v1/crypto/transactions/:id          — Get transaction detail
 * DELETE /api/v1/crypto/transactions/:id          — Delete transaction
 * GET    /api/v1/crypto/tax-report                — Generate CGT tax report
 * GET    /api/v1/crypto/portfolio                  — Get portfolio summary
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

import { CryptoTaxService } from '../services/crypto-tax';
import { NotFoundError } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('crypto-routes');

export default async function cryptoRoutes(
  app: FastifyInstance,
  opts: { prisma: PrismaClient }
) {
  const prisma = opts.prisma;
  const cryptoService = new CryptoTaxService(prisma);

  // =========================================================================
  // Validation Schemas
  // =========================================================================

  const CreateTxSchema = z.object({
    businessId: z.string().uuid(),
    type: z.enum(['buy', 'sell', 'trade', 'transfer']),
    asset: z.string().min(1).max(20),
    amount: z.number().positive(),
    priceNGN: z.number().min(0),
    costBasis: z.number().min(0).optional(),
    platform: z.string().max(100).optional(),
    txHash: z.string().max(200).optional(),
    date: z.string().refine(d => !isNaN(Date.parse(d)), 'Invalid date'),
  });

  // =========================================================================
  // POST /api/v1/crypto/transactions — Record transaction
  // =========================================================================
  app.post('/api/v1/crypto/transactions', { preHandler: [app.authenticate, app.resolveOrgContext] }, async (req, reply) => {
    const userId = req.user.userId;
    const body = CreateTxSchema.parse(req.body);

    try {
      const tx = await cryptoService.createTransaction(userId, body);
      return reply.status(201).send({
        success: true,
        data: {
          transaction: {
            id: tx.id,
            type: tx.type,
            asset: tx.asset,
            amount: Number(tx.amount),
            priceNGN: Number(tx.priceNGN),
            totalNGN: Number(tx.totalNGN),
            costBasis: tx.costBasis ? Number(tx.costBasis) : null,
            platform: tx.platform,
            date: tx.date.toISOString(),
            taxYear: tx.taxYear,
          },
        },
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', body.businessId);
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/crypto/transactions — List transactions
  // =========================================================================
  app.get('/api/v1/crypto/transactions', { preHandler: [app.authenticate, app.resolveOrgContext] }, async (req, reply) => {
    const userId = req.user.userId;
    const query = req.query as Record<string, string>;

    const businessId = query.businessId;
    if (!businessId) {
      return reply.status(400).send({ success: false, error: 'businessId query parameter required' });
    }

    try {
      const result = await cryptoService.listTransactions(userId, businessId, {
        asset: query.asset,
        type: query.type,
        taxYear: query.taxYear ? parseInt(query.taxYear) : undefined,
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
  // GET /api/v1/crypto/transactions/:id — Get transaction detail
  // =========================================================================
  app.get('/api/v1/crypto/transactions/:id', { preHandler: [app.authenticate, app.resolveOrgContext] }, async (req, reply) => {
    const userId = req.user.userId;
    const { id } = req.params as { id: string };

    const tx = await cryptoService.getTransaction(userId, id);
    if (!tx) throw new NotFoundError('Transaction', id);

    return reply.send({ success: true, data: { transaction: tx } });
  });

  // =========================================================================
  // DELETE /api/v1/crypto/transactions/:id — Delete transaction
  // =========================================================================
  app.delete('/api/v1/crypto/transactions/:id', { preHandler: [app.authenticate, app.resolveOrgContext] }, async (req, reply) => {
    const userId = req.user.userId;
    const { id } = req.params as { id: string };

    try {
      await cryptoService.deleteTransaction(userId, id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Transaction', id);
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/crypto/tax-report — Generate CGT tax report
  // =========================================================================
  app.get('/api/v1/crypto/tax-report', { preHandler: [app.authenticate, app.resolveOrgContext] }, async (req, reply) => {
    const userId = req.user.userId;
    const query = req.query as Record<string, string>;

    const businessId = query.businessId;
    const taxYear = query.taxYear ? parseInt(query.taxYear) : new Date().getFullYear();

    if (!businessId) {
      return reply.status(400).send({ success: false, error: 'businessId query parameter required' });
    }

    try {
      const report = await cryptoService.generateTaxReport(userId, businessId, taxYear);
      return reply.send({ success: true, data: { report } });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', businessId);
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/crypto/portfolio — Get portfolio summary
  // =========================================================================
  app.get('/api/v1/crypto/portfolio', { preHandler: [app.authenticate, app.resolveOrgContext] }, async (req, reply) => {
    const userId = req.user.userId;
    const query = req.query as Record<string, string>;

    const businessId = query.businessId;
    if (!businessId) {
      return reply.status(400).send({ success: false, error: 'businessId query parameter required' });
    }

    try {
      const portfolio = await cryptoService.getPortfolio(userId, businessId);
      return reply.send({ success: true, data: { portfolio } });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', businessId);
      throw err;
    }
  });
}
