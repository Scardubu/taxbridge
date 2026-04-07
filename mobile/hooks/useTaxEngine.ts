import { useMemo } from 'react';
import type { TaxCalculationResult } from '../types/taxEngine';
import type { BusinessProfile } from '../services/nrsCompliance';
import { computeTaxEngine } from '../services/taxEngine';

type TaxProfile = Partial<BusinessProfile> & {
  businessName?: string;
  employeeCount?: number;
  businessId?: string | null;
};

/**
 * Memoized bridge from UI profile state into the pure tax engine.
 */
export function useTaxEngine(
  profile: TaxProfile | null,
  vatInputCreditsNgn = 0,
): TaxCalculationResult | null {
  return useMemo(() => {
    if (!profile) {
      return null;
    }

    const now = new Date();
    return computeTaxEngine({
      businessType: profile.businessType ?? 'other',
      sector: profile.sector ?? 'other',
      annualTurnover: profile.annualTurnover ?? 0,
      employeeCount: profile.employeeCount ?? 0,
      tinVerified: profile.hasValidTIN ?? false,
      vatRegistered: profile.isVatRegistered ?? false,
      businessName: profile.businessName ?? null,
      periodMonth: now.getMonth() + 1,
      periodYear: now.getFullYear(),
      monthlySales: profile.monthlyRevenue ?? ((profile.annualTurnover ?? 0) / 12),
      vatInputCreditsNgn,
    });
  }, [
    profile?.annualTurnover,
    profile?.businessName,
    profile?.businessType,
    profile?.employeeCount,
    profile?.hasValidTIN,
    profile?.isVatRegistered,
    profile?.monthlyRevenue,
    profile?.sector,
    vatInputCreditsNgn,
  ]);
}
