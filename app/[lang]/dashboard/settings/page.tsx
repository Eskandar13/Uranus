import { Suspense } from "react";
import type { Metadata } from "next";
import { NoRestaurant } from "@/components/dashboard/no-restaurant";
import { SettingsView } from "@/components/dashboard/settings/settings-view";
import { SETTINGS_TABS, type SettingsTab } from "@/components/dashboard/settings/tabs";
import { PageSkeleton } from "@/components/dashboard/skeletons";
import { getDashboardContext } from "@/lib/dashboard/context";
import { FONT_IDS } from "@/lib/data/types";
import { FONT_LABELS, fontVar } from "@/lib/fonts";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/settings">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "dashboard");
  return { title: t.meta.settings };
}

export default function SettingsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/settings">) {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <SettingsLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SettingsLoader({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/dashboard/settings">["params"];
  searchParams: PageProps<"/[lang]/dashboard/settings">["searchParams"];
}) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : "ar";
  const ctx = await getDashboardContext(lang);
  const r = ctx.restaurant;
  if (!r) return <NoRestaurant isAdmin={ctx.user.isPlatformAdmin} />;
  const tab = (SETTINGS_TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as SettingsTab) : "branding";
  // Font labels + CSS families come from lib/fonts.ts (next/font), so they are computed here.
  const fonts = FONT_IDS.map((id) => ({ id, label: FONT_LABELS[id], family: fontVar(id) }));
  return <SettingsView key={r.id} restaurant={r} fonts={fonts} initialTab={tab} />;
}
