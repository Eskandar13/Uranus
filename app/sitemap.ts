import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/env";

/** Static: landing pages for both languages (menus are discovered through their own links). */
export default function sitemap(): MetadataRoute.Sitemap {
  return (["ar", "en"] as const).map((lang) => ({
    url: `${APP_URL}/${lang}`,
    changeFrequency: "monthly",
    priority: 1,
    alternates: { languages: { ar: `${APP_URL}/ar`, en: `${APP_URL}/en` } },
  }));
}
