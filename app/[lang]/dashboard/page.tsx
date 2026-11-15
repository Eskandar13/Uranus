import { Suspense } from "react";
import type { Metadata } from "next";
import { NoRestaurant } from "@/components/dashboard/no-restaurant";
import { Overview } from "@/components/dashboard/overview";
import { OverviewSkeleton } from "@/components/dashboard/skeletons";
import { getDashboardContext, getMenuData, menuLinks } from "@/lib/dashboard/context";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isOnOffer } from "@/lib/menu/filters";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "dashboard");
  return { title: t.meta.overview };
}

export default function OverviewPage({ params }: PageProps<"/[lang]/dashboard">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewLoader params={params} />
    </Suspense>
  );
}

async function OverviewLoader({ params }: { params: PageProps<"/[lang]/dashboard">["params"] }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "ar";
  const ctx = await getDashboardContext(lang);
  const r = ctx.restaurant;
  if (!r) return <NoRestaurant isAdmin={ctx.user.isPlatformAdmin} />;

  const { categories, items } = await getMenuData(r.id);
  const catNames = new Map(categories.map((c) => [c.id, c.name]));
  const links = await menuLinks(r, lang);

  return (
    <Overview
      restaurant={{
        id: r.id,
        name: r.name,
        tagline: r.tagline,
        slug: r.slug,
        logoUrl: r.logoUrl,
        coverUrl: r.coverUrl,
        coverBlur: r.coverBlur,
        isActive: r.isActive,
        plan: r.plan,
        primary: r.theme.primary,
      }}
      userName={ctx.user.displayName}
      menuUrl={links.absolute}
      viewHref={links.view}
      stats={{
        categories: categories.length,
        items: items.length,
        soldOut: items.filter((i) => !i.isAvailable).length,
        offers: items.filter(isOnOffer).length,
      }}
      items={items.map((i) => ({
        id: i.id,
        name: i.name,
        categoryName: catNames.get(i.categoryId) ?? { ar: "", en: "" },
        imageUrl: i.imageUrl,
        imageBlur: i.imageBlur,
        isAvailable: i.isAvailable,
      }))}
    />
  );
}
