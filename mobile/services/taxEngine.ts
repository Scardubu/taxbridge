import type {
  EInvoicePhase,
  ScoreBracket,
  TaxCalculationResult,
  TaxEngineInput,
  WhtLineItem,
  WhtTransactionType,
} from '../types/taxEngine';

const VAT_REGISTRATION_THRESHOLD_NGN = 25_000_000;
const VAT_RATE = 0.075;
const CIT_SMALL_THRESHOLD = 25_000_000;
const CIT_MEDIUM_THRESHOLD = 100_000_000;
const PIT_ZERO_BAND_NGN = 800_000;
const EINVOICE_LARGE_THRESHOLD = 1_000_000_000;
const EINVOICE_MEDIUM_THRESHOLD = 25_000_000;

const EINVOICE_ENFORCEMENT_DATES: Record<EInvoicePhase, string> = {
  large: '2026-04-01',
  medium: '2026-07-01',
  small: '2027-07-01',
  not_applicable: '9999-01-01',
};

const WHT_RATES: Record<WhtTransactionType, number> = {
  dividend: 0.10,
  rent: 0.10,
  royalty: 0.15,
  interest: 0.10,
  consulting: 0.05,
  management_fee: 0.10,
  technical_fee: 0.10,
  contract_supply: 0.05,
  director_fee: 0.10,
  commission: 0.05,
  construction: 0.05,
  survey: 0.05,
  medical_consultancy: 0.05,
  haulage: 0.05,
  telecommunications: 0.05,
  oil_gas_supply: 0.05,
  reinsurance: 0.10,
  charter: 0.05,
  lease: 0.10,
  trademark: 0.15,
  patent: 0.15,
  know_how: 0.15,
};

function getWhtRate(type: string): number | null {
  return Object.prototype.hasOwnProperty.call(WHT_RATES, type)
    ? WHT_RATES[type as WhtTransactionType]
    : null;
}

/**
 * Compute the mobile tax engine v2 result from a deterministic input payload.
 */
export function computeTaxEngine(input: TaxEngineInput): TaxCalculationResult {
  const vatRequired = input.vatRegistered || input.annualTurnover >= VAT_REGISTRATION_THRESHOLD_NGN;
  const monthlySales = input.monthlySales ?? 0;
  const vatInputCredits = input.vatInputCreditsNgn ?? 0;

  const vatOutputNgn = vatRequired ? Math.round(monthlySales * VAT_RATE) : 0;
  const vatNetPayableNgn = vatRequired ? Math.max(0, vatOutputNgn - vatInputCredits) : 0;
  const vatNilReturn = vatRequired && vatNetPayableNgn === 0;

  const filingMonth = input.periodMonth === 12 ? 1 : input.periodMonth + 1;
  const filingYear = input.periodMonth === 12 ? input.periodYear + 1 : input.periodYear;
  const vatFilingDueDate = vatRequired
    ? `${filingYear}-${String(filingMonth).padStart(2, '0')}-21`
    : null;

  let citBand: 'small' | 'medium' | 'large';
  let citRate: number;

  if (input.annualTurnover <= CIT_SMALL_THRESHOLD) {
    citBand = 'small';
    citRate = 0;
  } else if (input.annualTurnover <= CIT_MEDIUM_THRESHOLD) {
    citBand = 'medium';
    citRate = 0.20;
  } else {
    citBand = 'large';
    citRate = 0.30;
  }

  const citExempt = citRate === 0;
  // Intentional (Blueprint v9 §CIT-decision): estimate CIT only when annualProfit is
  // explicitly provided in the input. If absent, return zero to avoid false precision
  // on unverified profit data. This is the authoritative behaviour for v9.
  const citEstimatedNgn = typeof input.annualProfit === 'number'
    ? Math.round(Math.max(0, input.annualProfit) * citRate)
    : 0;

  const whtBreakdown = (input.whtTransactions ?? []).reduce<WhtLineItem[]>((accumulator, transaction) => {
    const rate = getWhtRate(transaction.type);
    if (rate === null) {
      return accumulator;
    }

    accumulator.push({
      type: transaction.type,
      rate,
      amountNgn: transaction.amountNgn,
      whtNgn: Math.round(transaction.amountNgn * rate),
    });

    return accumulator;
  }, []);

  const whtTotalNgn = whtBreakdown.reduce((sum, lineItem) => sum + lineItem.whtNgn, 0);

  let eInvoicePhase: EInvoicePhase;
  if (input.annualTurnover >= EINVOICE_LARGE_THRESHOLD) {
    eInvoicePhase = 'large';
  } else if (input.annualTurnover >= EINVOICE_MEDIUM_THRESHOLD) {
    eInvoicePhase = 'medium';
  } else if (input.businessType !== 'individual') {
    eInvoicePhase = 'small';
  } else {
    eInvoicePhase = 'not_applicable';
  }

  const eInvoiceCompliant = input.eInvoiceCompliant ?? (eInvoicePhase === 'small' || eInvoicePhase === 'not_applicable');
  const vatFiledMonthly = input.vatFiledMonthly ?? false;
  const whtRemitted = input.whtRemitted ?? (whtTotalNgn === 0 || whtBreakdown.length > 0);
  const citFiled = input.citFiled ?? false;

  const scoreBrackets: ScoreBracket[] = [
    { factor: 'tin_verified', points: 20, earned: input.tinVerified ? 20 : 0, met: input.tinVerified },
    {
      factor: 'vat_registered_if_required',
      points: 20,
      earned: !vatRequired || input.vatRegistered ? 20 : 0,
      met: !vatRequired || input.vatRegistered,
    },
    {
      factor: 'e_invoice_compliant',
      points: 20,
      earned: eInvoiceCompliant ? 20 : 0,
      met: eInvoiceCompliant,
    },
    {
      factor: 'vat_filed_monthly',
      points: 20,
      earned: vatFiledMonthly ? 20 : 0,
      met: vatFiledMonthly,
    },
    {
      factor: 'wht_remitted',
      points: 10,
      earned: whtRemitted ? 10 : 0,
      met: whtRemitted,
    },
    {
      factor: 'cit_filed',
      points: 10,
      earned: citFiled ? 10 : 0,
      met: citFiled,
    },
  ];

  const complianceScore = scoreBrackets.reduce((sum, bracket) => sum + bracket.earned, 0);
  const citDueDate = `${input.periodYear}-06-30`;
  const nextFilingDate = vatRequired ? vatFilingDueDate : (!citExempt ? citDueDate : null);
  const nextFilingType = vatRequired ? 'vat_return' : (!citExempt ? 'cit_return' : null);

  return {
    vatRequired,
    vatOutputNgn,
    vatInputCreditsNgn: vatInputCredits,
    vatNetPayableNgn,
    vatFilingDueDate,
    vatNilReturn,
    citRate,
    citBand,
    citExempt,
    citEstimatedNgn,
    whtBreakdown,
    whtTotalNgn,
    eInvoicePhase,
    eInvoiceEnforcementDate: EINVOICE_ENFORCEMENT_DATES[eInvoicePhase],
    pitRequired: input.employeeCount > 0,
    pitZeroBandNgn: PIT_ZERO_BAND_NGN,
    complianceScore,
    scoreBrackets,
    nextFilingDate,
    nextFilingType,
  };
}
