import { Suspense } from "react";
import type { Metadata } from "next";
import { FormSkeleton } from "@/components/admin/admin-skeletons";
import { NewRestaurantForm } from "@/components/admin/new-restaurant-form";
import { PageHeader } from "@/components/admin/shared";
import { SLUG_PLACEHOLDER } from "@/components/admin/types";
import { requirePlatformAdmin } from "@/lib/auth";
import { getDataMode, publicMenuUrl } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/new">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "admin");
  return { title: t.new.metaTitle };
}

/** /[lang]/admin/new: create a restaurant (names, address, template, color) and invite its owner. */
export default async function NewRestaurantPage({ params }: PageProps<"/[lang]/admin/new">) {
  const { lang: raw } = await params;
  const lang = isLocale(raw) ? raw : "ar";
  const t = await getDictionary(lang, "admin");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.new.title} subtitle={t.new.subtitle} />
      <Suspense fallback={<FormSkeleton />}>
        <NewRestaurantSection lang={lang} />
      </Suspense>
    </div>
  );
}

async function NewRestaurantSection({ lang }: { lang: Locale }) {
  await requirePlatformAdmin(lang);
  return <NewRestaurantForm mode={getDataMode()} menuUrlPattern={publicMenuUrl(SLUG_PLACEHOLDER, lang)} />;
}
