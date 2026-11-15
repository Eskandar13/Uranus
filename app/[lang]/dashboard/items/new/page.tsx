import { Suspense } from "react";
import type { Metadata } from "next";
import { ItemEditor } from "@/components/dashboard/items/item-editor";
import { NoRestaurant } from "@/components/dashboard/no-restaurant";
import { EditorSkeleton } from "@/components/dashboard/skeletons";
import { getDashboardContext, getMenuData } from "@/lib/dashboard/context";
import { editorBrand } from "@/lib/dashboard/editor-data";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/items/new">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "dashboard");
  return { title: t.meta.newItem };
}

export default function NewItemPage({ params, searchParams }: PageProps<"/[lang]/dashboard/items/new">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewItemLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function NewItemLoader({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/dashboard/items/new">["params"];
  searchParams: PageProps<"/[lang]/dashboard/items/new">["searchParams"];
}) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : "ar";
  const ctx = await getDashboardContext(lang);
  const r = ctx.restaurant;
  if (!r) return <NoRestaurant isAdmin={ctx.user.isPlatformAdmin} />;
  const { categories } = await getMenuData(r.id);
  return (
    <ItemEditor
      key={`new-${r.id}`}
      restaurantId={r.id}
      currency={r.currency}
      categories={categories}
      item={null}
      defaultCategoryId={typeof sp.category === "string" ? sp.category : null}
      brand={editorBrand(r)}
    />
  );
}
