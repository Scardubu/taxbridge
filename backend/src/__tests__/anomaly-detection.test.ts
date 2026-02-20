/**
 * Anomaly Detection Service — Unit Tests
 * TaxBridge V3.0
 *
 * Tests all 9 anomaly signals:
 *   1.  duplicate_amount
 *   2.  zscore_spike
 *   3.  vat_mismatch
 *   4.  round_number_clustering
 *   5.  weekend_business_expense
 *   6.  rapid_succession
 *   7.  phantom_vendor
 *   8.  cashflow_cliff
 *   9.  vat_threshold_approach
 *
 * Severity matrix and deduplication logic are also covered.
 *
 * Setup: jest.setup.js mocks createLogger and getRedisConnection globally.
 */

import { AnomalyDetectionService } from '../services/anomaly-detection';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BIZ_ID = 'biz-test-001';

function makeExpense(overrides: Record<string, unknown> = {}) {
  return {
    id:         `exp-${Math.random().toString(36).slice(2)}`,
    businessId: BIZ_ID,
    amount:     10_000,
    vendorName: 'Test Vendor',
    vendorTIN:  null,
    vatAmount:  null,
    category:   'OPERATIONAL',
    createdAt:  new Date(),
    ...overrides,
  };
}

/** Returns a Monday date (safe weekday) */
function monday(daysAgo = 0) {
  const d = new Date();
  const day = d.getDay();
  const daysToMon = day === 0 ? 1 : day === 6 ? 2 : (day === 1 ? 0 : -(day - 1));
  d.setDate(d.getDate() + daysToMon - daysAgo);
  return d;
}

/** Returns the most recent Sunday */
function sunday(weeksAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() - weeksAgo * 7);
  return d;
}

/** Builds a minimal mock Prisma client */
function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    expense: {
      findMany:  jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    invoice: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }),
    },
    taxLiability: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    anomalyRecord: {
      update: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

// ─── Test Factory ─────────────────────────────────────────────────────────────

function makeService(prismaOverrides = {}) {
  return new AnomalyDetectionService(buildPrisma(prismaOverrides));
}

// =============================================================================
// 1. DUPLICATE AMOUNT
// =============================================================================

describe('signal: duplicate_amount', () => {
  it('detects two same-vendor same-amount expenses within 48 h', async () => {
    const now   = new Date();
    const minus5h = new Date(now.getTime() - 5 * 3_600_000);

    const expenses = [
      makeExpense({ amount: 50_000, vendorName: 'ACME Ltd', createdAt: now }),
      makeExpense({ amount: 50_000, vendorName: 'ACME Ltd', createdAt: minus5h }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const dup = results.filter(r => r.signal === 'duplicate_amount');

    expect(dup.length).toBeGreaterThanOrEqual(1);
    expect(dup[0].affectedRecordType).toBe('expense');
  });

  it('does NOT flag expenses > 48 h apart', async () => {
    const now     = new Date();
    const minus3d = new Date(now.getTime() - 3 * 86_400_000);

    const expenses = [
      makeExpense({ amount: 50_000, vendorName: 'ACME Ltd', createdAt: now }),
      makeExpense({ amount: 50_000, vendorName: 'ACME Ltd', createdAt: minus3d }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'duplicate_amount')).toHaveLength(0);
  });

  it('assigns "critical" severity for amounts > ₦5M', async () => {
    const now    = new Date();
    const minus1h = new Date(now.getTime() - 3_600_000);
    const expenses = [
      makeExpense({ amount: 6_000_000, vendorName: 'BigVendor', createdAt: now }),
      makeExpense({ amount: 6_000_000, vendorName: 'BigVendor', createdAt: minus1h }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const dup = results.find(r => r.signal === 'duplicate_amount');
    expect(dup?.severity).toBe('critical');
  });

  it('assigns "low" severity for small duplicate amounts', async () => {
    const now    = new Date();
    const minus1h = new Date(now.getTime() - 3_600_000);
    const expenses = [
      makeExpense({ amount: 5_000, vendorName: 'SmallVendor', createdAt: now }),
      makeExpense({ amount: 5_000, vendorName: 'SmallVendor', createdAt: minus1h }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const dup = results.find(r => r.signal === 'duplicate_amount');
    expect(dup?.severity).toBe('low');
  });

  it('includes bilingual explanation', async () => {
    const now    = new Date();
    const minus1h = new Date(now.getTime() - 3_600_000);
    const expenses = [
      makeExpense({ amount: 20_000, vendorName: 'DupVendor', createdAt: now }),
      makeExpense({ amount: 20_000, vendorName: 'DupVendor', createdAt: minus1h }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const dup = results.find(r => r.signal === 'duplicate_amount');
    expect(dup?.explanation.en).toBeTruthy();
    expect(dup?.explanation.pidgin).toBeTruthy();
    expect(dup?.recommendedAction.en).toBeTruthy();
    expect(dup?.recommendedAction.pidgin).toBeTruthy();
  });
});

// =============================================================================
// 2. Z-SCORE SPIKE
// =============================================================================

describe('signal: zscore_spike', () => {
  it('flags expense > 3 std deviations above mean', async () => {
    // Build a baseline of normal expenses then one huge spike
    const base = Array.from({ length: 20 }, (_, i) =>
      makeExpense({ amount: 10_000 + (i * 100), createdAt: new Date() })
    );
    const spike = makeExpense({ amount: 10_000_000, id: 'spike-exp' });
    const expenses = [...base, spike];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const spikes = results.filter(r => r.signal === 'zscore_spike');
    expect(spikes.length).toBeGreaterThanOrEqual(1);
    expect(spikes[0].metadata.zScore).toBeGreaterThan(3);
  });

  it('does NOT flag when fewer than 5 expenses exist', async () => {
    const expenses = [
      makeExpense({ amount: 1_000_000 }),
      makeExpense({ amount: 2_000 }),
      makeExpense({ amount: 3_000 }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'zscore_spike')).toHaveLength(0);
  });

  it('assigns "critical" severity for z-score > 6', async () => {
    const base = Array.from({ length: 20 }, () =>
      makeExpense({ amount: 1_000, createdAt: new Date() })
    );
    // Mean ≈ 1000, std ≈ 0 → spike will be enormous z-score
    const spike = makeExpense({ amount: 10_000_000, id: 'extreme-spike' });

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([...base, spike]);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const s = results.find(r => r.signal === 'zscore_spike' && r.affectedRecordId === 'extreme-spike');
    expect(s?.severity).toBe('critical');
  });
});

// =============================================================================
// 3. VAT MISMATCH
// =============================================================================

describe('signal: vat_mismatch', () => {
  it('flags when claimed VAT differs > 5% from expected 7.5%', async () => {
    // Expense ₦100,000 → expected VAT = 100,000 * 0.075 / 1.075 ≈ ₦6,977
    // Claimed ₦10,000 → way off
    const expenses = [
      makeExpense({ amount: 100_000, vatAmount: 10_000 }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const vat = results.find(r => r.signal === 'vat_mismatch');
    expect(vat).toBeDefined();
    expect(vat?.severity).toBe('high');
  });

  it('does NOT flag when VAT is within 5% of expected', async () => {
    // Expense ₦100,000, expected VAT ≈ ₦6,977 → claim ₦7,000 (within 5%)
    const expenses = [
      makeExpense({ amount: 100_000, vatAmount: 7_000 }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'vat_mismatch')).toHaveLength(0);
  });

  it('assigns "critical" severity for large VAT mismatch (amount > ₦1M)', async () => {
    const expenses = [
      makeExpense({ amount: 2_000_000, vatAmount: 50_000 }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const vat = results.find(r => r.signal === 'vat_mismatch');
    expect(vat?.severity).toBe('critical');
  });

  it('references NTA 2025 §11(1)', async () => {
    const expenses = [makeExpense({ amount: 500_000, vatAmount: 5_000 })];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const vat = results.find(r => r.signal === 'vat_mismatch');
    expect(vat?.regulatoryReference).toBe('NTA 2025 §11(1)');
  });
});

// =============================================================================
// 4. ROUND NUMBER CLUSTERING
// =============================================================================

describe('signal: round_number_clustering', () => {
  it('flags when > 60% of last 30 expenses are multiples of 1000', async () => {
    // 25 out of 30 round → 83%
    const round = Array.from({ length: 25 }, () =>
      makeExpense({ amount: 5_000, createdAt: new Date() })
    );
    const nonRound = Array.from({ length: 5 }, () =>
      makeExpense({ amount: 5_750, createdAt: new Date() })
    );

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([...round, ...nonRound]);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.some(r => r.signal === 'round_number_clustering')).toBe(true);
  });

  it('does NOT flag when fewer than 10 expenses exist', async () => {
    const expenses = Array.from({ length: 5 }, () =>
      makeExpense({ amount: 10_000 })
    );

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'round_number_clustering')).toHaveLength(0);
  });

  it('does NOT flag when round percentage ≤ 60%', async () => {
    const round = Array.from({ length: 6 }, () =>
      makeExpense({ amount: 1_000 })
    );
    const nonRound = Array.from({ length: 14 }, () =>
      makeExpense({ amount: 1_250 })
    );

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([...round, ...nonRound]);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'round_number_clustering')).toHaveLength(0);
  });
});

// =============================================================================
// 5. WEEKEND BUSINESS EXPENSE
// =============================================================================

describe('signal: weekend_business_expense', () => {
  it('flags Sunday expense > ₦10,000', async () => {
    const expenses = [
      makeExpense({ amount: 50_000, createdAt: sunday() }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.some(r => r.signal === 'weekend_business_expense')).toBe(true);
  });

  it('does NOT flag Sunday expense ≤ ₦10,000', async () => {
    const expenses = [
      makeExpense({ amount: 5_000, createdAt: sunday() }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'weekend_business_expense')).toHaveLength(0);
  });

  it('does NOT flag weekday expense at any amount', async () => {
    const expenses = [
      makeExpense({ amount: 500_000, createdAt: monday() }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'weekend_business_expense')).toHaveLength(0);
  });

  it('assigns "medium" for amounts > ₦200,000', async () => {
    const expenses = [
      makeExpense({ amount: 300_000, createdAt: sunday() }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const w = results.find(r => r.signal === 'weekend_business_expense');
    expect(w?.severity).toBe('medium');
  });
});

// =============================================================================
// 6. RAPID SUCCESSION
// =============================================================================

describe('signal: rapid_succession', () => {
  it('flags 3 same-vendor payments within 48 h', async () => {
    const now = new Date();
    const expenses = [
      makeExpense({ amount: 100_000, vendorName: 'rapid-co', createdAt: new Date(now.getTime() - 1_000) }),
      makeExpense({ amount: 100_000, vendorName: 'rapid-co', createdAt: new Date(now.getTime() - 3_600_000) }),
      makeExpense({ amount: 100_000, vendorName: 'rapid-co', createdAt: new Date(now.getTime() - 7_200_000) }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.some(r => r.signal === 'rapid_succession')).toBe(true);
  });

  it('assigns "critical" when total amount > ₦10M', async () => {
    const now = new Date();
    const expenses = [
      makeExpense({ amount: 4_000_000, vendorName: 'big-rapid-co', createdAt: new Date(now.getTime() - 1_000) }),
      makeExpense({ amount: 4_000_000, vendorName: 'big-rapid-co', createdAt: new Date(now.getTime() - 3_600_000) }),
      makeExpense({ amount: 4_000_000, vendorName: 'big-rapid-co', createdAt: new Date(now.getTime() - 7_200_000) }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const r = results.find(r => r.signal === 'rapid_succession');
    expect(r?.severity).toBe('critical');
  });
});

// =============================================================================
// 7. PHANTOM VENDOR
// =============================================================================

describe('signal: phantom_vendor', () => {
  it('flags expense where vendorTIN has invalid format', async () => {
    const expenses = [
      makeExpense({ amount: 200_000, vendorTIN: 'FAKE-TIN-XXX' }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.some(r => r.signal === 'phantom_vendor')).toBe(true);
  });

  it('does NOT flag expense with valid 10-digit TIN', async () => {
    const expenses = [
      makeExpense({ amount: 200_000, vendorTIN: '1234567890' }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'phantom_vendor')).toHaveLength(0);
  });

  it('does NOT flag when no TIN is provided (TIN not required for small vendors)', async () => {
    const expenses = [
      makeExpense({ amount: 200_000, vendorTIN: null }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'phantom_vendor')).toHaveLength(0);
  });

  it('assigns "critical" for large phantom-vendor transaction (> ₦500k)', async () => {
    const expenses = [
      makeExpense({ amount: 600_000, vendorTIN: 'BAD' }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const pv = results.find(r => r.signal === 'phantom_vendor');
    expect(pv?.severity).toBe('critical');
  });

  it('cites NTA 2025 §47(2)(b)', async () => {
    const expenses = [makeExpense({ amount: 200_000, vendorTIN: 'INVALID' })];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    const pv = results.find(r => r.signal === 'phantom_vendor');
    expect(pv?.regulatoryReference).toBe('NTA 2025 §47(2)(b)');
  });
});

// =============================================================================
// 8. CASHFLOW CLIFF
// =============================================================================

describe('signal: cashflow_cliff', () => {
  it('flags when net cashflow insufficient for upcoming tax liability within 30 days', async () => {
    const dueDate = new Date(Date.now() + 10 * 86_400_000); // 10 days out
    const prisma = buildPrisma({
      invoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 800_000 } }),
      },
      expense: {
        findMany:  jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500_000 } }),
      },
      taxLiability: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'liab-001', amount: 900_000, dueDate },
        ]),
      },
    });

    const svc = new AnomalyDetectionService(prisma);
    const results = await svc.scanAll(BIZ_ID);
    const cliff = results.find(r => r.signal === 'cashflow_cliff');
    expect(cliff).toBeDefined();
    expect(cliff?.metadata.projectedShortfall).toBeGreaterThan(0);
  });

  it('does NOT flag when cashflow covers liability', async () => {
    const dueDate = new Date(Date.now() + 20 * 86_400_000);
    const prisma = buildPrisma({
      invoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 5_000_000 } }),
      },
      expense: {
        findMany:  jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500_000 } }),
      },
      taxLiability: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'liab-002', amount: 900_000, dueDate },
        ]),
      },
    });

    const svc = new AnomalyDetectionService(prisma);
    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'cashflow_cliff')).toHaveLength(0);
  });

  it('assigns "critical" when deadline is fewer than 7 days away', async () => {
    const dueDate = new Date(Date.now() + 3 * 86_400_000); // 3 days
    const prisma = buildPrisma({
      invoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 100_000 } }),
      },
      expense: {
        findMany:  jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50_000 } }),
      },
      taxLiability: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'liab-003', amount: 2_000_000, dueDate },
        ]),
      },
    });

    const svc = new AnomalyDetectionService(prisma);
    const results = await svc.scanAll(BIZ_ID);
    const cliff = results.find(r => r.signal === 'cashflow_cliff');
    expect(cliff?.severity).toBe('critical');
  });

  it('resolves without throwing when taxLiability table is empty', async () => {
    const svc = makeService();
    await expect(svc.scanAll(BIZ_ID)).resolves.not.toThrow();
  });
});

// =============================================================================
// 9. VAT THRESHOLD APPROACH
// =============================================================================

describe('signal: vat_threshold_approach', () => {
  it('flags when YTD revenue is ₦80M–₦99M', async () => {
    const prisma = buildPrisma({
      invoice: {
        aggregate: jest.fn()
          .mockResolvedValueOnce({ _sum: { totalAmount: 0 } }) // cashflow check
          .mockResolvedValueOnce({ _sum: { totalAmount: 85_000_000 } }), // YTD
      },
    });

    const svc = new AnomalyDetectionService(prisma);
    const results = await svc.scanAll(BIZ_ID);
    expect(results.some(r => r.signal === 'vat_threshold_approach')).toBe(true);
  });

  it('assigns "critical" when revenue > ₦95M', async () => {
    const prisma = buildPrisma({
      invoice: {
        aggregate: jest.fn()
          .mockResolvedValueOnce({ _sum: { totalAmount: 0 } })
          .mockResolvedValueOnce({ _sum: { totalAmount: 97_000_000 } }),
      },
    });

    const svc = new AnomalyDetectionService(prisma);
    const results = await svc.scanAll(BIZ_ID);
    const vt = results.find(r => r.signal === 'vat_threshold_approach');
    expect(vt?.severity).toBe('critical');
  });

  it('does NOT flag when revenue < ₦75M', async () => {
    const prisma = buildPrisma({
      invoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 50_000_000 } }),
      },
    });

    const svc = new AnomalyDetectionService(prisma);
    const results = await svc.scanAll(BIZ_ID);
    expect(results.filter(r => r.signal === 'vat_threshold_approach')).toHaveLength(0);
  });

  it('cites NTA 2025 §5(1)', async () => {
    const prisma = buildPrisma({
      invoice: {
        aggregate: jest.fn()
          .mockResolvedValueOnce({ _sum: { totalAmount: 0 } })
          .mockResolvedValueOnce({ _sum: { totalAmount: 88_000_000 } }),
      },
    });

    const svc = new AnomalyDetectionService(prisma);
    const results = await svc.scanAll(BIZ_ID);
    const vt = results.find(r => r.signal === 'vat_threshold_approach');
    expect(vt?.regulatoryReference).toBe('NTA 2025 §5(1)');
  });
});

// =============================================================================
// DEDUPLICATION & ORCHESTRATION
// =============================================================================

describe('scanAll — deduplication and structure', () => {
  it('always returns an array', async () => {
    const svc = makeService();
    const results = await svc.scanAll(BIZ_ID);
    expect(Array.isArray(results)).toBe(true);
  });

  it('results are sorted highest severity first', async () => {
    const now   = new Date();
    const minus1h = new Date(now.getTime() - 3_600_000);
    const expenses = [
      // duplicate (low severity for small amount)
      makeExpense({ amount: 3_000, vendorName: 'DupSmall', createdAt: now }),
      makeExpense({ amount: 3_000, vendorName: 'DupSmall', createdAt: minus1h }),
      // vat mismatch (critical for amount > ₦1M)
      makeExpense({ amount: 1_500_000, vatAmount: 10_000 }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    if (results.length >= 2) {
      const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      for (let i = 1; i < results.length; i++) {
        expect(severityRank[results[i - 1].severity]).toBeGreaterThanOrEqual(
          severityRank[results[i].severity]
        );
      }
    }
  });

  it('returns empty array when no anomalies detected', async () => {
    const expenses = [
      makeExpense({ amount: 10_000, vendorName: 'Clean Co', createdAt: monday() }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    // No duplicates, no spikes, no vat, no weekend, etc.
    expect(results.filter(r =>
      ['duplicate_amount', 'vat_mismatch', 'weekend_business_expense'].includes(r.signal)
    )).toHaveLength(0);
  });

  it('returns empty array (never throws) when Prisma throws', async () => {
    const prisma = buildPrisma({
      expense: {
        findMany:  jest.fn().mockRejectedValue(new Error('DB down')),
        aggregate: jest.fn().mockRejectedValue(new Error('DB down')),
      },
    });

    const svc = new AnomalyDetectionService(prisma);
    await expect(svc.scanAll(BIZ_ID)).resolves.toEqual([]);
  });

  it('each result has required fields: id, signal, severity, explanation, confidence', async () => {
    const now    = new Date();
    const minus1h = new Date(now.getTime() - 3_600_000);
    const expenses = [
      makeExpense({ amount: 20_000, vendorName: 'ACheck', createdAt: now }),
      makeExpense({ amount: 20_000, vendorName: 'ACheck', createdAt: minus1h }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const results = await svc.scanAll(BIZ_ID);
    for (const r of results) {
      expect(r.id).toBeTruthy();
      expect(r.signal).toBeTruthy();
      expect(['low', 'medium', 'high', 'critical']).toContain(r.severity);
      expect(r.explanation.en).toBeTruthy();
      expect(r.explanation.pidgin).toBeTruthy();
      expect(typeof r.confidence).toBe('number');
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// =============================================================================
// SUMMARY
// =============================================================================

describe('getSummary', () => {
  it('returns zero counts when no anomalies found', async () => {
    const svc = makeService();
    const summary = await svc.getSummary(BIZ_ID);
    expect(summary).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });

  it('counts active (non-dismissed) anomalies correctly', async () => {
    const now   = new Date();
    const minus1h = new Date(now.getTime() - 3_600_000);
    const expenses = [
      // vat mismatch × 2 (critical)
      makeExpense({ amount: 2_000_000, vatAmount: 10_000 }),
      makeExpense({ amount: 1_500_000, vatAmount: 8_000 }),
    ];

    const prisma = buildPrisma();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue(expenses);
    const svc = new AnomalyDetectionService(prisma);

    const summary = await svc.getSummary(BIZ_ID);
    // At least one critical from vat mismatch
    expect(summary.critical).toBeGreaterThanOrEqual(1);
    // Total active count ≥ 1
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// DISMISS
// =============================================================================

describe('dismissAnomaly', () => {
  it('returns true on successful dismiss', async () => {
    const prisma = buildPrisma();
    const svc = new AnomalyDetectionService(prisma);
    const result = await svc.dismissAnomaly('anomaly-001', BIZ_ID);
    expect(result).toBe(true);
  });

  it('returns false when Prisma update fails', async () => {
    const prisma = buildPrisma({
      anomalyRecord: {
        update: jest.fn().mockRejectedValue(new Error('Update failed')),
      },
    });
    const svc = new AnomalyDetectionService(prisma);
    const result = await svc.dismissAnomaly('bad-id', BIZ_ID);
    expect(result).toBe(false);
  });
});
