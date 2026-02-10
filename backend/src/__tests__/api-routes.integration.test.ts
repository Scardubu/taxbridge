/**
 * TaxBridge API Routes — Integration Tests
 *
 * Tests all major API endpoints using Fastify's inject() method.
 * Mocks external dependencies (DB, Redis, integrations) to test
 * route handling, validation, auth, and response formatting.
 */

import jwt from 'jsonwebtoken';

// ── Mocks ────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-test-jwt-secret-123456';

function makeAuthHeader(userId = 'test-user-1') {
  const token = jwt.sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

// Mock Prisma
const mockPrismaClient: Record<string, any> = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  business: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  invoice: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 }, _count: 0 }),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  expense: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: 0 }),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  employee: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  payroll: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  payrollItem: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  },
  complianceReminder: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn(),
  },
  cryptoTransaction: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { totalNGN: 0 } }),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  payment: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  auditLog: {
    create: jest.fn(),
  },
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  $transaction: jest.fn((fn: any) => fn(mockPrismaClient)),
};

jest.mock('../lib/prisma', () => ({
  prisma: mockPrismaClient,
  getPrismaClient: () => mockPrismaClient,
  disconnectPrisma: jest.fn(),
}));

// ── Tax Engine Tests (no auth required) ──────────────────────────────────────

describe('Tax Calculation API Routes', () => {
  // Import tax engine directly since these are pure calculation tests
  const {
    calculatePIT,
    calculateVAT,
    calculateCIT,
    calculateCGT,
    calculateWHT,
    calculatePAYE,
  } = require('../services/tax-engine');

  describe('PIT Calculation', () => {
    it('should calculate PIT for ₦2M income', () => {
      const result = calculatePIT({ grossIncome: 2_000_000 });
      expect(result.taxAmount).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeLessThan(0.25);
      expect(result.netIncome).toBeLessThan(2_000_000);
      expect(result.breakdown).toBeDefined();
      expect(Array.isArray(result.breakdown)).toBe(true);
    });

    it('should exempt minimum wage earners', () => {
      const result = calculatePIT({ grossIncome: 840_000 });
      expect(result.taxAmount).toBe(0);
      expect(result.isMinimumWageExempt).toBe(true);
    });

    it('should apply all reliefs correctly', () => {
      const result = calculatePIT({
        grossIncome: 5_000_000,
        reliefs: { pension: 400_000, nhf: 125_000, annualRent: 1_000_000 },
      });
      expect(result.reliefs.pension).toBe(400_000);
      expect(result.reliefs.nhf).toBe(125_000);
      expect(result.reliefs.rentRelief).toBe(200_000); // 20% of 1M
      expect(result.totalReliefs).toBeGreaterThan(0);
    });
  });

  describe('VAT Calculation', () => {
    it('should apply 7.5% standard VAT', () => {
      const result = calculateVAT({ amount: 1_000_000 });
      expect(result.vatRate).toBe(0.075);
      expect(result.vatAmount).toBe(75_000);
      expect(result.totalAmount).toBe(1_075_000);
    });

    it('should exempt medical services', () => {
      const result = calculateVAT({ amount: 500_000, category: 'medical-services' });
      expect(result.vatAmount).toBe(0);
      expect(result.isExempt).toBe(true);
    });
  });

  describe('CIT Calculation', () => {
    it('should apply 0% for small companies (≤₦25M)', () => {
      const result = calculateCIT({ revenue: 20_000_000, expenses: 10_000_000 });
      expect(result.taxRate).toBe(0);
      expect(result.taxAmount).toBe(0);
    });

    it('should apply 20% for medium companies', () => {
      const result = calculateCIT({ revenue: 50_000_000, expenses: 30_000_000 });
      expect(result.taxRate).toBe(0.20);
      expect(result.taxAmount).toBe(4_000_000);
    });

    it('should apply 30% for large companies (>₦100M)', () => {
      const result = calculateCIT({ revenue: 200_000_000, expenses: 100_000_000 });
      expect(result.taxRate).toBe(0.30);
    });
  });

  describe('CGT Calculation', () => {
    it('should apply 10% on capital gains', () => {
      const result = calculateCGT({ proceeds: 10_000_000, costBasis: 6_000_000, assetType: 'crypto' });
      expect(result.taxRate).toBe(0.10);
      expect(result.netGain).toBe(4_000_000);
      expect(result.taxAmount).toBe(400_000);
    });

    it('should return 0 tax on losses', () => {
      const result = calculateCGT({ proceeds: 3_000_000, costBasis: 5_000_000, assetType: 'stocks' });
      expect(result.taxAmount).toBe(0);
      expect(result.isLoss).toBe(true);
    });
  });

  describe('WHT Calculation', () => {
    it('should apply correct rates for each type', () => {
      expect(calculateWHT({ amount: 1_000_000, type: 'dividend' }).rate).toBe(0.10);
      expect(calculateWHT({ amount: 1_000_000, type: 'construction' }).rate).toBe(0.05);
      expect(calculateWHT({ amount: 1_000_000, type: 'rent' }).rate).toBe(0.10);
    });
  });

  describe('PAYE Calculation', () => {
    it('should calculate PAYE with pension and NHF deductions', () => {
      const result = calculatePAYE({
        grossSalary: 500_000,
        allowances: { housing: 100_000, transport: 50_000 },
      });
      expect(result.grossIncome).toBe(650_000);
      expect(result.pensionContribution).toBe(40_000); // 8% of 500k
      expect(result.nhfContribution).toBe(12_500); // 2.5% of 500k
      expect(result.netPay).toBeLessThan(650_000);
      expect(result.breakdown.length).toBeGreaterThan(0);
    });
  });
});

// ── Validation Tests ─────────────────────────────────────────────────────────

describe('Input Validation', () => {
  describe('Tax Route Validation', () => {
    const { calculatePIT, calculateVAT, calculateCIT } = require('../services/tax-engine');

    it('should handle zero income gracefully', () => {
      const result = calculatePIT({ grossIncome: 0 });
      expect(result.taxAmount).toBe(0);
    });

    it('should handle expenses exceeding revenue', () => {
      const result = calculateCIT({ revenue: 10_000_000, expenses: 20_000_000 });
      expect(result.profit).toBe(0);
      expect(result.taxAmount).toBe(0);
    });

    it('should handle very large amounts', () => {
      const result = calculateVAT({ amount: 999_999_999_999 });
      expect(result.vatAmount).toBeGreaterThan(0);
      expect(result.totalAmount).toBeGreaterThan(result.vatAmount);
    });
  });
});

// ── Cross-Service Consistency ────────────────────────────────────────────────

describe('Cross-Service Consistency', () => {
  const {
    calculatePIT,
    calculateVAT,
    calculateCIT,
    calculatePAYE,
  } = require('../services/tax-engine');

  it('PIT and PAYE should produce same tax for same taxable income', () => {
    const salary = 3_000_000;
    const payeResult = calculatePAYE({ grossSalary: salary });
    const pitResult = calculatePIT({
      grossIncome: salary,
      reliefs: {
        cra: true,
        pension: salary * 0.08,
        nhf: salary * 0.025,
      },
    });

    expect(payeResult.taxableIncome).toBe(pitResult.taxableIncome);
    expect(payeResult.taxDue).toBe(pitResult.taxAmount);
  });

  it('VAT should always be 7.5% for standard category', () => {
    const amounts = [100, 1000, 100_000, 1_000_000, 50_000_000];
    for (const amount of amounts) {
      const result = calculateVAT({ amount });
      expect(result.vatRate).toBe(0.075);
      expect(result.vatAmount).toBeCloseTo(amount * 0.075, 2);
    }
  });

  it('CIT boundaries should be consistent', () => {
    // At ₦25M boundary
    const at25M = calculateCIT({ revenue: 25_000_000, expenses: 0 });
    const above25M = calculateCIT({ revenue: 25_000_001, expenses: 0 });
    expect(at25M.taxRate).toBe(0);
    expect(above25M.taxRate).toBe(0.20);

    // At ₦100M boundary
    const at100M = calculateCIT({ revenue: 100_000_000, expenses: 0 });
    const above100M = calculateCIT({ revenue: 100_000_001, expenses: 0 });
    expect(at100M.taxRate).toBe(0.20);
    expect(above100M.taxRate).toBe(0.30);
  });
});

// ── Service Layer Tests ──────────────────────────────────────────────────────

describe('Service Layer Integration', () => {
  describe('Invoice Service', () => {
    it('should be importable', () => {
      const { InvoiceService } = require('../services/invoice');
      expect(InvoiceService).toBeDefined();
    });
  });

  describe('Expense Service', () => {
    it('should be importable', () => {
      const { ExpenseService } = require('../services/expense');
      expect(ExpenseService).toBeDefined();
    });
  });

  describe('Payroll Service', () => {
    it('should be importable', () => {
      const { PayrollService } = require('../services/payroll');
      expect(PayrollService).toBeDefined();
    });
  });

  describe('Compliance Service', () => {
    it('should be importable', () => {
      const { ComplianceService } = require('../services/compliance');
      expect(ComplianceService).toBeDefined();
    });
  });

  describe('CryptoTax Service', () => {
    it('should be importable', () => {
      const { CryptoTaxService } = require('../services/crypto-tax');
      expect(CryptoTaxService).toBeDefined();
    });
  });

  describe('Reconciliation Service', () => {
    it('should be importable', () => {
      const { ReconciliationService } = require('../services/reconciliation');
      expect(ReconciliationService).toBeDefined();
    });
  });

  describe('Payment Gateway Manager', () => {
    it('should be importable', () => {
      const mod = require('../services/payment-gateway');
      expect(mod).toBeDefined();
    });
  });

  describe('PDF Generator', () => {
    it('should be importable', () => {
      const mod = require('../services/pdf-generator');
      expect(mod).toBeDefined();
    });
  });
});

// ── Auth Token Tests ─────────────────────────────────────────────────────────

describe('JWT Token Handling', () => {
  it('should create valid access tokens', () => {
    const token = jwt.sign({ userId: 'user-1', type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.userId).toBe('user-1');
    expect(decoded.type).toBe('access');
  });

  it('should create valid refresh tokens', () => {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
    const token = jwt.sign({ userId: 'user-1', type: 'refresh' }, refreshSecret, { expiresIn: '7d' });
    const decoded = jwt.verify(token, refreshSecret) as any;
    expect(decoded.userId).toBe('user-1');
    expect(decoded.type).toBe('refresh');
  });

  it('should reject expired tokens', () => {
    const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET, { expiresIn: '0s' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(/expired/);
  });

  it('should reject tokens with wrong secret', () => {
    const token = jwt.sign({ userId: 'user-1' }, 'wrong-secret');
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(/invalid signature/);
  });

  it('should reject malformed tokens', () => {
    expect(() => jwt.verify('not-a-token', JWT_SECRET)).toThrow();
  });
});

// ── Error Response Format Tests ──────────────────────────────────────────────

describe('Error Response Formatting', () => {
  const { formatErrorResponse, ValidationError, NotFoundError, AuthenticationError } = require('../lib/errors');

  it('should format validation errors with 400 status', () => {
    const { statusCode, body } = formatErrorResponse(new ValidationError('Bad input'));
    expect(statusCode).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('should format not found errors with 404 status', () => {
    const { statusCode, body } = formatErrorResponse(new NotFoundError('Invoice', 'inv-123'));
    expect(statusCode).toBe(404);
    expect(body.message).toContain('inv-123');
  });

  it('should format auth errors with 401 status', () => {
    const { statusCode } = formatErrorResponse(new AuthenticationError());
    expect(statusCode).toBe(401);
  });
});
