import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuApp } from "@/components/menu/menu-app";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getPublicMenu } from "@/lib/menu/queries";
import { menuJsonLd, menuMetadata } from "@/lib/menu/page-helpers";

export async function generateMetadata({ params }: PageProps<"/[lang]/r/[slug]">): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  const lang = isLocale(raw) ? raw : "ar";
  const menu = await getPublicMenu(slug);
  if (!menu) return { robots: { index: false } };
  return menuMetadata(menu, lang, await getDictionary(lang, "menu"));
}

export default async function MenuPage({ params }: PageProps<"/[lang]/r/[slug]">) {
  const { lang: raw, slug } = await params;
  const lang = isLocale(raw) ? raw : "ar";
  const menu = await getPublicMenu(slug);
  if (!menu) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: menuJsonLd(menu, lang) }} />
      <MenuApp menu={menu} />
    </>
  );
}
