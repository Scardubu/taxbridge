/**
 * Nigeria Tax Act 2025 (NTA 2025) — Authoritative Tax Rules
 *
 * Single source of truth for all tax brackets, rates, and constants.
 * Used by backend, mobile, and admin-dashboard.
 *
 * PIT brackets follow the updated Fourth Schedule – Section 58:
 *   0% up to ₦800k, then 15%, 18%, 21%, 23%, 25%.
 */
export interface PITBracket {
    /** Cumulative upper limit of this band (₦). Use Infinity for the top band. */
    limit: number;
    /** Marginal tax rate for income within this band */
    rate: number;
    /** Human-readable label */
    label: string;
}
export declare const PIT_BRACKETS: readonly PITBracket[];
/** Minimum wage (monthly) — determines minimum-tax exemption */
export declare const MINIMUM_WAGE_MONTHLY = 70000;
export declare const MINIMUM_WAGE_ANNUAL: number;
/** Consolidated Relief Allowance (CRA): higher of 1% of gross or ₦200,000 + 20% of gross */
export declare const CRA_FIXED = 200000;
export declare const CRA_PERCENTAGE = 0.2;
export declare const CRA_MIN_PERCENTAGE = 0.01;
/** Rent Relief: lower of ₦500,000 or 20% of annual rent (Section 30(2)) */
export declare const RENT_RELIEF_CAP = 500000;
export declare const RENT_RELIEF_RATE = 0.2;
/** Pension contribution rate (employee portion) */
export declare const PENSION_RATE = 0.08;
/** National Housing Fund rate */
export declare const NHF_RATE = 0.025;
/** Life insurance relief cap: 20% of gross, max 7% of income */
export declare const LIFE_INSURANCE_RELIEF_RATE = 0.2;
export declare const LIFE_INSURANCE_MAX_RATE = 0.07;
/** Standard VAT rate */
export declare const VAT_RATE = 0.075;
/** VAT registration threshold (₦) — mandatory above this annual turnover */
export declare const VAT_REGISTRATION_THRESHOLD = 100000000;
/** VAT-exempt categories */
export declare const VAT_EXEMPT_CATEGORIES: readonly ["medical-services", "pharmaceuticals", "basic-food-items", "books-newspapers", "educational-services", "agricultural-products", "exported-goods"];
export type VATExemptCategory = typeof VAT_EXEMPT_CATEGORIES[number];
/** VAT zero-rated categories */
export declare const VAT_ZERO_RATED: readonly ["exports", "basic-food-items", "books", "medical-services"];
export interface CITTier {
    /** Maximum revenue for this tier (₦). Use Infinity for the top tier. */
    maxRevenue: number;
    /** CIT rate */
    rate: number;
    /** Human-readable label */
    label: string;
}
export declare const CIT_TIERS: readonly CITTier[];
/** Educational Development Tax rate (companies with ≥10 employees) */
export declare const EDT_RATE = 0.02;
export declare const EDT_EMPLOYEE_THRESHOLD = 10;
/** CGT rate on net proceeds */
export declare const CGT_RATE = 0.1;
/** Asset types subject to CGT */
export declare const CGT_ASSET_TYPES: readonly ["crypto", "nfts", "stocks", "bonds", "property", "land", "shares"];
export type CGTAssetType = typeof CGT_ASSET_TYPES[number];
export declare const WHT_RATES: {
    readonly dividend: 0.1;
    readonly interest: 0.1;
    readonly rent: 0.1;
    readonly royalty: 0.1;
    readonly consultancy: 0.1;
    readonly construction: 0.05;
    readonly contractServices: 0.05;
    readonly professionalFees: 0.1;
};
export type WHTType = keyof typeof WHT_RATES;
/** PAYE uses the same PIT brackets applied to employment income */
export declare const PAYE_BRACKETS: readonly PITBracket[];
/** Employer pension contribution rate */
export declare const EMPLOYER_PENSION_RATE = 0.1;
/** Employee pension contribution rate */
export declare const EMPLOYEE_PENSION_RATE = 0.08;
export declare const PENALTY_RATES: {
    /** Under-deduction: 10% base + 5% interest */
    readonly underDeduction: {
        readonly base: 0.1;
        readonly interest: 0.05;
    };
    /** Late remittance: 10% monthly */
    readonly lateRemittance: 0.1;
    /** Late return: ₦25,000 fixed */
    readonly lateReturn: 25000;
    /** Non-remittance: 10% of tax due */
    readonly nonRemittance: 0.1;
    /** Late filing: 5% per month */
    readonly lateFiling: 0.05;
    /** Late payment: 10% per month */
    readonly latePayment: 0.1;
};
export declare const COMPLIANCE_CALENDAR: {
    readonly VAT: {
        readonly frequency: "monthly";
        readonly dueDay: 21;
        readonly description: "VAT Return and Payment";
    };
    readonly PAYE: {
        readonly frequency: "monthly";
        readonly dueDay: 10;
        readonly description: "PAYE Remittance";
    };
    readonly CIT: {
        readonly frequency: "annual";
        readonly dueMonth: 6;
        readonly dueDay: 30;
        readonly description: "Company Income Tax Return";
    };
    readonly WHT: {
        readonly frequency: "monthly";
        readonly dueDay: 21;
        readonly description: "Withholding Tax Remittance";
    };
    readonly PIT: {
        readonly frequency: "annual";
        readonly dueMonth: 3;
        readonly dueDay: 31;
        readonly description: "Personal Income Tax Annual Return";
    };
};
export declare const NTA_2025_RULES: {
    readonly pit: {
        readonly brackets: readonly PITBracket[];
        readonly minimumWageAnnual: number;
        readonly cra: {
            readonly fixed: 200000;
            readonly percentage: 0.2;
            readonly minPercentage: 0.01;
        };
        readonly rentRelief: {
            readonly cap: 500000;
            readonly rate: 0.2;
        };
        readonly pension: 0.08;
        readonly nhf: 0.025;
        readonly lifeInsurance: {
            readonly rate: 0.2;
            readonly maxRate: 0.07;
        };
    };
    readonly vat: {
        readonly rate: 0.075;
        readonly registrationThreshold: 100000000;
        readonly exempt: readonly ["medical-services", "pharmaceuticals", "basic-food-items", "books-newspapers", "educational-services", "agricultural-products", "exported-goods"];
        readonly zeroRated: readonly ["exports", "basic-food-items", "books", "medical-services"];
    };
    readonly cit: {
        readonly tiers: readonly CITTier[];
        readonly edt: {
            readonly rate: 0.02;
            readonly employeeThreshold: 10;
        };
    };
    readonly cgt: {
        readonly rate: 0.1;
        readonly assetTypes: readonly ["crypto", "nfts", "stocks", "bonds", "property", "land", "shares"];
    };
    readonly wht: {
        readonly dividend: 0.1;
        readonly interest: 0.1;
        readonly rent: 0.1;
        readonly royalty: 0.1;
        readonly consultancy: 0.1;
        readonly construction: 0.05;
        readonly contractServices: 0.05;
        readonly professionalFees: 0.1;
    };
    readonly paye: {
        readonly brackets: readonly PITBracket[];
        readonly employerPension: 0.1;
        readonly employeePension: 0.08;
        readonly nhf: 0.025;
    };
    readonly penalties: {
        /** Under-deduction: 10% base + 5% interest */
        readonly underDeduction: {
            readonly base: 0.1;
            readonly interest: 0.05;
        };
        /** Late remittance: 10% monthly */
        readonly lateRemittance: 0.1;
        /** Late return: ₦25,000 fixed */
        readonly lateReturn: 25000;
        /** Non-remittance: 10% of tax due */
        readonly nonRemittance: 0.1;
        /** Late filing: 5% per month */
        readonly lateFiling: 0.05;
        /** Late payment: 10% per month */
        readonly latePayment: 0.1;
    };
    readonly compliance: {
        readonly VAT: {
            readonly frequency: "monthly";
            readonly dueDay: 21;
            readonly description: "VAT Return and Payment";
        };
        readonly PAYE: {
            readonly frequency: "monthly";
            readonly dueDay: 10;
            readonly description: "PAYE Remittance";
        };
        readonly CIT: {
            readonly frequency: "annual";
            readonly dueMonth: 6;
            readonly dueDay: 30;
            readonly description: "Company Income Tax Return";
        };
        readonly WHT: {
            readonly frequency: "monthly";
            readonly dueDay: 21;
            readonly description: "Withholding Tax Remittance";
        };
        readonly PIT: {
            readonly frequency: "annual";
            readonly dueMonth: 3;
            readonly dueDay: 31;
            readonly description: "Personal Income Tax Annual Return";
        };
    };
};
