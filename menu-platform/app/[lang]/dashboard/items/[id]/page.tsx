import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemEditor } from "@/components/dashboard/items/item-editor";
import { NoRestaurant } from "@/components/dashboard/no-restaurant";
import { EditorSkeleton } from "@/components/dashboard/skeletons";
import { getDashboardContext, getMenuData } from "@/lib/dashboard/context";
import { editorBrand } from "@/lib/dashboard/editor-data";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/items/[id]">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "dashboard");
  return { title: t.meta.editItem };
}

export default function EditItemPage({ params }: PageProps<"/[lang]/dashboard/items/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditItemLoader params={params} />
    </Suspense>
  );
}

async function EditItemLoader({ params }: { params: PageProps<"/[lang]/dashboard/items/[id]">["params"] }) {
  const { lang: raw, id } = await params;
  const lang: Locale = isLocale(raw) ? raw : "ar";
  const ctx = await getDashboardContext(lang);
  const r = ctx.restaurant;
  if (!r) return <NoRestaurant isAdmin={ctx.user.isPlatformAdmin} />;
  const { categories, items } = await getMenuData(r.id);
  // Only items of the restaurant being managed (never trust the URL).
  const item = items.find((i) => i.id === id);
  if (!item) notFound();
  return (
    <ItemEditor
      key={item.id}
      restaurantId={r.id}
      currency={r.currency}
      categories={categories}
      item={item}
      defaultCategoryId={item.categoryId}
      brand={editorBrand(r)}
    />
  );
}
