/**
 * Currency Converter
 *
 * Centralized EUR exchange rates for all currency conversions.
 * Rates are cached for 24 hours and can be refreshed from external API.
 *
 * Usage:
 * - TypeScript: CurrencyConverter.toEur(amount, 'USD')
 * - SQL queries: Use buildCurrencyRateCase() for CASE statements
 * - Daily update: Call CurrencyConverter.refreshRates() from cron
 */

// Default EUR exchange rates (divide local currency by this to get EUR)
// Example: 100 USD / 1.08 = 92.59 EUR
const DEFAULT_EUR_RATES: Record<string, number> = {
  EUR: 1,
  GBP: 0.84,    // British Pound
  USD: 1.08,    // US Dollar
  RON: 4.97,    // Romanian Leu
  AED: 3.97,    // UAE Dirham
  HUF: 408,     // Hungarian Forint
  CLP: 1020,    // Chilean Peso
  BRL: 6.35,    // Brazilian Real
  UAH: 43.5,    // Ukrainian Hryvnia
  PLN: 4.32,    // Polish Zloty
  CZK: 25.2,    // Czech Koruna
  MXN: 18.5,    // Mexican Peso
  ARS: 900,     // Argentine Peso (volatile)
  COP: 4200,    // Colombian Peso
  PEN: 3.85,    // Peruvian Sol
};

// Current rates (can be updated dynamically)
let eurRates: Record<string, number> = { ...DEFAULT_EUR_RATES };
let lastUpdated: Date | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Export current EUR rates
 */
export const EUR_RATES = new Proxy(eurRates, {
  get(target, prop) {
    return target[prop as string];
  }
});

/**
 * SQL CASE statement for currency conversion in queries
 * @param currencyColumn - The column name containing currency code
 * @returns SQL CASE statement string
 */
export function buildCurrencyRateCase(currencyColumn: string): string {
  const cases = Object.entries(eurRates)
    .map(([code, rate]) => `WHEN '${code}' THEN ${rate}`)
    .join(' ');
  return `CASE ${currencyColumn} ${cases} ELSE 1 END`;
}

/**
 * Pre-built SQL CASE for common use with 'currency_code' column
 */
export function getCurrencyCaseSql(): string {
  return buildCurrencyRateCase('currency_code');
}

/**
 * Currency Converter class for TypeScript conversions
 */
export class CurrencyConverter {
  /**
   * Convert amount from any currency to EUR
   */
  static toEur(amount: number, fromCurrency: string): number {
    const rate = eurRates[fromCurrency] || 1;
    return Math.round((amount / rate) * 100) / 100;
  }

  /**
   * Convert amount from EUR to any currency
   */
  static fromEur(amountEur: number, toCurrency: string): number {
    const rate = eurRates[toCurrency] || 1;
    return Math.round(amountEur * rate * 100) / 100;
  }

  /**
   * Get rate for a currency (how many units per EUR)
   */
  static getRate(currency: string): number {
    return eurRates[currency] || 1;
  }

  /**
   * Check if currency is supported
   */
  static isSupported(currency: string): boolean {
    return currency in eurRates;
  }

  /**
   * Get all supported currencies
   */
  static getSupportedCurrencies(): string[] {
    return Object.keys(eurRates);
  }

  /**
   * Get all current rates
   */
  static getAllRates(): Record<string, number> {
    return { ...eurRates };
  }

  /**
   * Get last update timestamp
   */
  static getLastUpdated(): Date | null {
    return lastUpdated;
  }

  /**
   * Check if rates are stale (older than 24 hours)
   */
  static isStale(): boolean {
    if (!lastUpdated) return true;
    return Date.now() - lastUpdated.getTime() > CACHE_DURATION_MS;
  }

  /**
   * Update rates manually (e.g., from admin panel or config)
   */
  static updateRates(newRates: Record<string, number>): void {
    eurRates = { ...DEFAULT_EUR_RATES, ...newRates };
    lastUpdated = new Date();
    console.log(`[CurrencyConverter] Rates updated at ${lastUpdated.toISOString()}`);
  }

  /**
   * Refresh rates from external API
   * Uses ECB (European Central Bank) reference rates
   * Call this from a daily cron job
   */
  static async refreshRates(): Promise<boolean> {
    try {
      // Free API for exchange rates (no API key required)
      // Uses frankfurter.app which sources from ECB
      const response = await fetch('https://api.frankfurter.app/latest?from=EUR');

      if (!response.ok) {
        console.error(`[CurrencyConverter] API error: ${response.status}`);
        return false;
      }

      const data = await response.json();
      const newRates: Record<string, number> = { EUR: 1 };

      // Convert from "1 EUR = X currency" to "X currency = 1 EUR"
      for (const [code, rate] of Object.entries(data.rates)) {
        newRates[code] = rate as number;
      }

      // Merge with defaults (keep currencies not in API)
      eurRates = { ...DEFAULT_EUR_RATES, ...newRates };
      lastUpdated = new Date();

      console.log(`[CurrencyConverter] Rates refreshed at ${lastUpdated.toISOString()}`);
      console.log(`[CurrencyConverter] Sample rates - USD: ${eurRates.USD}, RON: ${eurRates.RON}, GBP: ${eurRates.GBP}`);

      return true;
    } catch (error) {
      console.error('[CurrencyConverter] Failed to refresh rates:', error);
      return false;
    }
  }

  /**
   * Refresh rates if stale (called automatically when needed)
   */
  static async refreshIfStale(): Promise<void> {
    if (this.isStale()) {
      await this.refreshRates();
    }
  }

  /**
   * Reset to default rates (for testing)
   */
  static resetToDefaults(): void {
    eurRates = { ...DEFAULT_EUR_RATES };
    lastUpdated = null;
  }
}

export default CurrencyConverter;
