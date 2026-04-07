export interface TaxEngineInput {
  businessType: string;
  sector: string;
  annualTurnover: number;
  annualProfit?: number;
  employeeCount: number;
  tinVerified: boolean;
  vatRegistered: boolean;
  businessName: string | null;
  periodMonth: number;
  periodYear: number;
  monthlySales?: number;
  monthlyPurchases?: number;
  vatInputCreditsNgn?: number;
  whtTransactions?: WhtTransaction[];
  eInvoiceCompliant?: boolean;
  vatFiledMonthly?: boolean;
  whtRemitted?: boolean;
  citFiled?: boolean;
}

export interface WhtTransaction {
  type: WhtTransactionType;
  amountNgn: number;
}

export type WhtTransactionType =
  | 'dividend' | 'rent' | 'royalty' | 'interest'
  | 'consulting' | 'management_fee' | 'technical_fee'
  | 'contract_supply' | 'director_fee' | 'commission'
  | 'construction' | 'survey' | 'medical_consultancy'
  | 'haulage' | 'telecommunications' | 'oil_gas_supply'
  | 'reinsurance' | 'charter' | 'lease' | 'trademark'
  | 'patent' | 'know_how';

export type EInvoicePhase = 'large' | 'medium' | 'small' | 'not_applicable';

export interface TaxCalculationResult {
  vatRequired: boolean;
  vatOutputNgn: number;
  vatInputCreditsNgn: number;
  vatNetPayableNgn: number;
  vatFilingDueDate: string | null;
  vatNilReturn: boolean;
  citRate: number;
  citBand: 'small' | 'medium' | 'large';
  citExempt: boolean;
  citEstimatedNgn: number;
  whtBreakdown: WhtLineItem[];
  whtTotalNgn: number;
  eInvoicePhase: EInvoicePhase;
  eInvoiceEnforcementDate: string;
  pitRequired: boolean;
  pitZeroBandNgn: number;
  complianceScore: number;
  scoreBrackets: ScoreBracket[];
  nextFilingDate: string | null;
  nextFilingType: string | null;
}

export interface WhtLineItem {
  type: WhtTransactionType;
  rate: number;
  amountNgn: number;
  whtNgn: number;
}

export interface ScoreBracket {
  factor: string;
  points: number;
  earned: number;
  met: boolean;
}
