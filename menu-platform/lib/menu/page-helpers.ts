import "server-only";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import type { Locale, MenuItem, PublicMenu, Restaurant } from "@/lib/data/types";
import { APP_URL, publicMenuUrl } from "@/lib/env";
import { fmt, pick } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/dictionaries";
import { fontVar } from "@/lib/fonts";
import { brandVars } from "./color";

/** Props for <MenuShell> computed on the server (brand variables, font, template). */
export function shellProps(r: Restaurant) {
  return {
    template: r.theme.template,
    radius: r.theme.radius,
    mode: r.theme.mode,
    style: { ...brandVars(r.theme.primary, r.theme.accent), fontFamily: fontVar(r.theme.font) } as CSSProperties,
  };
}

export const TEMPLATE_BACKGROUND: Record<Restaurant["theme"]["template"], { light: string; dark: string }> = {
  aurora: { light: "#fbf8f4", dark: "#12100e" },
  noir: { light: "#f4efe5", dark: "#0b0a09" },
  pop: { light: "#fff8ec", dark: "#151413" },
};

/** Canonical path of the restaurant manifest (works on every host: the proxy skips files with an extension). */
export const manifestPath = (r: Restaurant, lang: Locale) => `/${lang}/r/${r.slug}/manifest.webmanifest`;

function absolute(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, APP_URL).toString();
  } catch {
    return undefined;
  }
}

export function menuMetadata(menu: PublicMenu, lang: Locale, m: Messages<"menu">, item?: MenuItem): Metadata {
  const r = menu.restaurant;
  const name = pick(r.name, lang);
  const suffix = item ? `/item/${encodeURIComponent(item.slug)}` : "";
  const url = (l: Locale) => `${publicMenuUrl(r.slug, l, r.customDomain)}${suffix}`;
  const title = item ? `${pick(item.name, lang)} · ${name}` : `${name} · ${m.meta.menu}`;
  const description = item
    ? pick(item.description, lang) || fmt(m.meta.itemDescription, { item: pick(item.name, lang), restaurant: name })
    : pick(r.tagline, lang) || pick(r.description, lang) || fmt(m.meta.description, { restaurant: name });
  const image = absolute(item?.imageUrl ?? null) ?? absolute(r.coverUrl);
  const logo = absolute(r.logoUrl);
  let metadataBase: URL | undefined;
  try {
    metadataBase = new URL(APP_URL);
  } catch {
    metadataBase = undefined;
  }
  return {
    metadataBase,
    title: { absolute: title },
    description,
    applicationName: name,
    alternates: { canonical: url(lang), languages: { ar: url("ar"), en: url("en"), "x-default": url("ar") } },
    openGraph: {
      type: "website",
      url: url(lang),
      siteName: name,
      title,
      description,
      locale: lang === "ar" ? "ar_AR" : "en_US",
      images: image ? [{ url: image, alt: item ? pick(item.name, lang) : name }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
    icons: logo ? { icon: [{ url: logo }], apple: [{ url: logo }] } : undefined,
    manifest: manifestPath(r, lang),
    appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" },
  };
}

/** schema.org JSON-LD for the restaurant menu or one dish. */
export function menuJsonLd(menu: PublicMenu, lang: Locale, item?: MenuItem): string {
  const r = menu.restaurant;
  const name = pick(r.name, lang);
  const offer = (i: MenuItem) => ({ "@type": "Offer", price: i.price, priceCurrency: r.currency, availability: i.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" });
  const dish = (i: MenuItem) => ({
    "@type": "MenuItem",
    name: pick(i.name, lang),
    description: pick(i.description, lang) || undefined,
    image: absolute(i.imageUrl),
    offers: offer(i),
    ...(i.calories ? { nutrition: { "@type": "NutritionInformation", calories: `${i.calories} calories` } } : {}),
  });
  const data = item
    ? { "@context": "https://schema.org", ...dish(item) }
    : {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        name,
        description: pick(r.tagline, lang) || undefined,
        image: absolute(r.coverUrl),
        logo: absolute(r.logoUrl),
        telephone: r.contact.phone ?? undefined,
        address: pick(r.contact.address, lang) || undefined,
        url: publicMenuUrl(r.slug, lang, r.customDomain),
        hasMenu: {
          "@type": "Menu",
          hasMenuSection: menu.categories.map((c) => ({
            "@type": "MenuSection",
            name: pick(c.name, lang),
            hasMenuItem: c.items.map(dish),
          })),
        },
      };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
