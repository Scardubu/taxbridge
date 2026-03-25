import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ngnCurrencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const compactNumberFormatter = new Intl.NumberFormat('en-NG', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const percentFormatter = new Intl.NumberFormat('en-NG', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

/**
 * Safely format a date value to a locale string.
 * Returns `fallback` (default '—') if the value is null, undefined, empty, or unparseable.
 */
export function safeDate(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = '—'
): string {
  if (value == null || value === '') return fallback;
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return fallback;
  return options ? d.toLocaleString('en-NG', options) : d.toLocaleString();
}

export function formatCurrencyNGN(value: number | null | undefined, fallback = '₦0'): string {
  if (value == null || Number.isNaN(value)) return fallback
  return ngnCurrencyFormatter.format(value)
}

export function formatCompactNumber(value: number | null | undefined, fallback = '0'): string {
  if (value == null || Number.isNaN(value)) return fallback
  return compactNumberFormatter.format(value)
}

export function formatPercentValue(value: number | null | undefined, fallback = '—'): string {
  if (value == null || Number.isNaN(value)) return fallback
  return `${percentFormatter.format(value)}%`
}
