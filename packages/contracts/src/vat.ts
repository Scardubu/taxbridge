/**
 * Value Added Tax — TaxBridge V13 Sovereign
 * NTA 2025 §11–12
 *
 * C-09: Tax calculations only in packages/contracts/
 * C-22: VAT credit: read from VATCreditBalance — never recompute from transactions
 */

import { VAT_RATE, VAT_REGISTRATION_THRESHOLD } from './constants';

export interface VATInput {
  outputVAT:     number;
  inputVAT:      number;
  creditBalance?: number;
}

export interface VATResult {
  outputVAT:       number;
  inputVAT:        number;
  creditApplied:   number;
  netPayable:      number;
  creditCarryover: number;
}

/**
 * calculateVAT — VAT net payable computation
 *
 * netPayable = max(0, outputVAT - inputVAT - creditBalance)
 * Remaining credit carried forward to next period.
 */
export function calculateVAT(input: VATInput): VATResult {
  const { outputVAT, inputVAT, creditBalance = 0 } = input;

  const gross          = Math.max(0, outputVAT - inputVAT);
  const creditApplied  = Math.min(creditBalance, gross);
  const netPayable     = Math.round(gross - creditApplied);
  const creditCarryover = Math.round(creditBalance - creditApplied);

  return {
    outputVAT,
    inputVAT,
    creditApplied,
    netPayable,
    creditCarryover,
  };
}

/**
 * Check if a business must register for VAT — NTA 2025 §12
 * Registration threshold: annual turnover ≥ ₦25,000,000
 */
export function isMandatoryVATRegistration(annualTurnover: number): boolean {
  return annualTurnover >= VAT_REGISTRATION_THRESHOLD;
}

/**
 * Calculate VAT on a transaction amount.
 * @param amount    Pre-VAT amount
 * @param inclusive If true, `amount` already includes VAT
 */
export function calculateTransactionVAT(
  amount: number,
  inclusive = false,
): { net: number; vatAmount: number; total: number } {
  if (inclusive) {
    const net       = amount / (1 + VAT_RATE);
    const vatAmount = amount - net;
    return { net: Math.round(net), vatAmount: Math.round(vatAmount), total: amount };
  }
  const vatAmount = amount * VAT_RATE;
  return { net: amount, vatAmount: Math.round(vatAmount), total: Math.round(amount + vatAmount) };
}
