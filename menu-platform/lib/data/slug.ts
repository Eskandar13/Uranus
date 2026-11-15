/**
 * Slug helpers shared by the data layer, admin forms and server actions.
 * Pure functions (no server-only imports), safe to use anywhere, including zod schemas.
 */

/** Slugs that would clash with platform routes or subdomains. */
export const RESTAURANT_SLUG_RESERVED = [
  "app",
  "www",
  "admin",
  "api",
  "dashboard",
  "login",
  "auth",
  "r",
  "uploads",
  "static",
  "assets",
  "mail",
  "help",
  "support",
  "status",
  "blog",
  "docs",
] as const;

export const RESERVED_SLUGS: ReadonlySet<string> = new Set<string>(RESTAURANT_SLUG_RESERVED);

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Restaurant slug rule (also the subdomain): lowercase a-z, 0-9 and "-", 3 to 40 characters,
 * no leading or trailing "-". Does NOT check reserved words; use isReservedSlug for that.
 */
export function isValidSlug(slug: string): boolean {
  return (
    typeof slug === "string" &&
    slug.length >= SLUG_MIN_LENGTH &&
    slug.length <= SLUG_MAX_LENGTH &&
    SLUG_RE.test(slug)
  );
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/** Valid and not reserved: what a new restaurant slug must satisfy. */
export function isUsableRestaurantSlug(slug: string): boolean {
  return isValidSlug(slug) && !isReservedSlug(slug);
}

/**
 * Turns any text into a slug candidate: strips accents, lowercases, replaces everything that is
 * not a-z/0-9 with "-", collapses repeats and trims to SLUG_MAX_LENGTH. Arabic-only text returns
 * "" (callers fall back to an id-based slug).
 */
export function slugify(text: string, maxLength: number = SLUG_MAX_LENGTH): string {
  const base = (text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= maxLength) return base;
  return base.slice(0, maxLength).replace(/-+$/g, "");
}

/** Item slug rule: same alphabet as restaurant slugs, 1 to 60 characters. */
export function isValidItemSlug(slug: string): boolean {
  return typeof slug === "string" && slug.length >= 1 && slug.length <= 60 && SLUG_RE.test(slug);
}

/**
 * Picks a unique item slug inside one restaurant: slugify(English name), else slugify(fallback),
 * else "item-<short id>"; appends -2, -3, ... on collisions.
 */
export function uniqueItemSlug(
  name: { ar?: string; en?: string },
  taken: ReadonlySet<string>,
  shortId: string,
): string {
  const base = slugify(name.en ?? "", 50) || `item-${shortId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${shortId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}
