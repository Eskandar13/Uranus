import { Suspense } from "react";
import type { Metadata } from "next";
import { MenuManager } from "@/components/dashboard/menu/menu-manager";
import { NoRestaurant } from "@/components/dashboard/no-restaurant";
import { MenuSkeleton } from "@/components/dashboard/skeletons";
import { getDashboardContext, getMenuData } from "@/lib/dashboard/context";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/menu">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "dashboard");
  return { title: t.meta.menu };
}

export default function MenuPage({ params, searchParams }: PageProps<"/[lang]/dashboard/menu">) {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <MenuLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function MenuLoader({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/dashboard/menu">["params"];
  searchParams: PageProps<"/[lang]/dashboard/menu">["searchParams"];
}) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : "ar";
  const ctx = await getDashboardContext(lang);
  const r = ctx.restaurant;
  if (!r) return <NoRestaurant isAdmin={ctx.user.isPlatformAdmin} />;
  const { categories, items } = await getMenuData(r.id);
  const category = typeof sp.category === "string" ? sp.category : null;
  return (
    <MenuManager
      key={r.id}
      restaurantId={r.id}
      currency={r.currency}
      categories={categories}
      items={items}
      initialCategoryId={category}
    />
  );
}
