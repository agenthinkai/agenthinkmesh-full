/**
 * lib/billing/fxService.ts
 *
 * Real-Time FX Conversion Service — AgenThinkMesh V2.2
 *
 * - Fetches rates from exchangerate-api.com (free tier)
 * - Caches rates in-memory for 15 minutes (never calls provider on every transaction)
 * - Base price is always $32.50 USD
 * - Supports KWD, CNY, EUR, USD
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES = ["USD", "KWD", "CNY", "EUR"] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export interface ConvertedPrice {
  /** Converted amount in the target currency, rounded to 4 decimal places. */
  amount: number;
  /** Exchange rate used (USD → targetCurrency). 1 for USD. */
  rate: number;
  /** Timestamp when the rate was fetched from the provider. */
  rateAt: Date;
  /** Source currency (always USD). */
  from: "USD";
  /** Target currency. */
  to: SupportedCurrency;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const BASE_PRICE_USD = 32.50 as const;

const FX_PROVIDER_URL = "https://api.exchangerate-api.com/v4/latest/USD";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ── In-memory cache ───────────────────────────────────────────────────────────

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: Date;
}

let _cache: RateCache | null = null;

async function fetchRates(): Promise<Record<string, number>> {
  const now = new Date();

  // Return cached rates if still fresh
  if (_cache && now.getTime() - _cache.fetchedAt.getTime() < CACHE_TTL_MS) {
    return _cache.rates;
  }

  const res = await fetch(FX_PROVIDER_URL);
  if (!res.ok) {
    throw new Error(`FX provider error: HTTP ${res.status}`);
  }

  const data = await res.json() as { rates?: Record<string, number> };
  if (!data.rates) {
    throw new Error("FX provider returned unexpected response shape");
  }

  _cache = { rates: data.rates, fetchedAt: now };
  return data.rates;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * convertPrice — convert the base $32.50 USD price to a target currency.
 *
 * @example
 *   const result = await convertPrice("KWD");
 *   // { amount: 9.9875, rate: 0.3073, rateAt: Date, from: "USD", to: "KWD" }
 */
export async function convertPrice(targetCurrency: SupportedCurrency): Promise<ConvertedPrice> {
  const rateAt = new Date();

  if (targetCurrency === "USD") {
    return {
      amount: BASE_PRICE_USD,
      rate: 1,
      rateAt,
      from: "USD",
      to: "USD",
    };
  }

  const rates = await fetchRates();
  const rate = rates[targetCurrency];

  if (typeof rate !== "number" || rate <= 0) {
    throw new Error(`FX rate not available for currency: ${targetCurrency}`);
  }

  return {
    amount: parseFloat((BASE_PRICE_USD * rate).toFixed(4)),
    rate,
    rateAt: _cache?.fetchedAt ?? rateAt,
    from: "USD",
    to: targetCurrency,
  };
}

/**
 * convertAmount — convert an arbitrary USD amount to a target currency.
 * Useful for displaying transaction history in local currency.
 */
export async function convertAmount(
  amountUsd: number,
  targetCurrency: SupportedCurrency
): Promise<ConvertedPrice> {
  const rateAt = new Date();

  if (targetCurrency === "USD") {
    return { amount: amountUsd, rate: 1, rateAt, from: "USD", to: "USD" };
  }

  const rates = await fetchRates();
  const rate = rates[targetCurrency];

  if (typeof rate !== "number" || rate <= 0) {
    throw new Error(`FX rate not available for currency: ${targetCurrency}`);
  }

  return {
    amount: parseFloat((amountUsd * rate).toFixed(4)),
    rate,
    rateAt: _cache?.fetchedAt ?? rateAt,
    from: "USD",
    to: targetCurrency,
  };
}

/**
 * clearFxCache — force-expire the in-memory cache (useful in tests).
 */
export function clearFxCache(): void {
  _cache = null;
}
