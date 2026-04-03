/**
 * nrsCompliance.test.ts
 * Blueprint v6 — NRS compliance engine unit tests
 */

import {
  computeObligations,
  EINVOICING_PHASES,
  NRS_RULES,
  TAX_AUTHORITY,
  type BusinessProfile,
} from '../services/nrsCompliance';

const BASE_PROFILE: BusinessProfile = {
  annualTurnover: 0,
  totalFixedAssets: 0,
  sector: 'services',
  businessType: 'limited_company',
  isVatRegistered: false,
  hasValidTIN: true,
};

describe('TAX_AUTHORITY constants', () => {
  test('portal URL points to NRS einvoice portal', () => {
    expect(TAX_AUTHORITY.portalUrl).toBe('https://einvoice.firs.gov.ng');
  });

  test('displayName is NRS (not FIRS)', () => {
    expect(TAX_AUTHORITY.displayName).toBe('NRS');
    expect(TAX_AUTHORITY.displayName).not.toContain('FIRS');
  });
});

describe('EINVOICING_PHASES schedule', () => {
  test('large enforcement date is 1 Apr 2026', () => {
    const d = EINVOICING_PHASES.large.enforcementDate;
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(3); // April
  });

  test('medium enforcement date is 1 Jul 2026', () => {
    const d = EINVOICING_PHASES.medium.enforcementDate;
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(6); // July
  });

  test('small enforcement date is 1 Jul 2027', () => {
    const d = EINVOICING_PHASES.small.enforcementDate;
    expect(d.getUTCFullYear()).toBe(2027);
  });
});

describe('NRS_RULES constants', () => {
  test('VAT rate is 7.5%', () => {
    expect(NRS_RULES.vat.rate).toBe(0.075);
  });

  test('CIT small rate is 0%', () => {
    expect(NRS_RULES.cit.smallRate).toBe(0);
  });

  test('CIT small turnover cap is ₦50M', () => {
    expect(NRS_RULES.cit.smallTurnoverCap).toBe(50_000_000);
  });

  test('PIT zero-tax band is ₦800K', () => {
    expect(NRS_RULES.pit.zeroTaxBand).toBe(800_000);
  });
});

describe('computeObligations — CIT', () => {
  test('₦40M limited company → 0% CIT (small relief)', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 40_000_000 });
    expect(obs.citRate).toBe(0);
    expect(obs.citLiability).toBe(0);
  });

  test('₦80M limited company → 20% CIT', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 80_000_000 });
    expect(obs.citRate).toBe(0.2);
    expect(obs.citLiability).toBeCloseTo(16_000_000);
  });

  test('₦500M limited company → 30% CIT', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 500_000_000 });
    expect(obs.citRate).toBe(0.3);
  });

  test('Sole trader → 0 CIT regardless of turnover (pays PIT instead)', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 200_000_000, businessType: 'sole_trader' });
    expect(obs.citLiability).toBe(0);
    expect(obs.pitLiability).toBeGreaterThan(0);
  });
});

describe('computeObligations — VAT', () => {
  test('₦20M turnover → no VAT registration required', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 20_000_000 });
    expect(obs.vatRegistrationRequired).toBe(false);
  });

  test('₦30M turnover → VAT registration required', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 30_000_000 });
    expect(obs.vatRegistrationRequired).toBe(true);
  });

  test('Already VAT registered → vatRegistrationRequired = true', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 5_000_000, isVatRegistered: true });
    expect(obs.vatRegistrationRequired).toBe(true);
  });

  test('₦80M non-professional → vatFilingExempt = true', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 80_000_000, totalFixedAssets: 100_000_000 });
    expect(obs.vatFilingExempt).toBe(true);
  });

  test('₦150M turnover → vatFilingRequired = true', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 150_000_000 });
    expect(obs.vatFilingRequired).toBe(true);
  });
});

describe('computeObligations — e-invoicing', () => {
  test('₦6B turnover → large phase', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 6_000_000_000 });
    expect(obs.eInvoicingPhase).toBe('large');
  });

  test('₦2B turnover → medium phase', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 2_000_000_000 });
    expect(obs.eInvoicingPhase).toBe('medium');
  });

  test('₦40M turnover → small phase', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 40_000_000 });
    expect(obs.eInvoicingPhase).toBe('small');
    expect(obs.eInvoicingStatus).toBe('VOLUNTARY');
  });

  test('eInvoicingStatus and eInvoicingRequired are present', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 40_000_000 });
    expect(obs).toHaveProperty('eInvoicingRequired');
    expect(obs).toHaveProperty('eInvoicingStatus');
  });
});

describe('computeObligations — compliance score', () => {
  test('Valid TIN contributes 40 points', () => {
    const withTIN = computeObligations({ ...BASE_PROFILE, hasValidTIN: true, annualTurnover: 10_000_000 });
    const noTIN = computeObligations({ ...BASE_PROFILE, hasValidTIN: false, annualTurnover: 10_000_000 });
    expect(withTIN.complianceScore).toBeGreaterThan(noTIN.complianceScore);
  });

  test('Score is between 0 and 100', () => {
    const obs = computeObligations({ ...BASE_PROFILE, annualTurnover: 50_000_000 });
    expect(obs.complianceScore).toBeGreaterThanOrEqual(0);
    expect(obs.complianceScore).toBeLessThanOrEqual(100);
  });
});
