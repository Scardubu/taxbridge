/**
 * Withholding Tax — TaxBridge V13 Sovereign
 * NTA 2025 §78
 *
 * C-09: Tax calculations only in packages/contracts/
 * C-23: WHT exemption requires BOTH conditions simultaneously:
 *   (a) Valid counterparty TIN on file
 *   (b) Total payments to that party ≤ ₦2,000,000 in that calendar month
 *
 * Decision tree:
 *   Professional / consultancy fees  → 10%  ← ⚠️ Most common dev error (NOT 5%)
 *   Dividends / Interest / Royalties → 10%
 *   Rent (commercial)                → 10%
 *   Agency commissions               → 10%
 *   Construction / contracts only    →  5%  ← only this category
 *   Non-resident (no NRS WHT)        →  4%  flat
 */

import { WHT_RATES, WHT_MONTHLY_EXEMPTION_CAP, type WHTCategory } from './constants';

export interface WHTInput {
  amount:   number;
  category: WHTCategory;
  /** Whether counterparty has a valid TIN on file */
  hasTIN?:  boolean;
  /** Total payments to this counterparty this calendar month (including this transaction) */
  monthlyTotal?: number;
}

export interface WHTResult {
  amount:        number;
  category:      WHTCategory;
  rate:          number;
  whtAmount:     number;
  netPayable:    number;
  exempt:        boolean;
  exemptReason?: string;
}

/**
 * calculateWHT — WHT decision tree per NTA 2025 §78
 *
 * Exemption requires BOTH (a) AND (b) simultaneously (C-23):
 *   (a) hasTIN === true
 *   (b) monthlyTotal ≤ WHT_MONTHLY_EXEMPTION_CAP (₦2,000,000)
 */
export function calculateWHT(input: WHTInput): WHTResult {
  const { amount, category, hasTIN = false, monthlyTotal = Infinity } = input;
  const rate = WHT_RATES[category];

  // C-23: Both conditions must be simultaneously true
  const withinMonthlyLimit = monthlyTotal <= WHT_MONTHLY_EXEMPTION_CAP;
  const exempt = hasTIN && withinMonthlyLimit;

  let exemptReason: string | undefined;
  if (hasTIN && !withinMonthlyLimit) {
    exemptReason = undefined; // not exempt — monthly limit exceeded
  } else if (!hasTIN && withinMonthlyLimit) {
    exemptReason = undefined; // not exempt — no TIN
  } else if (exempt) {
    exemptReason = 'Valid TIN + monthly total ≤ ₦2,000,000';
  }

  const whtAmount  = exempt ? 0 : Math.round(amount * rate);
  const netPayable = amount - whtAmount;

  return { amount, category, rate, whtAmount, netPayable, exempt, exemptReason };
}
