/**
 * Multi-Currency Service (Phase 9)
 *
 * Provides currency conversion, formatting, and exchange rate management
 * for Nigerian businesses dealing with international transactions.
 * Base currency is NGN (Nigerian Naira).
 */

import { createLogger } from '../lib/logger';

const log = createLogger('currency-service');

// =============================================================================
// Types
// =============================================================================

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  source: string;
  timestamp: string;
}

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  rateTimestamp: string;
}

// =============================================================================
// Supported Currencies
// =============================================================================

export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  GHS: { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', decimals: 2 },
  KES: { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  XOF: { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', decimals: 0 },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
};

// =============================================================================
// Default / fallback exchange rates (NGN base)
// Updated periodically; production should use a live API
// =============================================================================

const DEFAULT_RATES_TO_NGN: Record<string, number> = {
  NGN: 1,
  USD: 1550,
  GBP: 1960,
  EUR: 1680,
  GHS: 105,
  KES: 10.5,
  ZAR: 82,
  XOF: 2.56,
  CNY: 213,
};

// =============================================================================
// Service
// =============================================================================

export class CurrencyService {
  private rates: Map<string, ExchangeRate> = new Map();
  private lastFetch: number = 0;
  private cacheDurationMs: number = 3600_000; // 1 hour

  constructor() {
    this.seedDefaultRates();
  }

  /**
   * Seed the rate cache with default/fallback rates.
   */
  private seedDefaultRates(): void {
    const now = new Date().toISOString();
    for (const [code, rateToNgn] of Object.entries(DEFAULT_RATES_TO_NGN)) {
      if (code === 'NGN') continue;
      this.rates.set(`${code}_NGN`, {
        from: code,
        to: 'NGN',
        rate: rateToNgn,
        source: 'default',
        timestamp: now,
      });
      this.rates.set(`NGN_${code}`, {
        from: 'NGN',
        to: code,
        rate: 1 / rateToNgn,
        source: 'default',
        timestamp: now,
      });
    }
    this.lastFetch = Date.now();
  }

  /**
   * Get the exchange rate between two currencies.
   */
  getRate(from: string, to: string): ExchangeRate | null {
    if (from === to) {
      return { from, to, rate: 1, source: 'identity', timestamp: new Date().toISOString() };
    }

    const direct = this.rates.get(`${from}_${to}`);
    if (direct) return direct;

    // Try cross-rate via NGN
    const fromToNgn = this.rates.get(`${from}_NGN`);
    const ngnToTarget = this.rates.get(`NGN_${to}`);
    if (fromToNgn && ngnToTarget) {
      return {
        from,
        to,
        rate: fromToNgn.rate * ngnToTarget.rate,
        source: 'cross-rate',
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Convert an amount between currencies.
   */
  convert(amount: number, from: string, to: string): ConversionResult | null {
    const rate = this.getRate(from, to);
    if (!rate) {
      log.warn('No exchange rate available', { from, to });
      return null;
    }

    const targetInfo = SUPPORTED_CURRENCIES[to];
    const decimals = targetInfo?.decimals ?? 2;
    const convertedAmount = parseFloat((amount * rate.rate).toFixed(decimals));

    return {
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount,
      targetCurrency: to,
      rate: rate.rate,
      rateTimestamp: rate.timestamp,
    };
  }

  /**
   * Format an amount in a given currency for display.
   */
  format(amount: number, currencyCode: string): string {
    const info = SUPPORTED_CURRENCIES[currencyCode];
    if (!info) return `${amount.toFixed(2)} ${currencyCode}`;

    const formatted = amount.toLocaleString('en-NG', {
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    });

    return `${info.symbol}${formatted}`;
  }

  /**
   * Update exchange rates from an external source.
   * In production, this would call a rates API (e.g. Open Exchange Rates, CBN).
   */
  async refreshRates(): Promise<void> {
    // Placeholder: in production, fetch from an API
    // For now, just refresh the timestamp on default rates
    log.info('Refreshing exchange rates (using defaults)');
    this.seedDefaultRates();
  }

  /**
   * List all supported currencies.
   */
  listCurrencies(): CurrencyInfo[] {
    return Object.values(SUPPORTED_CURRENCIES);
  }

  /**
   * List all available exchange rates.
   */
  listRates(): ExchangeRate[] {
    return Array.from(this.rates.values());
  }

  /**
   * Check if a currency code is supported.
   */
  isSupported(code: string): boolean {
    return code in SUPPORTED_CURRENCIES;
  }
}

// Singleton
export const currencyService = new CurrencyService();
