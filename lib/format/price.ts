import { CURRENCIES, type CurrencyCode, type CurrencyInfo, type Locale, type Restaurant } from "@/lib/data/types";

/**
 * Price helpers shared by every area (menu, dashboard, admin).
 * Digits are always Latin (0-9) in both languages, as agreed in docs/ARCHITECTURE.md.
 */

const FALLBACK: CurrencyInfo = { code: "USD", symbol: { ar: "$", en: "$" }, decimals: 2 };

export function getCurrency(code: CurrencyCode | null | undefined): CurrencyInfo {
  if (!code) return FALLBACK;
  const upper = code.toUpperCase();
  return CURRENCIES.find((c) => c.code === upper) ?? { code: upper, symbol: { ar: upper, en: upper }, decimals: 2 };
}

const formatters = new Map<string, Intl.NumberFormat>();

function numberFormat(lang: Locale, decimals: number, trim: boolean): Intl.NumberFormat {
  const key = `${lang}:${decimals}:${trim}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-latn" : "en", {
      minimumFractionDigits: trim ? 0 : decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(key, f);
  }
  return f;
}

/** Just the number part, e.g. "2.50" or "32,500" (Latin digits). */
export function formatAmount(amount: number, currencyCode: CurrencyCode, lang: Locale): string {
  const cur = getCurrency(currencyCode);
  const rounded = roundTo(amount, cur.decimals);
  // Whole amounts in 2-decimal currencies read nicer without ".00" only when the menu uses whole prices,
  // so we always keep the currency's decimals for consistency across a menu.
  return numberFormat(lang, cur.decimals, false).format(rounded);
}

/**
 * "$2.50", "32,500 ل.س", "SYP 32,500"... Symbol placement follows the language:
 * symbols like "$" / "€" go before the number in English; Arabic puts the symbol after the number.
 */
export function formatPrice(amount: number, currencyCode: CurrencyCode, lang: Locale): string {
  const cur = getCurrency(currencyCode);
  const num = formatAmount(amount, cur.code, lang);
  const symbol = cur.symbol[lang] || cur.code;
  if (lang === "ar") return `${num} ${symbol}`;
  const isGlyph = symbol.length <= 2 && !/^[A-Z]+$/.test(symbol);
  return isGlyph ? `${symbol}${num}` : `${symbol} ${num}`;
}

export function roundTo(amount: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round((amount + Number.EPSILON) * p) / p;
}

/** True when the restaurant can show prices in a second currency. */
export function hasSecondaryCurrency(
  r: Pick<Restaurant, "secondaryCurrency" | "exchangeRate" | "currency">,
): boolean {
  return Boolean(
    r.secondaryCurrency && r.exchangeRate && r.exchangeRate > 0 && r.secondaryCurrency !== r.currency,
  );
}

/**
 * Converts an amount stored in `restaurant.currency` into `target`.
 * Supports main -> secondary (multiply by exchangeRate) and secondary -> main (divide).
 * Unknown targets return the amount unchanged.
 */
export function convertPrice(
  amount: number,
  restaurant: Pick<Restaurant, "currency" | "secondaryCurrency" | "exchangeRate">,
  target: CurrencyCode,
): number {
  if (target === restaurant.currency) return amount;
  const rate = restaurant.exchangeRate;
  if (target === restaurant.secondaryCurrency && rate && rate > 0) {
    return roundTo(amount * rate, getCurrency(target).decimals);
  }
  return amount;
}

/** Percentage saved by an offer (rounded), or null. */
export function discountPercent(price: number, oldPrice: number | null | undefined): number | null {
  if (!oldPrice || oldPrice <= price || oldPrice <= 0) return null;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}
