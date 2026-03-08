/**
 * Capital Gains Tax — TaxBridge V13 Sovereign
 * NTA 2025 §60–75
 *
 * C-09: Tax calculations only in packages/contracts/
 * CGT is 10% on net capital gains from disposal of chargeable assets.
 */

import { CGT_RATE } from './constants';

export interface CGTInput {
  /** Proceeds from sale/disposal of asset */
  proceeds: number;
  /** Original cost basis of the asset */
  costBasis: number;
  /** Improvement costs (capital expenditure on the asset) */
  improvementCosts?: number;
  /** Incidental costs of acquisition (legal fees, etc.) */
  acquisitionCosts?: number;
  /** Incidental costs of disposal (agent fees, legal fees, etc.) */
  disposalCosts?: number;
  /** Asset type for reporting purposes */
  assetType?: 'shares' | 'property' | 'crypto' | 'other';
}

export interface CGTResult {
  proceeds: number;
  costBasis: number;
  improvementCosts: number;
  acquisitionCosts: number;
  disposalCosts: number;
  totalDeductions: number;
  netGain: number;
  isLoss: boolean;
  taxableGain: number;
  cgtRate: number;
  cgtLiability: number;
  effectiveRate: number;
  assetType: string;
}

/**
 * calculateCGT — Full CGT computation per NTA 2025 §60–75
 *
 * Accuracy gate:
 *   calculateCGT({ proceeds: 10_000_000, costBasis: 6_000_000, improvementCosts: 500_000 })
 *   → cgtLiability === 350_000
 *   (Net gain = 10M - 6M - 500k = 3.5M | CGT = 3.5M × 10% = 350k)
 */
export function calculateCGT(input: CGTInput): CGTResult {
  const {
    proceeds,
    costBasis,
    improvementCosts = 0,
    acquisitionCosts = 0,
    disposalCosts = 0,
    assetType = 'other',
  } = input;

  const totalDeductions = costBasis + improvementCosts + acquisitionCosts + disposalCosts;
  const netGain = proceeds - totalDeductions;
  const isLoss = netGain < 0;
  const taxableGain = Math.max(0, netGain);
  const cgtLiability = Math.round(taxableGain * CGT_RATE);
  const effectiveRate = proceeds > 0 ? cgtLiability / proceeds : 0;

  return {
    proceeds,
    costBasis,
    improvementCosts,
    acquisitionCosts,
    disposalCosts,
    totalDeductions,
    netGain,
    isLoss,
    taxableGain,
    cgtRate: CGT_RATE,
    cgtLiability,
    effectiveRate,
    assetType,
  };
}
