/**
 * Payroll Management Routes (Phase 6)
 *
 * Employee CRUD and payroll processing endpoints.
 *
 * Endpoints:
 * POST   /api/v1/payroll/employees              — Create employee
 * GET    /api/v1/payroll/employees               — List employees
 * GET    /api/v1/payroll/employees/:id           — Get employee detail
 * PUT    /api/v1/payroll/employees/:id           — Update employee
 * DELETE /api/v1/payroll/employees/:id           — Deactivate employee
 * POST   /api/v1/payroll/process                 — Process payroll for a period
 * GET    /api/v1/payroll                         — List payrolls
 * GET    /api/v1/payroll/:id                     — Get payroll detail
 * GET    /api/v1/payroll/:id/payslip/:employeeId — Get individual payslip
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

import { PayrollService } from '../services/payroll';
import { AuthenticationError, NotFoundError } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('payroll-routes');

export default async function payrollRoutes(
  app: FastifyInstance,
  opts: { prisma: PrismaClient }
) {
  const prisma = opts.prisma;
  const payrollService = new PayrollService(prisma);

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

  const AllowancesSchema = z.object({
    housing: z.number().min(0).optional(),
    transport: z.number().min(0).optional(),
    meal: z.number().min(0).optional(),
    others: z.number().min(0).optional(),
  }).optional();

  const CreateEmployeeSchema = z.object({
    businessId: z.string().uuid(),
    name: z.string().min(1).max(200),
    email: z.string().email().optional(),
    phone: z.string().min(10).max(20).optional(),
    grossSalary: z.number().positive(),
    allowances: AllowancesSchema,
    startDate: z.string().refine(d => !isNaN(Date.parse(d)), 'Invalid date'),
  });

  const UpdateEmployeeSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(10).max(20).optional(),
    grossSalary: z.number().positive().optional(),
    allowances: AllowancesSchema,
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  });

  const ProcessPayrollSchema = z.object({
    businessId: z.string().uuid(),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM format'),
  });

  // =========================================================================
  // Helper: format employee for response
  // =========================================================================
  function formatEmployee(emp: any) {
    return {
      id: emp.id,
      businessId: emp.businessId,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      grossSalary: Number(emp.grossSalary),
      allowances: {
        housing: Number(emp.housingAllowance),
        transport: Number(emp.transportAllowance),
        meal: Number(emp.mealAllowance),
        others: Number(emp.otherAllowances),
      },
      startDate: emp.startDate instanceof Date ? emp.startDate.toISOString() : emp.startDate,
      status: emp.status,
      createdAt: emp.createdAt instanceof Date ? emp.createdAt.toISOString() : emp.createdAt,
    };
  }

  // =========================================================================
  // POST /api/v1/payroll/employees — Create employee
  // =========================================================================
  app.post('/api/v1/payroll/employees', async (req, reply) => {
    const userId = await authenticate(req);
    const body = CreateEmployeeSchema.parse(req.body);

    try {
      const employee = await payrollService.createEmployee(userId, body);
      return reply.status(201).send({
        success: true,
        data: { employee: formatEmployee(employee) },
      });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        throw new NotFoundError('Business', body.businessId);
      }
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/payroll/employees — List employees
  // =========================================================================
  app.get('/api/v1/payroll/employees', async (req, reply) => {
    const userId = await authenticate(req);
    const query = req.query as Record<string, string>;

    const businessId = query.businessId;
    if (!businessId) {
      return reply.status(400).send({ success: false, error: 'businessId query parameter required' });
    }

    try {
      const result = await payrollService.listEmployees(userId, {
        businessId,
        status: query.status,
        page: query.page ? parseInt(query.page) : undefined,
        limit: query.limit ? parseInt(query.limit) : undefined,
      });

      return reply.send({
        success: true,
        data: {
          employees: result.employees.map(formatEmployee),
          pagination: result.pagination,
        },
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', businessId);
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/payroll/employees/:id — Get employee detail
  // =========================================================================
  app.get('/api/v1/payroll/employees/:id', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };

    const employee = await payrollService.getEmployee(userId, id);
    if (!employee) throw new NotFoundError('Employee', id);

    return reply.send({
      success: true,
      data: { employee: formatEmployee(employee) },
    });
  });

  // =========================================================================
  // PUT /api/v1/payroll/employees/:id — Update employee
  // =========================================================================
  app.put('/api/v1/payroll/employees/:id', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };
    const body = UpdateEmployeeSchema.parse(req.body);

    try {
      const employee = await payrollService.updateEmployee(userId, id, body);
      return reply.send({
        success: true,
        data: { employee: formatEmployee(employee) },
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Employee', id);
      throw err;
    }
  });

  // =========================================================================
  // DELETE /api/v1/payroll/employees/:id — Deactivate employee
  // =========================================================================
  app.delete('/api/v1/payroll/employees/:id', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };

    try {
      await payrollService.deleteEmployee(userId, id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Employee', id);
      throw err;
    }
  });

  // =========================================================================
  // POST /api/v1/payroll/process — Process payroll
  // =========================================================================
  app.post('/api/v1/payroll/process', async (req, reply) => {
    const userId = await authenticate(req);
    const body = ProcessPayrollSchema.parse(req.body);

    try {
      const result = await payrollService.processPayroll(userId, body.businessId, body.period);
      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', body.businessId);
      if (err.message?.includes('already been processed') || err.message?.includes('No active employees')) {
        return reply.status(400).send({ success: false, error: err.message });
      }
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/payroll — List payrolls
  // =========================================================================
  app.get('/api/v1/payroll', async (req, reply) => {
    const userId = await authenticate(req);
    const query = req.query as Record<string, string>;

    const businessId = query.businessId;
    if (!businessId) {
      return reply.status(400).send({ success: false, error: 'businessId query parameter required' });
    }

    try {
      const result = await payrollService.listPayrolls(
        userId,
        businessId,
        query.page ? parseInt(query.page) : undefined,
        query.limit ? parseInt(query.limit) : undefined,
      );

      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', businessId);
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/payroll/:id — Get payroll detail
  // =========================================================================
  app.get('/api/v1/payroll/:id', async (req, reply) => {
    const userId = await authenticate(req);
    const { id } = req.params as { id: string };

    const detail = await payrollService.getPayrollDetail(userId, id);
    if (!detail) throw new NotFoundError('Payroll', id);

    return reply.send({
      success: true,
      data: { payroll: detail },
    });
  });

  // =========================================================================
  // GET /api/v1/payroll/:id/payslip/:employeeId — Get payslip
  // =========================================================================
  app.get('/api/v1/payroll/:id/payslip/:employeeId', async (req, reply) => {
    const userId = await authenticate(req);
    const { id, employeeId } = req.params as { id: string; employeeId: string };

    const payslip = await payrollService.getPayslip(userId, id, employeeId);
    if (!payslip) throw new NotFoundError('Payslip', `${id}/${employeeId}`);

    return reply.send({
      success: true,
      data: { payslip },
    });
  });
}
