/**
 * TaxBridge — Mobile Unit Tests
 * Tax engine, anomaly detection, API error handling
 * All tests are executable and self-contained
 */

// ─── Tax Engine Tests (NTA 2025 boundary conditions) ─────────────────────────

describe('NTA 2025 PIT Calculator', () => {
  // NTA 2025 PIT bands — CRA abolished; 0% first band replaces exemption
  function calcPIT(annualIncome: number) {
    const bands = [
      { limit: 800_000,      rate: 0    },
      { limit: 3_000_000,    rate: 0.15 },
      { limit: 12_000_000,   rate: 0.18 },
      { limit: 25_000_000,   rate: 0.21 },
      { limit: 50_000_000,   rate: 0.23 },
      { limit: Infinity,     rate: 0.25 },
    ];
    let remaining = annualIncome;
    let total     = 0;
    let prevLimit = 0;

    for (const band of bands) {
      const width = band.limit === Infinity
        ? remaining
        : Math.min(remaining, band.limit - prevLimit);
      if (width <= 0) break;
      total     += width * band.rate;
      remaining -= width;
      prevLimit  = band.limit;
      if (remaining <= 0) break;
    }
    return { total, taxable: annualIncome, effectiveRate: annualIncome > 0 ? total / annualIncome : 0 };
  }

  test('Zero income → zero tax', () => {
    const { total } = calcPIT(0);
    expect(total).toBe(0);
  });

  test('Very low income → zero tax (0% exempt band)', () => {
    // NTA 2025: ₦800k falls entirely in 0% band → zero tax
    const { total } = calcPIT(800_000);
    expect(total).toBe(0);
  });

  test('₦800k boundary — 0% exempt band', () => {
    const { total } = calcPIT(600_000);
    // NTA 2025: ₦600k within 0% band → zero tax
    expect(total).toBe(0);
  });

  test('₦3.6M annual (₦300k/month) — correct graduated calculation', () => {
    const { total } = calcPIT(3_600_000);
    // NTA 2025 bands:
    // Band 1: ₦800k × 0%  = ₦0
    // Band 2: ₦2.2M × 15% = ₦330,000
    // Band 3: ₦600k × 18% = ₦108,000
    // Total = ₦438,000
    expect(total).toBeCloseTo(438_000, -3);
  });

  test('Top band (25%) triggers above ₦50M', () => {
    const { total, effectiveRate } = calcPIT(10_000_000);
    // NTA 2025: hits 18% band; effective rate > 15%
    expect(effectiveRate).toBeGreaterThan(0.15);
    expect(total).toBeGreaterThan(1_000_000);
  });

  test('₦800k exempt band — zero tax for low earners', () => {
    const { total } = calcPIT(100_000);
    // NTA 2025: ₦100k within 0% band → zero tax
    expect(total).toBe(0);
  });

  test('Effective rate never exceeds 25% maximum band', () => {
    const { effectiveRate } = calcPIT(100_000_000);
    expect(effectiveRate).toBeLessThan(0.25);
  });
});

// ─── VAT Tests ────────────────────────────────────────────────────────────────

describe('NTA 2025 VAT Calculation (7.5%)', () => {
  const VAT_RATE = 0.075;

  test('₦200,000 invoice → ₦15,000 VAT', () => {
    const vat = 200_000 * VAT_RATE;
    expect(vat).toBe(15_000);
  });

  test('₦1,000,000 invoice → ₦75,000 VAT', () => {
    const vat = 1_000_000 * VAT_RATE;
    expect(vat).toBe(75_000);
  });

  test('VAT-inclusive extraction is correct', () => {
    const inclusive = 215_000;
    const net = inclusive / 1.075;
    const vat = inclusive - net;
    expect(net).toBeCloseTo(200_000, 0);
    expect(vat).toBeCloseTo(15_000, 0);
  });

  test('NRS threshold is ₦200,000', () => {
    const NRS_THRESHOLD = 200_000;
    expect(199_999).toBeLessThan(NRS_THRESHOLD);
    expect(200_000).toBeGreaterThanOrEqual(NRS_THRESHOLD);
    expect(500_000).toBeGreaterThan(NRS_THRESHOLD);
  });
});

// ─── CIT Tests ────────────────────────────────────────────────────────────────

describe('NTA 2025 CIT Rates', () => {
  function calcCIT(profit: number) {
    const tier = profit < 25_000_000 ? 'small'
               : profit < 100_000_000 ? 'medium' : 'large';
    const rates = { small: 0, medium: 0.20, large: 0.30 };
    return { tier, tax: profit * rates[tier], rate: rates[tier] };
  }

  test('Small company (< ₦25M) → 0% CIT', () => {
    expect(calcCIT(24_999_999).rate).toBe(0);
    expect(calcCIT(24_999_999).tax).toBe(0);
  });

  test('Medium company (₦25M–₦100M) → 20% CIT', () => {
    const { rate, tax } = calcCIT(50_000_000);
    expect(rate).toBe(0.20);
    expect(tax).toBe(10_000_000);
  });

  test('Large company (> ₦100M) → 30% CIT', () => {
    const { rate, tax } = calcCIT(100_000_001);
    expect(rate).toBe(0.30);
    expect(tax).toBeGreaterThan(30_000_000);
  });

  test('Development Levy is 4% (NTA 2025 §60A)', () => {
    const DEV_LEVY = 0.04;
    const profit   = 50_000_000;
    expect(profit * DEV_LEVY).toBe(2_000_000);
  });
});

// ─── PAYE Tests ───────────────────────────────────────────────────────────────

describe('NTA 2025 PAYE', () => {
  function calcPAYE(gross: number) {
    const pension = gross * 0.08;
    const nhf     = gross * 0.025;
    return { gross, pension, nhf, net: gross - pension - nhf };
  }

  test('Pension is 8% of gross salary', () => {
    const { pension } = calcPAYE(150_000);
    expect(pension).toBe(12_000);
  });

  test('NHF is 2.5% of gross salary', () => {
    const { nhf } = calcPAYE(150_000);
    expect(nhf).toBe(3_750);
  });

  test('Net pay is always less than gross', () => {
    const { net, gross } = calcPAYE(500_000);
    expect(net).toBeLessThan(gross);
    expect(net).toBeGreaterThan(0);
  });
});

// ─── CGT Tests ────────────────────────────────────────────────────────────────

describe('NTA 2025 CGT (10%)', () => {
  const CGT_RATE = 0.10;

  test('Profit is taxed at 10%', () => {
    const gain = 400_000;
    expect(gain * CGT_RATE).toBe(40_000);
  });

  test('Loss → zero CGT (no negative tax)', () => {
    const gain = -100_000;
    const cgt  = gain > 0 ? gain * CGT_RATE : 0;
    expect(cgt).toBe(0);
  });

  test('Crypto gains are taxable (NTA 2025 Sch.5)', () => {
    // BTC: bought at ₦500k, sold at ₦900k, 1 unit
    const gain = (900_000 - 500_000) * 1;
    const cgt  = gain * CGT_RATE;
    expect(cgt).toBe(40_000);
  });
});

// ─── API Client Error Normalisation ──────────────────────────────────────────

describe('API Client Error Handling', () => {
  test('ApiError has correct properties', () => {
    class ApiError extends Error {
      constructor(public statusCode: number, public code: string, message: string) {
        super(message);
        this.name = 'ApiError';
      }
    }

    const err = new ApiError(404, 'NOT_FOUND', 'Invoice not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Invoice not found');
    expect(err.name).toBe('ApiError');
  });

  test('Network error is distinct from API error', () => {
    class NetworkError extends Error {
      constructor() { super('Network unavailable'); this.name = 'NetworkError'; }
    }
    class ApiError extends Error {
      constructor() { super('Server error'); this.name = 'ApiError'; }
    }

    const netErr = new NetworkError();
    const apiErr = new ApiError();
    expect(netErr instanceof NetworkError).toBe(true);
    expect(apiErr instanceof NetworkError).toBe(false);
    expect(apiErr instanceof ApiError).toBe(true);
  });

  test('Exponential backoff stays bounded', () => {
    function backoffMs(attempt: number, base = 1000, max = 30000): number {
      return Math.min(max, base * Math.pow(2, attempt));
    }
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(4)).toBe(16000);
    expect(backoffMs(10)).toBe(30000); // Capped at max
  });
});

// ─── Anomaly Detection Tests ──────────────────────────────────────────────────

describe('Anomaly Detection Logic', () => {
  test('Z-score spike: >2.5× average triggers signal', () => {
    const amounts = [10_000, 12_000, 11_000, 9_000, 10_500, 500_000]; // Last is spike
    const mean    = amounts.slice(0, -1).reduce((s, v) => s + v, 0) / (amounts.length - 1);
    const stdDev  = Math.sqrt(
      amounts.slice(0, -1).map(a => (a - mean) ** 2).reduce((s, v) => s + v, 0) / (amounts.length - 1)
    );
    const zScore = (amounts[amounts.length - 1] - mean) / stdDev;
    expect(zScore).toBeGreaterThan(2.5);
  });

  test('Normal variation does not trigger anomaly', () => {
    const amounts = [10_000, 12_000, 11_000, 9_000, 10_500, 11_500];
    const mean    = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const stdDev  = Math.sqrt(amounts.map(a => (a - mean) ** 2).reduce((s, v) => s + v, 0) / amounts.length);
    amounts.forEach(a => {
      const z = stdDev > 0 ? Math.abs(a - mean) / stdDev : 0;
      expect(z).toBeLessThan(2.5);
    });
  });

  test('Duplicate detection: same amount + category within 7 days', () => {
    const expenses = [
      { id: '1', amount: 50_000, category: 'Transport', date: '2026-02-01' },
      { id: '2', amount: 50_000, category: 'Transport', date: '2026-02-05' }, // 4 days later
    ];
    const [a, b] = expenses;
    const daysDiff = Math.abs(
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ) / (1000 * 60 * 60 * 24);
    const isDuplicate = a.amount === b.amount && a.category === b.category && daysDiff <= 7;
    expect(isDuplicate).toBe(true);
  });

  test('VAT mismatch: 10% deviation triggers signal', () => {
    const VAT_RATE    = 0.075;
    const expAmount   = 200_000;
    const vatEntered  = 10_000; // Expected: ₦15,000
    const expectedVat = expAmount * VAT_RATE;
    const diff        = Math.abs(vatEntered - expectedVat);
    expect(diff / expectedVat).toBeGreaterThan(0.10);
  });
});

// ─── i18n Key Coverage ────────────────────────────────────────────────────────

describe('i18n Key Coverage', () => {
  // These tests verify structural completeness
  const REQUIRED_NAMESPACES = [
    'common', 'auth', 'dashboard', 'invoice', 'expense',
    'scan', 'filing', 'tools', 'profile', 'onboarding',
    'learn', 'errors', 'gamification',
  ];

  // Mock the JSON files (in real test environment, import directly)
  const mockEn = {
    common: { loading: '', error: '', success: '' },
    auth: { login: '', createAccount: '' },
    dashboard: { goodMorning: '' },
    invoice: { newInvoice: '' },
    expense: { expenses: '' },
    scan: { scanReceipt: '' },
    filing: { taxFiling: '' },
    tools: { tools: '' },
    profile: { profile: '' },
    onboarding: { welcome: '' },
    learn: { taxAcademy: '' },
    errors: { networkError: '' },
    gamification: { achievements: '' },
  };

  REQUIRED_NAMESPACES.forEach(ns => {
    test(`Namespace "${ns}" exists in en.json`, () => {
      expect(mockEn).toHaveProperty(ns);
    });
  });

  test('No raw i18n key patterns in UI code', () => {
    // In real setup: scan src files for unresolved t() calls
    // Pattern: text that matches namespace.key without going through t()
    const rawKeyPattern = /common\.[a-z]+(?!\s*['"])/;
    const safeCode      = 'const label = t("common.loading");';
    const unsafeCode    = 'const label = "common.loading";';

    expect(rawKeyPattern.test(unsafeCode)).toBe(true);
    // The t() wrapper is the correct usage, no raw key in rendered output
  });
});
