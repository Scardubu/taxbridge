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

import { PayrollService } from '../services/payroll';
import { calculatePAYE } from '../services/tax-engine';
import { NotFoundError } from '../lib/errors';
import { createLogger } from '../lib/logger';
import { validate } from '../plugins/validate';
import { cacheIdempotencyResponse, idempotency } from '../plugins/idempotency';
import { requireRole } from '../plugins/requireRole';

const log = createLogger('payroll-routes');

export default async function payrollRoutes(
  app: FastifyInstance,
  opts: { prisma: PrismaClient }
) {
  const prisma = opts.prisma;
  const payrollService = new PayrollService(prisma);

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

  const CalculatePayrollSchema = z.object({
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM format'),
    employees: z.array(z.object({
      name: z.string().min(1).max(200),
      grossIncome: z.number().nonnegative(),
      rentPaid: z.number().nonnegative().optional(),
      pension: z.number().nonnegative().optional(),
    })).min(1),
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
  app.post('/api/v1/payroll/employees', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT'), validate(CreateEmployeeSchema)],
  }, async (req, reply) => {
    const { orgId } = req.orgContext;
    const { userId } = req.user;
    const body = req.body as z.infer<typeof CreateEmployeeSchema>;

    try {
      const employee = await payrollService.createEmployee(userId, { ...body, businessId: orgId });
      return reply.status(201).send({
        success: true,
        data: { employee: formatEmployee(employee) },
      });
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('access denied')) {
        throw new NotFoundError('Business', orgId);
      }
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/payroll/employees — List employees
  // =========================================================================
  app.get('/api/v1/payroll/employees', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const { orgId } = req.orgContext;
    const { userId } = req.user;
    const query = req.query as Record<string, string>;

    const businessId = query.businessId ?? orgId;
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
  app.get('/api/v1/payroll/employees/:id', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const { userId } = req.user;
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
  app.put('/api/v1/payroll/employees/:id', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT'), validate(UpdateEmployeeSchema)],
  }, async (req, reply) => {
    const { userId } = req.user;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof UpdateEmployeeSchema>;

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
  app.delete('/api/v1/payroll/employees/:id', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT')],
  }, async (req, reply) => {
    const { userId } = req.user;
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
  // POST /api/v1/payroll/calculate — Preview PAYE before processing payroll
  // =========================================================================
  app.post('/api/v1/payroll/calculate', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT'), validate(CalculatePayrollSchema)],
  }, async (req, reply) => {
    const { orgId } = req.orgContext;
    const body = req.body as z.infer<typeof CalculatePayrollSchema>;

    const results = body.employees.map((employee) => {
      const paye = calculatePAYE({
        grossSalary: employee.grossIncome,
        annualRent: employee.rentPaid,
        pension: employee.pension,
      } as any);

      return {
        name: employee.name,
        grossIncome: employee.grossIncome,
        taxableIncome: paye.taxableIncome,
        taxLiability: paye.taxDue,
        pensionContribution: paye.pensionContribution,
        nhfContribution: paye.nhfContribution,
        netPay: paye.netPay,
        breakdown: paye.breakdown,
      };
    });

    return reply.send({
      success: true,
      data: {
        period: body.period,
        results,
      },
    });
  });

  // =========================================================================
  // POST /api/v1/payroll/process — Process payroll
  // =========================================================================
  app.post('/api/v1/payroll/process', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT'), validate(ProcessPayrollSchema), idempotency],
  }, async (req, reply) => {
    const { orgId } = req.orgContext;
    const { userId } = req.user;
    const body = req.body as z.infer<typeof ProcessPayrollSchema>;

    try {
      const result = await payrollService.processPayroll(userId, orgId, body.period);
      const responseBody = {
        success: true,
        data: result,
      };
      await cacheIdempotencyResponse(req, 200, responseBody);
      return reply.send(responseBody);
    } catch (err: any) {
      if (err.message?.includes('not found')) throw new NotFoundError('Business', orgId);
      if (err.message?.includes('already been processed') || err.message?.includes('No active employees')) {
        return reply.status(400).send({ success: false, error: err.message });
      }
      throw err;
    }
  });

  // =========================================================================
  // GET /api/v1/payroll — List payrolls
  // =========================================================================
  app.get('/api/v1/payroll', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const { orgId } = req.orgContext;
    const { userId } = req.user;
    const query = req.query as Record<string, string>;

    const businessId = query.businessId ?? orgId;
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
  app.get('/api/v1/payroll/:id', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const { userId } = req.user;
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
  app.get('/api/v1/payroll/:id/payslip/:employeeId', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const { userId } = req.user;
    const { id, employeeId } = req.params as { id: string; employeeId: string };

    const payslip = await payrollService.getPayslip(userId, id, employeeId);
    if (!payslip) throw new NotFoundError('Payslip', `${id}/${employeeId}`);

    return reply.send({
      success: true,
      data: { payslip },
    });
  });
}
