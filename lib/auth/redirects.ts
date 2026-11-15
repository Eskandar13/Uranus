import type { Locale } from "@/lib/data/types";

/**
 * Open-redirect protection for "?next=" values. Pure functions (no server-only imports).
 * Only same-site relative paths are accepted: "/ar/dashboard" yes; "https://x", "//x", "/\\x",
 * "javascript:" or anything with control characters no.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  const value = next.trim();
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  try {
    const base = "http://internal.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Where to send a user after signing in when there is no usable "next". */
export function homeFor(user: { isPlatformAdmin: boolean; memberships: unknown[] }, lang: Locale): string {
  return user.isPlatformAdmin && user.memberships.length === 0 ? `/${lang}/admin` : `/${lang}/dashboard`;
}

/** A "next" that must stay inside the private areas (avoids bouncing back to the login page). */
export function postLoginPath(next: unknown, user: { isPlatformAdmin: boolean; memberships: unknown[] }, lang: Locale): string {
  const safe = safeNextPath(next);
  if (safe && /^\/(ar|en)\/(dashboard|admin)(\/|\?|#|$)/.test(safe)) {
    // Owners can't use the agency admin; send them to their dashboard instead of a redirect loop.
    if (/^\/(ar|en)\/admin/.test(safe) && !user.isPlatformAdmin) return homeFor(user, lang);
    return safe;
  }
  return homeFor(user, lang);
}
