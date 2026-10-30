/**
 * Business Management Routes
 *
 * POST /api/v1/business              — Create a business
 * GET  /api/v1/business/profile      — Get authenticated user's business profile
 * POST /api/v1/business/verify       — Verify business (TIN/BVN/CAC via Youverify)
 * PUT  /api/v1/business/profile      — Update business profile
 * GET  /api/v1/business/verification — Get verification status
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { youverifyService } from '../integrations/youverify/service';
import { createLogger } from '../lib/logger';
import { formatErrorResponse, ValidationError, NotFoundError } from '../lib/errors';

const log = createLogger('business');

export default async function businessRoutes(app: FastifyInstance, opts: { prisma: PrismaClient }) {
  const prisma = opts.prisma;

  // =========================================================================
  // Schemas
  // =========================================================================

  const CreateBusinessSchema = z.object({
    name: z.string().min(2).max(200),
    cacNumber: z.string().optional(),
    tin: z.string().optional(),
    bvn: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
    }).optional(),
    businessType: z.enum(['SOLE_PROPRIETOR', 'PARTNERSHIP', 'LIMITED_COMPANY', 'NGO']).optional(),
  });

  const UpdateBusinessSchema = z.object({
    name: z.string().trim().min(2).max(200).optional(),
    businessName: z.string().trim().min(2).max(200).optional(),
    tradingName: z.string().trim().max(200).nullable().optional(),
    tin: z.string().trim().max(64).nullable().optional(),
    rcNumber: z.string().trim().max(64).nullable().optional(),
    sector: z.string().trim().max(120).nullable().optional(),
    businessType: z.union([
      z.enum(['SOLE_PROPRIETOR', 'PARTNERSHIP', 'LIMITED_COMPANY', 'NGO']),
      z.enum(['sole_trader', 'partnership', 'limited_company', 'ngo']),
    ]).transform((value) => ({
      sole_trader: 'SOLE_PROPRIETOR',
      partnership: 'PARTNERSHIP',
      limited_company: 'LIMITED_COMPANY',
      ngo: 'NGO',
      SOLE_PROPRIETOR: 'SOLE_PROPRIETOR',
      PARTNERSHIP: 'PARTNERSHIP',
      LIMITED_COMPANY: 'LIMITED_COMPANY',
      NGO: 'NGO',
    } as const)[value] as 'SOLE_PROPRIETOR' | 'PARTNERSHIP' | 'LIMITED_COMPANY' | 'NGO').optional(),
    annualTurnover: z.number().finite().nonnegative().nullable().optional(),
    monthlyRevenue: z.number().finite().nonnegative().nullable().optional(),
    totalFixedAssets: z.number().finite().nonnegative().nullable().optional(),
    employeeCount: z.number().int().nonnegative().optional(),
    isVatRegistered: z.boolean().optional(),
    vatNumber: z.string().trim().max(64).nullable().optional(),
    lga: z.string().trim().max(120).nullable().optional(),
    state: z.string().trim().max(120).nullable().optional(),
    email: z.string().trim().email().nullable().optional(),
    phone: z.string().trim().max(32).nullable().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
    }).optional(),
  }).strict();

  const VerifyBusinessSchema = z.object({
    tinVerification: z.boolean().optional().default(false),
    bvnVerification: z.boolean().optional().default(false),
    cacVerification: z.boolean().optional().default(false),
  });

  // =========================================================================
  // POST /api/v1/business — Create a business
  // =========================================================================

  app.post('/api/v1/business', { preHandler: [app.authenticate, app.resolveOrgContext] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId;
      const body = CreateBusinessSchema.parse(request.body);

      // Check if user already has a business
      const existing = await prisma.business.findFirst({ where: { ownerId: userId } });
      if (existing) {
        const error = new ValidationError('User already has a business registered', { businessId: existing.id });
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

      const business = await prisma.business.create({
        data: {
          ownerId: userId,
          organizationId: request.orgContext.orgId,
          name: body.name,
          cacNumber: body.cacNumber,
          tin: body.tin,
          bvn: body.bvn,
          email: body.email,
          phone: body.phone,
          addressStreet: body.address?.street,
          addressCity: body.address?.city,
          addressState: body.address?.state,
          addressZipCode: body.address?.zipCode,
          businessType: body.businessType || 'SOLE_PROPRIETOR',
          status: 'PENDING',
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'business_created',
          userId,
          metadata: { businessId: business.id, name: business.name },
        },
      });

      log.info('Business created', { businessId: business.id, userId });

      return reply.status(201).send({
        success: true,
        data: {
          business: formatBusinessResponse(business),
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Prisma unique constraint violation
        const field = error.meta?.target?.[0] || 'field';
        return reply.status(409).send({ error: `A business with this ${field} already exists` });
      }
      log.error('Failed to create business', { error: error.message });
      return reply.status(400).send({ error: error.message });
    }
  });

  // =========================================================================
  // GET /api/v1/business/profile — Get business profile
  // =========================================================================

  app.get('/api/v1/business/profile', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId;

      const business = await prisma.business.findFirst({
        where: { ownerId: userId },
        include: {
          _count: {
            select: { employees: true, expenses: true, taxRemittances: true },
          },
        },
      });

      if (!business) {
        const error = new NotFoundError('Business', userId);
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

      return reply.send({
        success: true,
        data: {
          ...formatBusinessResponse(business),
          counts: {
            employees: (business as any)._count?.employees || 0,
            expenses: (business as any)._count?.expenses || 0,
            taxRemittances: (business as any)._count?.taxRemittances || 0,
          },
        },
      });
    } catch (error: any) {
      log.error('Failed to get business profile', { error: error.message });
      return reply.status(401).send({ error: error.message });
    }
  });

  // =========================================================================
  // PUT /api/v1/business/profile — Update business profile
  // =========================================================================

  app.put('/api/v1/business/profile', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId;
      const body = UpdateBusinessSchema.parse(request.body);

      const business = await prisma.business.findFirst({ where: { ownerId: userId } });
      if (!business) {
        const error = new NotFoundError('Business', userId);
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

      const name = body.businessName ?? body.name;
      const tinChanged = body.tin !== undefined && body.tin !== business.tin;
      const cacNumberChanged = body.rcNumber !== undefined && body.rcNumber !== business.cacNumber;

      const updateData = {
        ...(name !== undefined ? { name } : {}),
        ...(body.tradingName !== undefined ? { tradingName: body.tradingName } : {}),
        ...(body.tin !== undefined ? { tin: body.tin } : {}),
        ...(body.rcNumber !== undefined ? { cacNumber: body.rcNumber } : {}),
        ...(body.sector !== undefined ? { sector: body.sector } : {}),
        ...(body.annualTurnover !== undefined ? { annualTurnover: body.annualTurnover } : {}),
        ...(body.monthlyRevenue !== undefined ? { monthlyRevenue: body.monthlyRevenue } : {}),
        ...(body.totalFixedAssets !== undefined ? { totalFixedAssets: body.totalFixedAssets } : {}),
        ...(body.employeeCount !== undefined ? { employeeCount: body.employeeCount } : {}),
        ...(body.isVatRegistered !== undefined ? { isVatRegistered: body.isVatRegistered } : {}),
        ...(body.vatNumber !== undefined ? { vatNumber: body.vatNumber } : {}),
        ...(body.lga !== undefined ? { addressLga: body.lga } : {}),
        ...(body.state !== undefined ? { addressState: body.state } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.address?.street !== undefined ? { addressStreet: body.address.street } : {}),
        ...(body.address?.city !== undefined ? { addressCity: body.address.city } : {}),
        ...(body.address?.state !== undefined ? { addressState: body.address.state } : {}),
        ...(body.address?.zipCode !== undefined ? { addressZipCode: body.address.zipCode } : {}),
        ...(body.businessType !== undefined ? { businessType: body.businessType } : {}),
        ...(tinChanged ? { tinVerified: false, status: 'PENDING', verifiedAt: null } : {}),
        ...(cacNumberChanged ? { cacVerified: false, status: 'PENDING', verifiedAt: null } : {}),
      };

      const updated = await prisma.business.update({
        where: { id: business.id },
        data: updateData,
      });

      await prisma.auditLog.create({
        data: {
          action: 'business_updated',
          userId,
          metadata: { businessId: business.id, fields: Object.keys(body) },
        },
      });

      return reply.send({
        success: true,
        data: formatBusinessResponse(updated),
      });
    } catch (error: any) {
      log.error('Failed to update business', { error: error.message });
      return reply.status(400).send({ error: error.message });
    }
  });

  // =========================================================================
  // POST /api/v1/business/verify — Verify business via Youverify
  // =========================================================================

  app.post('/api/v1/business/verify', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId;
      const body = VerifyBusinessSchema.parse(request.body);

      const business = await prisma.business.findFirst({ where: { ownerId: userId } });
      if (!business) {
        const error = new NotFoundError('Business', userId);
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

      // Validate that requested verifications have the required data
      if (body.tinVerification && !business.tin) {
        const error = new ValidationError('TIN is required for TIN verification. Update your business profile first.', {});
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }
      if (body.bvnVerification && !business.bvn) {
        const error = new ValidationError('BVN is required for BVN verification. Update your business profile first.', {});
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }
      if (body.cacVerification && !business.cacNumber) {
        const error = new ValidationError('CAC number is required for CAC verification. Update your business profile first.', {});
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

      // Get owner name for BVN verification
      const owner = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const nameParts = (owner?.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      log.info('Starting business verification', {
        businessId: business.id,
        tin: body.tinVerification,
        bvn: body.bvnVerification,
        cac: body.cacVerification,
      });

      const result = await youverifyService.verifyBusiness({
        tinVerification: body.tinVerification,
        bvnVerification: body.bvnVerification,
        cacVerification: body.cacVerification,
        tin: business.tin || undefined,
        bvn: business.bvn || undefined,
        cacNumber: business.cacNumber || undefined,
        firstName,
        lastName,
      });

      // Update business verification fields
      const updateData: Record<string, any> = {};

      if (result.verifications.tin) {
        updateData.tinVerified = result.verifications.tin.verified;
      }
      if (result.verifications.bvn) {
        updateData.bvnVerified = result.verifications.bvn.verified;
      }
      if (result.verifications.cac) {
        updateData.cacVerified = result.verifications.cac.verified;
      }

      // Update overall status
      if (result.overallStatus === 'VERIFIED') {
        updateData.status = 'VERIFIED';
        updateData.verifiedAt = new Date();
      } else if (result.overallStatus === 'PARTIAL') {
        // Keep as PENDING unless already verified
        if (business.status !== 'VERIFIED') {
          updateData.status = 'PENDING';
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.business.update({
          where: { id: business.id },
          data: updateData,
        });
      }

      await prisma.auditLog.create({
        data: {
          action: 'business_verification',
          userId,
          metadata: {
            businessId: business.id,
            overallStatus: result.overallStatus,
            tinVerified: result.verifications.tin?.verified,
            bvnVerified: result.verifications.bvn?.verified,
            cacVerified: result.verifications.cac?.verified,
          },
        },
      });

      log.info('Business verification complete', {
        businessId: business.id,
        overallStatus: result.overallStatus,
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      log.error('Business verification failed', { error: error.message });
      return reply.status(500).send({ error: error.message });
    }
  });

  // =========================================================================
  // GET /api/v1/business/verification — Get verification status
  // =========================================================================

  app.get('/api/v1/business/verification', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId;

      const business = await prisma.business.findFirst({
        where: { ownerId: userId },
        select: {
          id: true,
          status: true,
          tinVerified: true,
          bvnVerified: true,
          cacVerified: true,
          verifiedAt: true,
          tin: true,
          bvn: true,
          cacNumber: true,
        },
      });

      if (!business) {
        const error = new NotFoundError('Business', userId);
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

      return reply.send({
        success: true,
        data: {
          businessId: business.id,
          status: business.status,
          verifications: {
            tin: { provided: !!business.tin, verified: business.tinVerified },
            bvn: { provided: !!business.bvn, verified: business.bvnVerified },
            cac: { provided: !!business.cacNumber, verified: business.cacVerified },
          },
          verifiedAt: business.verifiedAt,
        },
      });
    } catch (error: any) {
      return reply.status(401).send({ error: error.message });
    }
  });
}

// =============================================================================
// Helpers
// =============================================================================

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatBusinessResponse(business: any) {
  return {
    id: business.id,
    name: business.name,
    businessName: business.name,
    tradingName: business.tradingName ?? null,
    cacNumber: business.cacNumber,
    rcNumber: business.cacNumber,
    tin: business.tin,
    email: business.email,
    phone: business.phone,
    sector: business.sector ?? null,
    annualTurnover: toNullableNumber(business.annualTurnover),
    monthlyRevenue: toNullableNumber(business.monthlyRevenue),
    totalFixedAssets: toNullableNumber(business.totalFixedAssets),
    employeeCount: business.employeeCount ?? 0,
    isVatRegistered: business.isVatRegistered ?? false,
    vatNumber: business.vatNumber ?? null,
    lga: business.addressLga ?? null,
    state: business.addressState ?? null,
    hasValidTIN: business.tinVerified === true,
    address: {
      street: business.addressStreet,
      city: business.addressCity,
      state: business.addressState,
      zipCode: business.addressZipCode,
    },
    businessType: business.businessType,
    status: business.status,
    verification: {
      tinVerified: business.tinVerified,
      bvnVerified: business.bvnVerified,
      cacVerified: business.cacVerified,
    },
    verifiedAt: business.verifiedAt,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  };
}
