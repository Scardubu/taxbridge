/**
 * TaxBridge — NGN Currency Formatting Utilities
 * C-32: Single source of truth for Naira display formatting.
 *
 * Uses Intl.NumberFormat with 'en-NG' locale for consistent
 * currency rendering across the entire mobile app.
 */

const NGN_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NGN_COMPACT_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Format a number as Nigerian Naira (₦).
 *
 * @param amount - The amount in Naira (not kobo).
 * @returns Formatted string, e.g. "₦1,250,000.00"
 */
export function formatNGN(amount: number): string {
  if (!Number.isFinite(amount)) return '₦0.00';
  return NGN_FORMATTER.format(amount);
}

/**
 * Compact Naira display for dashboard cards.
 *
 * @param amount - The amount in Naira.
 * @returns Compact string, e.g. "₦1.3M"
 */
export function formatNGNCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '₦0';
  return NGN_COMPACT_FORMATTER.format(amount);
}

/**
 * Parse a Naira-formatted string back to a number.
 * Strips ₦, commas, and whitespace.
 *
 * @param value - The display string, e.g. "₦1,250,000.00"
 * @returns Numeric value, or 0 if unparseable.
 */
export function parseNGN(value: string): number {
  const cleaned = value.replace(/[₦,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Format kobo amount to Naira display.
 *
 * @param kobo - Amount in kobo (1 Naira = 100 kobo).
 * @returns Formatted Naira string.
 */
export function formatKoboAsNGN(kobo: number): string {
  return formatNGN(kobo / 100);
}
