import { computeObligations, type BusinessProfile } from './nrsCompliance';

export interface TaxSimulationResult {
  obligations: ReturnType<typeof computeObligations>;
  monthlyVATExposure: number;
  quarterlyIncomeReserve: number;
}

export function simulateTaxPosition(profile: BusinessProfile): TaxSimulationResult {
  const obligations = computeObligations(profile);
  const monthlyVATExposure = profile.annualTurnover * 0.075 / 12;
  const quarterlyIncomeReserve = obligations.annualTaxBurden / 4;

  return {
    obligations,
    monthlyVATExposure,
    quarterlyIncomeReserve,
  };
}
