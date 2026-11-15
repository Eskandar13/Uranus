import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { DetailSkeleton } from "@/components/admin/admin-skeletons";
import { DangerZone, EditMenuButton, MembersPanel, PlatformSettingsForm } from "@/components/admin/restaurant-settings";
import { PageHeader, RestaurantAvatar } from "@/components/admin/shared";
import { SLUG_PLACEHOLDER } from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/auth";
import { getRepository } from "@/lib/data";
import { publicMenuUrl } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fmt, isLocale, pick, type Locale } from "@/lib/i18n/config";

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/[id]">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "admin");
  return { title: t.detail.metaTitle };
}

/** /[lang]/admin/[id]: plan, live switch, address, custom domain, owners, delete. */
export default async function RestaurantAdminPage({ params }: PageProps<"/[lang]/admin/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <RestaurantDetail params={params} />
    </Suspense>
  );
}

async function RestaurantDetail({ params }: { params: PageProps<"/[lang]/admin/[id]">["params"] }) {
  const { lang: raw, id } = await params;
  const lang: Locale = isLocale(raw) ? raw : "ar";
  await requirePlatformAdmin(lang);
  if (!UUID_LIKE.test(id)) notFound();

  const repo = await getRepository("service");
  const [restaurant, t] = await Promise.all([repo.getRestaurantById(id), getDictionary(lang, "admin")]);
  if (!restaurant) notFound();
  const [members, categories, items] = await Promise.all([
    repo.listMembers(id),
    repo.listCategories(id),
    repo.listItems(id),
  ]);

  const name = pick(restaurant.name, lang);
  const other = pick(restaurant.name, lang === "ar" ? "en" : "ar");
  const publicUrl = publicMenuUrl(restaurant.slug, lang, restaurant.customDomain);
  const summary = {
    id: restaurant.id,
    slug: restaurant.slug,
    nameAr: restaurant.name.ar,
    nameEn: restaurant.name.en,
    isActive: restaurant.isActive,
    plan: restaurant.plan,
    customDomain: restaurant.customDomain,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/${lang}/admin`}
        className="mb-4 -ms-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t.detail.back}
      </Link>

      <PageHeader
        eyebrow={
          <div className="mb-3 flex items-center gap-3">
            <RestaurantAvatar name={name} logoUrl={restaurant.logoUrl} color={restaurant.theme.primary} size={56} />
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant={restaurant.isActive ? "secondary" : "outline"}
                className={restaurant.isActive ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}
              >
                {restaurant.isActive ? t.status.active : t.status.suspended}
              </Badge>
              <Badge variant="outline">{t.plans[restaurant.plan]}</Badge>
            </div>
          </div>
        }
        title={name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {other && other !== name ? <span dir="auto">{other}</span> : null}
            <span>{fmt(t.detail.categories, { n: categories.length })}</span>
            <span>{fmt(t.detail.items, { n: items.length })}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" className="h-11 gap-2">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                {t.actions.openMenu}
              </a>
            </Button>
            <EditMenuButton restaurantId={restaurant.id} />
          </>
        }
      />

      <div className="space-y-6">
        <PlatformSettingsForm
          restaurant={summary}
          menuUrlPattern={publicMenuUrl(SLUG_PLACEHOLDER, lang)}
        />
        <MembersPanel restaurantId={restaurant.id} members={members} />
        <DangerZone restaurant={summary} />
      </div>
    </div>
  );
}
