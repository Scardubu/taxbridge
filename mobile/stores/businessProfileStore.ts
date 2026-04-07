import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { patchBusinessProfile } from '../services/api';

interface BusinessProfile {
  businessName: string;
  tradingName: string;
  tin: string;
  rcNumber: string;
  sector: string;
  businessType: 'sole_trader' | 'partnership' | 'limited_company' | 'ngo' | '';
  annualTurnover: number | null;
  monthlyRevenue: number | null;
  totalFixedAssets: number | null;
  employeeCount: number;
  isVatRegistered: boolean;
  vatNumber: string;
  lga: string;
  state: string;
  phone: string;
  email: string;
  hasValidTIN: boolean;
}

interface Store extends BusinessProfile {
  isHydrated: boolean;
  isDirty: boolean;
  lastSyncedAt: string | null;
  hydrate(): Promise<void>;
  updateField<K extends keyof BusinessProfile>(key: K, val: BusinessProfile[K]): void;
  syncToBackend(): Promise<void>;
  getProfileSnapshot(): Partial<BusinessProfile>;
}

export const useBusinessProfileStore = create<Store>()((set, get) => {
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(async () => {
      const s = get();
      const db = await getDatabase();
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(
          `INSERT OR REPLACE INTO business_profiles (
             id, business_name, trading_name, tin, rc_number, sector, business_type,
             annual_turnover, monthly_revenue, total_fixed_assets, employee_count,
             is_vat_registered, vat_number, lga, state, phone, email, has_valid_tin,
             updated_at)
           VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
          [
            s.businessName,
            s.tradingName,
            s.tin,
            s.rcNumber,
            s.sector,
            s.businessType,
            s.annualTurnover,
            s.monthlyRevenue,
            s.totalFixedAssets,
            s.employeeCount,
            s.isVatRegistered ? 1 : 0,
            s.vatNumber,
            s.lga,
            s.state,
            s.phone,
            s.email,
            s.hasValidTIN ? 1 : 0,
          ]
        );
      });
      void get().syncToBackend();
    }, 800);
  };

  return {
    businessName: '',
    tradingName: '',
    tin: '',
    rcNumber: '',
    sector: '',
    businessType: '',
    annualTurnover: null,
    monthlyRevenue: null,
    totalFixedAssets: null,
    employeeCount: 0,
    isVatRegistered: false,
    vatNumber: '',
    lga: '',
    state: '',
    phone: '',
    email: '',
    hasValidTIN: false,
    isHydrated: false,
    isDirty: false,
    lastSyncedAt: null,
    hydrate: async () => {
      const db = await getDatabase();
      const row = await db.getFirstAsync<any>('SELECT * FROM business_profiles WHERE id = 1');
      if (row) {
        set({
          businessName: row.business_name ?? '',
          tradingName: row.trading_name ?? '',
          tin: row.tin ?? '',
          rcNumber: row.rc_number ?? '',
          sector: row.sector ?? '',
          businessType: row.business_type ?? '',
          annualTurnover: row.annual_turnover ?? null,
          monthlyRevenue: row.monthly_revenue ?? null,
          totalFixedAssets: row.total_fixed_assets ?? null,
          employeeCount: row.employee_count ?? 0,
          isVatRegistered: row.is_vat_registered === 1,
          vatNumber: row.vat_number ?? '',
          lga: row.lga ?? '',
          state: row.state ?? '',
          phone: row.phone ?? '',
          email: row.email ?? '',
          hasValidTIN: row.has_valid_tin === 1,
          isHydrated: true,
        });
      } else {
        set({ isHydrated: true });
      }
    },
    updateField: (key, value) => {
      set((state) => ({
        ...state,
        [key]: value,
        isDirty: true,
      }));
      scheduleFlush();
    },
    syncToBackend: async () => {
      if (!get().isDirty) return;
      try {
        await patchBusinessProfile(get().getProfileSnapshot());
        set({ lastSyncedAt: new Date().toISOString(), isDirty: false });
      } catch {}
    },
    getProfileSnapshot: () => {
      const s = get();
      return {
        businessName: s.businessName,
        tradingName: s.tradingName,
        tin: s.tin,
        rcNumber: s.rcNumber,
        sector: s.sector,
        businessType: s.businessType,
        annualTurnover: s.annualTurnover,
        monthlyRevenue: s.monthlyRevenue,
        totalFixedAssets: s.totalFixedAssets,
        employeeCount: s.employeeCount,
        isVatRegistered: s.isVatRegistered,
        vatNumber: s.vatNumber,
        lga: s.lga,
        state: s.state,
        phone: s.phone,
        email: s.email,
        hasValidTIN: s.hasValidTIN,
      };
    },
  };
});
