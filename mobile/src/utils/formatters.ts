/**
 * Shared formatting utilities for mobile screens.
 */

/**
 * Format a number as Nigerian Naira currency string.
 */
export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}₦${Math.abs(amount).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format an ISO date string into a human-readable date.
 */
export function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Format an ISO date string into a short date (e.g. "Feb 10").
 */
export function formatShortDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Format a percentage value (0-1 or 0-100) for display.
 */
export function formatPercent(value: number, alreadyPercent = false): string {
  const pct = alreadyPercent ? value : value * 100;
  return `${pct.toFixed(1)}%`;
}
