/**
 * Runtime configuration. Everything is optional so the app runs locally with zero setup:
 * without Supabase keys it uses the local JSON store (".data/db.json") and demo accounts.
 */

export type DataMode = "local" | "supabase";

export function getDataMode(): DataMode {
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? "supabase"
    : "local";
}

export const isSupabaseMode = () => getDataMode() === "supabase";

/**
 * Platform root domain for subdomain menus, e.g. "ourmenu.com" -> "demo-cafe.ourmenu.com".
 * Leave empty for path-only links ("/ar/r/demo-cafe"), which is what the Netlify demo uses.
 */
export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").toLowerCase().replace(/^www\./, "");

/** Subdomain that serves the dashboard/admin/landing when ROOT_DOMAIN is set (default "app"). */
export const APP_SUBDOMAIN = (process.env.NEXT_PUBLIC_APP_SUBDOMAIN ?? "app").toLowerCase();

/**
 * Public base URL of the platform (used in emails, QR codes, canonical links). Inlined at build
 * time; on Netlify, next.config.ts fills it from Netlify's site URL when the variable is not set.
 */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Brand name of the platform itself (shown on landing, login, dashboard). */
export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Menuly";

/**
 * Public URL of a restaurant's menu, used for QR codes and "view my menu" links.
 * Subdomain form when ROOT_DOMAIN is set, otherwise the path form on APP_URL.
 */
export function publicMenuUrl(slug: string, lang: "ar" | "en" = "ar", customDomain?: string | null): string {
  if (customDomain) return `https://${customDomain}/${lang}`;
  if (ROOT_DOMAIN) return `https://${slug}.${ROOT_DOMAIN}/${lang}`;
  return `${APP_URL}/${lang}/r/${slug}`;
}
