import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { APP_URL, PLATFORM_NAME } from "@/lib/env";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const m = await getDictionary(lang, "landing");
  return {
    title: m.meta.title,
    description: m.meta.description,
    alternates: {
      canonical: `${APP_URL}/${lang}`,
      languages: { ar: `${APP_URL}/ar`, en: `${APP_URL}/en` },
    },
    openGraph: { title: `${m.meta.title} · ${PLATFORM_NAME}`, description: m.meta.description, siteName: PLATFORM_NAME },
  };
}

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const m = await getDictionary(lang, "landing");
  return <LandingPage lang={lang} m={m} name={PLATFORM_NAME} />;
}
