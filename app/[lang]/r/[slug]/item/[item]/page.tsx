import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemPageView } from "@/components/menu/menu-app";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getPublicMenu } from "@/lib/menu/queries";
import { menuJsonLd, menuMetadata } from "@/lib/menu/page-helpers";
import type { PublicMenu } from "@/lib/data/types";

/** Prerender up to 60 dishes per restaurant; the rest render on first visit. Never an empty list. */
/**
 * No item pages are prebuilt: reading the menu at build time creates cache entries that are served
 * stale once after the first owner edit following a deploy. Pages fill on first visit instead
 * (App Shell instantly, then cached). With Cache Components the list cannot be empty.
 */
export async function generateStaticParams() {
  return [{ item: "__none__" }];
}

function findItem(menu: PublicMenu | null, slug: string) {
  // Next already decodes dynamic params; compare directly (item slugs are [a-z0-9-]).
  return menu?.categories.flatMap((c) => c.items).find((i) => i.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/r/[slug]/item/[item]">): Promise<Metadata> {
  const { lang: raw, slug, item: itemSlug } = await params;
  const lang = isLocale(raw) ? raw : "ar";
  const menu = await getPublicMenu(slug);
  const item = findItem(menu, itemSlug);
  if (!menu || !item) return { robots: { index: false } };
  return menuMetadata(menu, lang, await getDictionary(lang, "menu"), item);
}

export default async function ItemPage({ params }: PageProps<"/[lang]/r/[slug]/item/[item]">) {
  const { lang: raw, slug, item: itemSlug } = await params;
  const lang = isLocale(raw) ? raw : "ar";
  const menu = await getPublicMenu(slug);
  const item = findItem(menu, itemSlug);
  if (!menu || !item) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: menuJsonLd(menu, lang, item) }} />
      <ItemPageView menu={menu} itemSlug={item.slug} />
    </>
  );
}
