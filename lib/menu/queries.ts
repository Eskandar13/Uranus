import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { RESTAURANT_LIST_TAG, domainTag, menuTag, menuTagsFor } from "@/lib/cache-tags";
import { getRepository } from "@/lib/data";
import type { PublicMenu } from "@/lib/data/types";

/**
 * Cached public reads for the guest-facing menu (`'use cache'` + cacheTag + cacheLife), using
 * getRepository("public") only (no cookies inside cached scopes).
 *
 * Lifetime: cacheLife("days"). Edits made in the dashboard/admin invalidate immediately through
 * updateTag(menuTagsFor(restaurant)); edits made outside the app (Supabase SQL editor, seed
 * script) show up within a day.
 */

const SLUG_KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DOMAIN_KEY_RE = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/** Decodes and normalizes a route key; returns null for keys that can never match. */
function normalizeKey(raw: string): { kind: "slug" | "domain"; value: string } | null {
  if (typeof raw !== "string" || !raw) return null;
  let key = raw;
  try {
    key = decodeURIComponent(raw);
  } catch {
    // Malformed escape sequence: use the raw value.
  }
  key = key.trim().toLowerCase();
  if (key.includes(".")) {
    const domain = key.replace(/:\d+$/, "").replace(/\.$/, "");
    return domain.length <= 253 && DOMAIN_KEY_RE.test(domain) ? { kind: "domain", value: domain } : null;
  }
  return SLUG_KEY_RE.test(key) ? { kind: "slug", value: key } : null;
}

async function getMenuBySlugCached(slug: string): Promise<PublicMenu | null> {
  "use cache";
  cacheLife("days");
  cacheTag(menuTag(slug), RESTAURANT_LIST_TAG);
  const repo = await getRepository("public");
  const menu = await repo.getPublicMenu(slug);
  if (menu) cacheTag(...menuTagsFor(menu.restaurant));
  return menu;
}

async function getMenuByDomainCached(domain: string): Promise<PublicMenu | null> {
  "use cache";
  cacheLife("days");
  cacheTag(domainTag(domain), RESTAURANT_LIST_TAG);
  const repo = await getRepository("public");
  const restaurant = await repo.getRestaurantByDomain(domain);
  if (!restaurant) return null;
  const menu = await repo.getPublicMenu(restaurant.slug);
  cacheTag(...menuTagsFor(restaurant));
  return menu;
}

/**
 * Menu for a restaurant slug ("demo-cafe") or custom domain ("menu.client.com", URL-encoded
 * or not). Returns null when not found or inactive.
 */
export async function getPublicMenu(slugOrDomain: string): Promise<PublicMenu | null> {
  const key = normalizeKey(slugOrDomain);
  if (!key) return null;
  return key.kind === "domain" ? getMenuByDomainCached(key.value) : getMenuBySlugCached(key.value);
}

/** Slugs of all active restaurants (for generateStaticParams). */
export async function getPublicSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("days");
  cacheTag(RESTAURANT_LIST_TAG);
  const repo = await getRepository("public");
  return repo.listActiveRestaurantSlugs();
}
