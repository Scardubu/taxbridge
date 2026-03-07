/**
 * TaxBridge — NGN Currency Formatting Utilities
 * C-32: Single source of truth for Naira display formatting.
 *
 * Uses Intl.NumberFormat with 'en-NG' locale for consistent
 * currency rendering across the entire mobile app.
 *
 * V12: formatNGN supports optional compact mode via opts.compact.
 * ✅ formatNGN(632_400) === "₦632,400"
 * ✅ formatNGN(5_000_000, { compact: true }) === "₦5.0M"
 * ❌ NEVER toLocaleString() — C-32
 */

const NGN_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a number as Nigerian Naira (₦).
 *
 * @param amount  - The amount in Naira (not kobo).
 * @param opts    - Optional flags: { compact?: boolean }
 * @returns Formatted string, e.g. "₦632,400" or "₦5.0M" (compact)
 */
export function formatNGN(amount: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(amount)) return '₦0';
  if (opts?.compact) {
    if (amount >= 1e9) return `₦${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `₦${(amount / 1e6).toFixed(1)}M`;
    if (amount >= 1e3) return `₦${(amount / 1e3).toFixed(1)}K`;
  }
  return NGN_FORMATTER.format(amount);
}

/**
 * Compact Naira display for dashboard cards (convenience wrapper).
 *
 * @param amount - The amount in Naira.
 * @returns Compact string, e.g. "₦1.3M"
 */
export function formatNGNCompact(amount: number): string {
  return formatNGN(amount, { compact: true });
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
