/**
 * Tax Calculation API Routes
 *
 * POST /api/v1/tax/calculate/pit   — Personal Income Tax
 * POST /api/v1/tax/calculate/vat   — Value Added Tax
 * POST /api/v1/tax/calculate/cit   — Company Income Tax
 * POST /api/v1/tax/calculate/cgt   — Capital Gains Tax
 * POST /api/v1/tax/calculate/wht   — Withholding Tax
 * POST /api/v1/tax/calculate/paye  — Pay As You Earn
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

import {
  calculatePIT,
  calculateVAT,
  calculateCIT,
  calculateCGT,
  calculateWHT,
  calculatePAYE,
} from '../services/tax-engine';

// =============================================================================
// Zod Schemas
// =============================================================================

const PITBodySchema = z.object({
  grossIncome: z.number().positive(),
  reliefs: z.object({
    pension: z.number().min(0).optional(),
    nhf: z.number().min(0).optional(),
    lifeInsurance: z.number().min(0).optional(),
    annualRent: z.number().min(0).optional(),
  }).optional(),
});

const VATBodySchema = z.object({
  amount: z.number().positive(),
  category: z.string().optional(),
});

const CITBodySchema = z.object({
  revenue: z.number().min(0),
  expenses: z.number().min(0),
  employeeCount: z.number().int().min(0).optional(),
  digitalIncome: z.number().min(0).optional(),
});

const CGTBodySchema = z.object({
  proceeds: z.number().min(0),
  costBasis: z.number().min(0),
  assetType: z.string().min(1),
  holdingPeriodMonths: z.number().int().min(0).optional(),
});

const WHTBodySchema = z.object({
  amount: z.number().positive(),
  type: z.enum([
    'dividend',
    'interest',
    'rent',
    'royalty',
    'consultancy',
    'construction',
    'contractServices',
    'professionalFees',
  ]),
});

const PAYEBodySchema = z.object({
  grossSalary: z.number().positive(),
  allowances: z.object({
    housing: z.number().min(0).optional(),
    transport: z.number().min(0).optional(),
    meal: z.number().min(0).optional(),
    others: z.number().min(0).optional(),
  }).optional(),
});

const SuccessResponseWrapper = z.object({
  success: z.literal(true),
  data: z.any(),
});

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

// =============================================================================
// Route Plugin
// =============================================================================

export default async function taxRoutes(app: FastifyInstance) {

  // --- PIT ---
  app.post(
    '/api/v1/tax/calculate/pit',
    {
      schema: {
        body: PITBodySchema,
        response: {
          200: SuccessResponseWrapper,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const input = req.body as z.infer<typeof PITBodySchema>;
        const result = calculatePIT(input);
        return reply.send({ success: true, data: result });
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message });
      }
    },
  );

  // --- VAT ---
  app.post(
    '/api/v1/tax/calculate/vat',
    {
      schema: {
        body: VATBodySchema,
        response: {
          200: SuccessResponseWrapper,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const input = req.body as z.infer<typeof VATBodySchema>;
        const result = calculateVAT(input);
        return reply.send({ success: true, data: result });
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message });
      }
    },
  );

  // --- CIT ---
  app.post(
    '/api/v1/tax/calculate/cit',
    {
      schema: {
        body: CITBodySchema,
        response: {
          200: SuccessResponseWrapper,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const input = req.body as z.infer<typeof CITBodySchema>;
        const result = calculateCIT(input);
        return reply.send({ success: true, data: result });
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message });
      }
    },
  );

  // --- CGT ---
  app.post(
    '/api/v1/tax/calculate/cgt',
    {
      schema: {
        body: CGTBodySchema,
        response: {
          200: SuccessResponseWrapper,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const input = req.body as z.infer<typeof CGTBodySchema>;
        const result = calculateCGT(input);
        return reply.send({ success: true, data: result });
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message });
      }
    },
  );

  // --- WHT ---
  app.post(
    '/api/v1/tax/calculate/wht',
    {
      schema: {
        body: WHTBodySchema,
        response: {
          200: SuccessResponseWrapper,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const input = req.body as z.infer<typeof WHTBodySchema>;
        const result = calculateWHT(input);
        return reply.send({ success: true, data: result });
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message });
      }
    },
  );

  // --- PAYE ---
  app.post(
    '/api/v1/tax/calculate/paye',
    {
      schema: {
        body: PAYEBodySchema,
        response: {
          200: SuccessResponseWrapper,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const input = req.body as z.infer<typeof PAYEBodySchema>;
        const result = calculatePAYE(input);
        return reply.send({ success: true, data: result });
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message });
      }
    },
  );
}
