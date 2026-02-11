"use strict";
/**
 * Nigeria Tax Act 2025 (NTA 2025) — Authoritative Tax Rules
 *
 * Single source of truth for all tax brackets, rates, and constants.
 * Used by backend, mobile, and admin-dashboard.
 *
 * PIT brackets follow the updated Fourth Schedule – Section 58:
 *   0% up to ₦800k, then 15%, 18%, 21%, 23%, 25%.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NTA_2025_RULES = exports.COMPLIANCE_CALENDAR = exports.PENALTY_RATES = exports.EMPLOYEE_PENSION_RATE = exports.EMPLOYER_PENSION_RATE = exports.PAYE_BRACKETS = exports.WHT_RATES = exports.CGT_ASSET_TYPES = exports.CGT_RATE = exports.EDT_EMPLOYEE_THRESHOLD = exports.EDT_RATE = exports.CIT_TIERS = exports.VAT_ZERO_RATED = exports.VAT_EXEMPT_CATEGORIES = exports.VAT_REGISTRATION_THRESHOLD = exports.VAT_RATE = exports.LIFE_INSURANCE_MAX_RATE = exports.LIFE_INSURANCE_RELIEF_RATE = exports.NHF_RATE = exports.PENSION_RATE = exports.RENT_RELIEF_RATE = exports.RENT_RELIEF_CAP = exports.CRA_MIN_PERCENTAGE = exports.CRA_PERCENTAGE = exports.CRA_FIXED = exports.MINIMUM_WAGE_ANNUAL = exports.MINIMUM_WAGE_MONTHLY = exports.PIT_BRACKETS = void 0;
exports.PIT_BRACKETS = [
    { limit: 800_000, rate: 0.00, label: 'Tax-Free (₦0 – ₦800,000)' },
    { limit: 3_000_000, rate: 0.15, label: '15% (₦800,001 – ₦3,000,000)' },
    { limit: 12_000_000, rate: 0.18, label: '18% (₦3,000,001 – ₦12,000,000)' },
    { limit: 25_000_000, rate: 0.21, label: '21% (₦12,000,001 – ₦25,000,000)' },
    { limit: 50_000_000, rate: 0.23, label: '23% (₦25,000,001 – ₦50,000,000)' },
    { limit: Infinity, rate: 0.25, label: '25% (Above ₦50,000,000)' },
];
/** Minimum wage (monthly) — determines minimum-tax exemption */
exports.MINIMUM_WAGE_MONTHLY = 70_000;
exports.MINIMUM_WAGE_ANNUAL = exports.MINIMUM_WAGE_MONTHLY * 12; // ₦840,000
/** Consolidated Relief Allowance (CRA): higher of 1% of gross or ₦200,000 + 20% of gross */
exports.CRA_FIXED = 200_000;
exports.CRA_PERCENTAGE = 0.20;
exports.CRA_MIN_PERCENTAGE = 0.01;
/** Rent Relief: lower of ₦500,000 or 20% of annual rent (Section 30(2)) */
exports.RENT_RELIEF_CAP = 500_000;
exports.RENT_RELIEF_RATE = 0.20;
/** Pension contribution rate (employee portion) */
exports.PENSION_RATE = 0.08;
/** National Housing Fund rate */
exports.NHF_RATE = 0.025;
/** Life insurance relief cap: 20% of gross, max 7% of income */
exports.LIFE_INSURANCE_RELIEF_RATE = 0.20;
exports.LIFE_INSURANCE_MAX_RATE = 0.07;
// =============================================================================
// VAT — Value Added Tax (Section 46 / Section 80)
// =============================================================================
/** Standard VAT rate */
exports.VAT_RATE = 0.075;
/** VAT registration threshold (₦) — mandatory above this annual turnover */
exports.VAT_REGISTRATION_THRESHOLD = 100_000_000;
/** VAT-exempt categories */
exports.VAT_EXEMPT_CATEGORIES = [
    'medical-services',
    'pharmaceuticals',
    'basic-food-items',
    'books-newspapers',
    'educational-services',
    'agricultural-products',
    'exported-goods',
];
/** VAT zero-rated categories */
exports.VAT_ZERO_RATED = [
    'exports',
    'basic-food-items',
    'books',
    'medical-services',
];
exports.CIT_TIERS = [
    { maxRevenue: 25_000_000, rate: 0.00, label: 'Small Company (≤₦25M) — 0%' },
    { maxRevenue: 100_000_000, rate: 0.20, label: 'Medium Company (≤₦100M) — 20%' },
    { maxRevenue: Infinity, rate: 0.30, label: 'Large Company (>₦100M) — 30%' },
];
/** Educational Development Tax rate (companies with ≥10 employees) */
exports.EDT_RATE = 0.02;
exports.EDT_EMPLOYEE_THRESHOLD = 10;
// =============================================================================
// CGT — Capital Gains Tax
// =============================================================================
/** CGT rate on net proceeds */
exports.CGT_RATE = 0.10;
/** Asset types subject to CGT */
exports.CGT_ASSET_TYPES = [
    'crypto',
    'nfts',
    'stocks',
    'bonds',
    'property',
    'land',
    'shares',
];
// =============================================================================
// WHT — Withholding Tax
// =============================================================================
exports.WHT_RATES = {
    dividend: 0.10,
    interest: 0.10,
    rent: 0.10,
    royalty: 0.10,
    consultancy: 0.10,
    construction: 0.05,
    contractServices: 0.05,
    professionalFees: 0.10,
};
// =============================================================================
// PAYE — Pay As You Earn
// =============================================================================
/** PAYE uses the same PIT brackets applied to employment income */
exports.PAYE_BRACKETS = exports.PIT_BRACKETS;
/** Employer pension contribution rate */
exports.EMPLOYER_PENSION_RATE = 0.10;
/** Employee pension contribution rate */
exports.EMPLOYEE_PENSION_RATE = 0.08;
// =============================================================================
// Penalties
// =============================================================================
exports.PENALTY_RATES = {
    /** Under-deduction: 10% base + 5% interest */
    underDeduction: { base: 0.10, interest: 0.05 },
    /** Late remittance: 10% monthly */
    lateRemittance: 0.10,
    /** Late return: ₦25,000 fixed */
    lateReturn: 25_000,
    /** Non-remittance: 10% of tax due */
    nonRemittance: 0.10,
    /** Late filing: 5% per month */
    lateFiling: 0.05,
    /** Late payment: 10% per month */
    latePayment: 0.10,
};
// =============================================================================
// Compliance Calendar
// =============================================================================
exports.COMPLIANCE_CALENDAR = {
    VAT: {
        frequency: 'monthly',
        dueDay: 21,
        description: 'VAT Return and Payment',
    },
    PAYE: {
        frequency: 'monthly',
        dueDay: 10,
        description: 'PAYE Remittance',
    },
    CIT: {
        frequency: 'annual',
        dueMonth: 6,
        dueDay: 30,
        description: 'Company Income Tax Return',
    },
    WHT: {
        frequency: 'monthly',
        dueDay: 21,
        description: 'Withholding Tax Remittance',
    },
    PIT: {
        frequency: 'annual',
        dueMonth: 3,
        dueDay: 31,
        description: 'Personal Income Tax Annual Return',
    },
};
// =============================================================================
// Aggregate export
// =============================================================================
exports.NTA_2025_RULES = {
    pit: {
        brackets: exports.PIT_BRACKETS,
        minimumWageAnnual: exports.MINIMUM_WAGE_ANNUAL,
        cra: { fixed: exports.CRA_FIXED, percentage: exports.CRA_PERCENTAGE, minPercentage: exports.CRA_MIN_PERCENTAGE },
        rentRelief: { cap: exports.RENT_RELIEF_CAP, rate: exports.RENT_RELIEF_RATE },
        pension: exports.PENSION_RATE,
        nhf: exports.NHF_RATE,
        lifeInsurance: { rate: exports.LIFE_INSURANCE_RELIEF_RATE, maxRate: exports.LIFE_INSURANCE_MAX_RATE },
    },
    vat: {
        rate: exports.VAT_RATE,
        registrationThreshold: exports.VAT_REGISTRATION_THRESHOLD,
        exempt: exports.VAT_EXEMPT_CATEGORIES,
        zeroRated: exports.VAT_ZERO_RATED,
    },
    cit: {
        tiers: exports.CIT_TIERS,
        edt: { rate: exports.EDT_RATE, employeeThreshold: exports.EDT_EMPLOYEE_THRESHOLD },
    },
    cgt: {
        rate: exports.CGT_RATE,
        assetTypes: exports.CGT_ASSET_TYPES,
    },
    wht: exports.WHT_RATES,
    paye: {
        brackets: exports.PAYE_BRACKETS,
        employerPension: exports.EMPLOYER_PENSION_RATE,
        employeePension: exports.EMPLOYEE_PENSION_RATE,
        nhf: exports.NHF_RATE,
    },
    penalties: exports.PENALTY_RATES,
    compliance: exports.COMPLIANCE_CALENDAR,
};
