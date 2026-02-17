/**
 * TaxBridge Backend Constants
 * Centralized constants for tax calculations, compliance, and business logic
 * 
 * Tax rates are re-exported from @taxbridge/contracts (canonical source of truth).
 * Backend-specific constants (UBL, API, etc.) are defined here.
 * 
 * @module constants
 */

// =============================================================================
// TAX RATES — Re-exported from canonical contracts (single source of truth)
// =============================================================================

import {
  VAT_RATE as _VAT_RATE,
  CIT_TIERS,
  VAT_REGISTRATION_THRESHOLD,
} from '@taxbridge/contracts';

/** @see Nigeria Tax Act 2025, Section 46 */
export const VAT_RATE = _VAT_RATE;

/** VAT Rate as Percentage (for display) */
export const VAT_RATE_PERCENT = _VAT_RATE * 100;

/**
 * CIT (Companies Income Tax) Rates — derived from canonical CIT_TIERS
 * @see Nigeria Tax Act 2025, Section 40/90
 */
export const CIT_RATES = {
  SMALL: CIT_TIERS[0].rate,
  MEDIUM: CIT_TIERS[1].rate,
  STANDARD: CIT_TIERS[2].rate,
  SMALL_THRESHOLD: CIT_TIERS[0].maxRevenue,
  MEDIUM_THRESHOLD: CIT_TIERS[1].maxRevenue,
  /** @deprecated Use SMALL_THRESHOLD instead */
  EXEMPTION_THRESHOLD: CIT_TIERS[0].maxRevenue,
} as const;

/** @see Nigeria Tax Act 2025, Section 80 */
export const VAT_THRESHOLD = VAT_REGISTRATION_THRESHOLD;

// =============================================================================
// CURRENCY & LOCALIZATION
// =============================================================================

/**
 * Nigerian Naira ISO Currency Code
 * @const {string} CURRENCY_CODE - ISO 4217 code for Nigeria
 */
export const CURRENCY_CODE = 'NGN';

/**
 * Nigerian Country Code
 * @const {string} COUNTRY_CODE - ISO 3166-1 alpha-2 code
 */
export const COUNTRY_CODE = 'NG';

// =============================================================================
// UBL & PEPPOL COMPLIANCE
// =============================================================================

/**
 * UBL Version
 * @const {string} UBL_VERSION - UBL 2.1 specification
 */
export const UBL_VERSION = '2.1';

/**
 * Peppol BIS Billing 3.0 CustomizationID
 * @const {string} PEPPOL_CUSTOMIZATION_ID
 */
export const PEPPOL_CUSTOMIZATION_ID =
  'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';

/**
 * Peppol BIS Billing Profile ID
 * @const {string} PEPPOL_PROFILE_ID
 */
export const PEPPOL_PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

/**
 * Peppol Endpoint ID scheme (ISO 6523)
 * @const {string} PEPPOL_ENDPOINT_SCHEME - 0199 (GS1)
 */
export const PEPPOL_ENDPOINT_SCHEME = '0199';

/**
 * Party Identification scheme for Nigeria TIN
 * @const {string} PARTY_ID_SCHEME_TIN
 */
export const PARTY_ID_SCHEME_TIN = 'TIN';

/**
 * Invoice Type Code (Commercial Invoice)
 * @const {string} INVOICE_TYPE_CODE - UNCL 1001 code 380
 */
export const INVOICE_TYPE_CODE = '380';

/**
 * Tax Category Code (Standard Rate)
 * @const {string} TAX_CATEGORY_STANDARD
 */
export const TAX_CATEGORY_STANDARD = 'S';

/**
 * Tax Scheme ID
 * @const {string} TAX_SCHEME_VAT
 */
export const TAX_SCHEME_VAT = 'VAT';

/**
 * Unit Code (Unit)
 * @const {string} UNIT_CODE - UN/ECE Recommendation 20 code C62
 */
export const UNIT_CODE = 'C62';

// =============================================================================
// BUSINESS LOGIC CONSTANTS
// =============================================================================

/**
 * Default customer name for cash sales
 * @const {string} DEFAULT_CASH_CUSTOMER
 */
export const DEFAULT_CASH_CUSTOMER = 'Cash Customer';

/**
 * NRS Mock Reference Prefix
 * @const {string} NRS_MOCK_PREFIX - Used in development/staging
 */
export const NRS_MOCK_PREFIX = 'NRS-MOCK';

/**
 * Invoice ID Prefix
 * @const {string} INVOICE_ID_PREFIX
 */
export const INVOICE_ID_PREFIX = 'INV';

// =============================================================================
// VALIDATION THRESHOLDS
// =============================================================================

/**
 * Maximum invoice line items
 * @const {number} MAX_INVOICE_LINES
 */
export const MAX_INVOICE_LINES = 1000;

/**
 * Maximum invoice amount (₦100M for anti-fraud)
 * @const {number} MAX_INVOICE_AMOUNT
 */
export const MAX_INVOICE_AMOUNT = 100_000_000;

/**
 * Minimum invoice amount (₦1)
 * @const {number} MIN_INVOICE_AMOUNT
 */
export const MIN_INVOICE_AMOUNT = 1;

// =============================================================================
// TIMEOUT & RETRY SETTINGS
// =============================================================================

/**
 * Default API timeout (30 seconds)
 * @const {number} DEFAULT_API_TIMEOUT
 */
export const DEFAULT_API_TIMEOUT = 30000;

/**
 * Queue job retry attempts
 * @const {number} DEFAULT_RETRY_ATTEMPTS
 */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/**
 * Queue job retry backoff (exponential)
 * @const {number} DEFAULT_RETRY_BACKOFF
 */
export const DEFAULT_RETRY_BACKOFF = 1000;

// =============================================================================
// FEATURE FLAGS
// =============================================================================

/**
 * Feature flag names
 */
export const FEATURE_FLAGS = {
  DEVICE_SYNC: 'FEATURE_DEVICE_SYNC',
  OCR_ENABLED: 'FEATURE_OCR',
  USSD_ENABLED: 'FEATURE_USSD',
  SMS_ENABLED: 'FEATURE_SMS',
  CHATBOT_ENABLED: 'FEATURE_CHATBOT',
} as const;

// =============================================================================
// HTTP STATUS CODES (commonly used)
// =============================================================================

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// =============================================================================
// TYPE EXPORTS (for type safety)
// =============================================================================

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;
export type HTTPStatusCode = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
