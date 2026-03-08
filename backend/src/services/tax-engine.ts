/**
 * TaxBridge Tax Engine — Backend Service
 *
 * This file now re-exports the canonical tax implementations from @taxbridge/contracts.
 * All tax calculations are centralized in the contracts package per V13 requirements.
 *
 * Supported tax types: PIT, VAT, CIT, CGT, WHT, PAYE
 */

// Re-export canonical implementations from contracts
export {
  calculatePIT,
  calculateVAT,
  calculateCIT,
  calculateCGT,
  calculateWHT,
  calculatePAYE,
  type PITInput,
  type PITResult,
  type VATInput,
  type VATResult,
  type CITInput,
  type CITResult,
  type CGTInput,
  type CGTResult,
  type WHTInput,
  type WHTResult,
  type PAYEInput,
  type PAYEResult,
} from '@taxbridge/contracts';
