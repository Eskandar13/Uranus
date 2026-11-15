import type { Locale, LocalizedText } from "@/lib/data/types";

export type { Locale };

export const locales = ["ar", "en"] as const satisfies readonly Locale[];
export const defaultLocale: Locale = "ar";
/** Cookie remembering the guest's/owner's chosen language. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}

/** Text in the requested language, falling back to the other language when empty. */
export function pick(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return "";
  return (text[locale] || text[otherLocale(locale)] || "").trim();
}

/** Simple "{name}" interpolation for dictionary strings. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
