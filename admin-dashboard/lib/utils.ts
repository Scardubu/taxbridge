import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
