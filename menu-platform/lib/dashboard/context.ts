import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getActiveRestaurantId, requireUser } from "@/lib/auth";
import { getRepository } from "@/lib/data";
import type { Category, Locale, LocalizedText, MenuItem, Restaurant } from "@/lib/data/types";
import { ROOT_DOMAIN, publicMenuUrl } from "@/lib/env";

/**
 * Server-side data for dashboard pages. Every function here reads the session (cookies), so call
 * it from a component rendered inside <Suspense>. React cache() dedupes the work per request
 * (the layout shell and the page both ask for the same context).
 */

export interface RestaurantSummary {
  id: string;
  slug: string;
  name: LocalizedText;
  logoUrl: string | null;
  isActive: boolean;
  primary: string;
}

export interface DashboardUser {
  id: string;
  email: string;
  displayName: string | null;
  isPlatformAdmin: boolean;
}

export interface DashboardContext {
  lang: Locale;
  user: DashboardUser;
  /** Restaurant the dashboard shows (null when the user has none). */
  restaurant: Restaurant | null;
  /** Restaurants the user may switch between (all of them for platform admins). */
  restaurants: RestaurantSummary[];
  role: "admin" | "owner" | "staff" | null;
}

const summary = (r: Restaurant): RestaurantSummary => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  logoUrl: r.logoUrl,
  isActive: r.isActive,
  primary: r.theme.primary,
});

export const getDashboardContext = cache(async (lang: Locale): Promise<DashboardContext> => {
  const user = await requireUser(lang);
  const repo = await getRepository("session");
  const memberIds = new Set(user.memberships.map((m) => m.restaurantId));

  const [activeId, all] = await Promise.all([getActiveRestaurantId(user), repo.listRestaurants()]);
  const accessible = user.isPlatformAdmin ? all : all.filter((r) => memberIds.has(r.id));
  const sorted = [...accessible].sort((a, b) => (a.name.en || a.name.ar).localeCompare(b.name.en || b.name.ar));

  let restaurant: Restaurant | null = null;
  if (activeId) restaurant = accessible.find((r) => r.id === activeId) ?? null;
  if (!restaurant && activeId && (user.isPlatformAdmin || memberIds.has(activeId))) {
    restaurant = await repo.getRestaurantById(activeId);
  }
  // Admins without memberships (or a stale cookie): start with the first restaurant.
  if (!restaurant) restaurant = sorted.find((r) => memberIds.has(r.id)) ?? (user.isPlatformAdmin ? sorted[0] : null) ?? null;

  const membership = restaurant ? user.memberships.find((m) => m.restaurantId === restaurant.id) : undefined;
  return {
    lang,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isPlatformAdmin: user.isPlatformAdmin,
    },
    restaurant,
    restaurants: sorted.map(summary),
    role: membership?.role ?? (user.isPlatformAdmin && restaurant ? "admin" : null),
  };
});

/** Categories (all, sorted) and items (all, grouped by category order) of one restaurant. */
export const getMenuData = cache(
  async (restaurantId: string): Promise<{ categories: Category[]; items: MenuItem[] }> => {
    const repo = await getRepository("session");
    const [categories, items] = await Promise.all([repo.listCategories(restaurantId), repo.listItems(restaurantId)]);
    return { categories, items };
  },
);

/**
 * Menu links: `absolute` (copy link), `view` (works on the current host) and `neutral` (no
 * language segment: the platform picks the guest's language; used for QR codes).
 */
export async function menuLinks(
  r: Pick<Restaurant, "slug" | "customDomain">,
  lang: Locale,
): Promise<{ absolute: string; view: string; neutral: string }> {
  let absolute = publicMenuUrl(r.slug, lang, r.customDomain);
  if (!r.customDomain && !ROOT_DOMAIN && !process.env.NEXT_PUBLIC_APP_URL) {
    // No configured origin: use the one the owner is browsing on, so QR codes never say "localhost".
    try {
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host");
      if (host && /^[a-z0-9.:[\]-]+$/i.test(host)) {
        const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(host);
        const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
        absolute = `${proto === "http" ? "http" : "https"}://${host}/${lang}/r/${r.slug}`;
      }
    } catch {
      // Outside a request: keep the configured fallback.
    }
  }
  const view = r.customDomain || ROOT_DOMAIN ? absolute : `/${lang}/r/${r.slug}`;
  const neutral = absolute.replace(/^(https?:\/\/[^/]+)\/(?:ar|en)(?=\/|$)/, "$1") || absolute;
  return { absolute, view, neutral };
}
