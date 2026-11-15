import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { RestaurantsSkeleton } from "@/components/admin/admin-skeletons";
import { RestaurantsList } from "@/components/admin/restaurants-list";
import { PageHeader } from "@/components/admin/shared";
import { SLUG_PLACEHOLDER, type RestaurantRow } from "@/components/admin/types";
import { Button } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/auth";
import { getRepository } from "@/lib/data";
import { publicMenuUrl } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/admin">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "admin");
  return { title: t.list.metaTitle };
}

/** /[lang]/admin: every restaurant with owners, item counts and row actions. */
export default async function AdminRestaurantsPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang: raw } = await params;
  const lang = isLocale(raw) ? raw : "ar";
  const t = await getDictionary(lang, "admin");
  return (
    <>
      <PageHeader
        title={t.list.title}
        subtitle={t.list.subtitle}
        actions={
          <Button asChild className="hidden h-11 gap-2 px-4 lg:inline-flex">
            <Link href={`/${lang}/admin/new`}>
              <Plus className="size-4" aria-hidden="true" />
              {t.nav.newRestaurant}
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<RestaurantsSkeleton />}>
        <RestaurantsSection lang={lang} />
      </Suspense>
    </>
  );
}

async function RestaurantsSection({ lang }: { lang: Locale }) {
  await requirePlatformAdmin(lang);
  const repo = await getRepository("service");
  // Two batch queries for the whole list (not two per restaurant).
  const [restaurants, summaries] = await Promise.all([repo.listRestaurants(), repo.listRestaurantSummaries()]);
  const rows: RestaurantRow[] = restaurants.map((r) => {
      const summary = summaries[r.id] ?? { itemCount: 0, memberEmails: [] };
      return {
        id: r.id,
        slug: r.slug,
        nameAr: r.name.ar,
        nameEn: r.name.en,
        logoUrl: r.logoUrl,
        primary: r.theme.primary,
        plan: r.plan,
        isActive: r.isActive,
        customDomain: r.customDomain,
        owners: summary.memberEmails,
        itemCount: summary.itemCount,
        publicUrl: publicMenuUrl(r.slug, lang, r.customDomain),
        createdAt: r.createdAt,
      };
  });
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <RestaurantsList rows={rows} menuUrlPattern={publicMenuUrl(SLUG_PLACEHOLDER, lang)} />;
}
