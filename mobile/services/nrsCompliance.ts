export const TAX_AUTHORITY = {
  legalName: 'Nigeria Revenue Service (NRS)',
  displayName: 'NRS',
  portalUrl: 'https://einvoice.firs.gov.ng',
  tinPortal: 'https://apps.firs.gov.ng/tinverification/',
};

export const EINVOICING_PHASES = {
  large: {
    turnoverMin: 5_000_000_000,
    enforcementDate: new Date('2026-04-01'),
    mandatoryDate: new Date('2026-04-01'),
    status: 'ENFORCEMENT_ACTIVE' as const,
  },
  medium: {
    turnoverMin: 1_000_000_000,
    turnoverMax: 5_000_000_000,
    enforcementDate: new Date('2026-07-01'),
    mandatoryDate: new Date('2026-07-01'),
    status: 'ENFORCEMENT_ACTIVE' as const,
  },
  small: {
    turnoverMax: 1_000_000_000,
    enforcementDate: new Date('2027-07-01'),
    mandatoryDate: new Date('2027-07-01'),
    status: 'VOLUNTARY' as const,
  },
};

export const NRS_RULES = {
  vat: {
    rate: 0.075,
    practicalThreshold: 25_000_000,
    filingExemptTurnoverCap: 100_000_000,
    filingExemptAssetCap: 250_000_000,
  },
  cit: {
    smallRate: 0,
    smallTurnoverCap: 50_000_000,
    smallAssetCap: 250_000_000,
    mediumRate: 0.2,
    mediumTurnoverCap: 100_000_000,
    largeRate: 0.3,
  },
  pit: {
    zeroTaxBand: 800_000,
    brackets: [
      { from: 800_000, to: 2_800_000, rate: 0.15 },
      { from: 2_800_000, to: 5_800_000, rate: 0.19 },
      { from: 5_800_000, to: 10_800_000, rate: 0.21 },
      { from: 10_800_000, to: Infinity, rate: 0.24 },
    ],
  },
  wht: { exemptMonthlyThreshold: 2_000_000 },
};

export interface BusinessProfile {
  annualTurnover: number;
  totalFixedAssets: number;
  sector: string;
  businessType: string;
  isVatRegistered: boolean;
  hasValidTIN: boolean;
  monthlyRevenue?: number;
}

export function computeObligations(profile: BusinessProfile) {
  const isProfessional = profile.sector === 'professional_services';
  const isSmallBiz =
    profile.annualTurnover <= 100_000_000 &&
    profile.totalFixedAssets <= 250_000_000 &&
    !isProfessional;
  const isSmallCo =
    profile.annualTurnover <= 50_000_000 &&
    profile.totalFixedAssets <= 250_000_000 &&
    !isProfessional;
  const isSole = ['sole_trader', 'partnership'].includes(profile.businessType);

  const citRate = isSmallCo ? 0 : profile.annualTurnover <= 100_000_000 ? 0.2 : 0.3;
  const citLiability = isSole ? 0 : profile.annualTurnover * citRate;
  const pitLiability = isSole ? computePIT(profile.annualTurnover) : 0;

  const eInvoicingPhase =
    profile.annualTurnover >= 5_000_000_000
      ? 'large'
      : profile.annualTurnover >= 1_000_000_000
        ? 'medium'
        : 'small';
  const phase = EINVOICING_PHASES[eInvoicingPhase];
  const now = new Date();
  const eInvoicingRequired = now >= phase.enforcementDate;
  const eInvoicingMandatory = now >= phase.mandatoryDate;

  return {
    vatRegistrationRequired: profile.annualTurnover > 25_000_000 || profile.isVatRegistered,
    vatFilingRequired: !isSmallBiz || profile.annualTurnover > 100_000_000,
    vatFilingExempt: isSmallBiz && profile.annualTurnover <= 100_000_000,
    citRate,
    citLiability,
    pitLiability,
    whtExemptEligible: profile.hasValidTIN && (profile.monthlyRevenue ?? 0) < 2_000_000,
    eInvoicingPhase: eInvoicingPhase as 'large' | 'medium' | 'small',
    eInvoicingMandatory,
    eInvoicingRequired,
    eInvoicingStatus: phase.status,
    eInvoicingDeadline: phase.mandatoryDate,
    complianceScore: computeScore(profile, eInvoicingMandatory),
    annualTaxBurden: citLiability + pitLiability,
  };
}

function computePIT(income: number): number {
  const taxable = Math.max(0, income - NRS_RULES.pit.zeroTaxBand);
  let tax = 0;
  let remaining = taxable;
  for (const bracket of NRS_RULES.pit.brackets) {
    if (remaining <= 0) break;
    const band = bracket.to === Infinity ? remaining : Math.min(remaining, bracket.to - bracket.from);
    tax += band * bracket.rate;
    remaining -= band;
  }
  return tax;
}

function computeScore(profile: BusinessProfile, eInvoicingMandatory: boolean): number {
  let score = 10;
  if (profile.hasValidTIN) score += 40;
  if (profile.isVatRegistered || profile.annualTurnover <= 25_000_000) score += 30;
  if (!eInvoicingMandatory) score += 20;
  return Math.min(100, score);
}
