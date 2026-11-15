import { Suspense } from "react";
import type { Metadata } from "next";
import { NoRestaurant } from "@/components/dashboard/no-restaurant";
import { QrStudio } from "@/components/dashboard/qr/qr-studio";
import { PageSkeleton } from "@/components/dashboard/skeletons";
import { getDashboardContext, menuLinks } from "@/lib/dashboard/context";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/qr">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "dashboard");
  return { title: t.meta.qr };
}

export default function QrPage({ params }: PageProps<"/[lang]/dashboard/qr">) {
  return (
    <Suspense fallback={<PageSkeleton rows={2} />}>
      <QrLoader params={params} />
    </Suspense>
  );
}

async function QrLoader({ params }: { params: PageProps<"/[lang]/dashboard/qr">["params"] }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "ar";
  const ctx = await getDashboardContext(lang);
  const r = ctx.restaurant;
  if (!r) return <NoRestaurant isAdmin={ctx.user.isPlatformAdmin} />;
  // No language in the QR link: each guest gets their phone's language (Arabic by default).
  const links = await menuLinks(r, lang);
  return (
    <QrStudio
      key={r.id}
      menuUrl={links.neutral}
      viewHref={links.view}
      slug={r.slug}
      restaurant={{ name: r.name, logoUrl: r.logoUrl, primary: r.theme.primary, accent: r.theme.accent }}
    />
  );
}
