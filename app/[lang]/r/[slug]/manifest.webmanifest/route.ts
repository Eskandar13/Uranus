import { isLocale, pick } from "@/lib/i18n/config";
import { getPublicMenu } from "@/lib/menu/queries";
import { TEMPLATE_BACKGROUND } from "@/lib/menu/page-helpers";

function iconType(url: string): { type?: string } {
  return /\.svg(\?|#|$)/i.test(url) ? { type: "image/svg+xml" } : {};
}

/**
 * Per-restaurant PWA manifest. Served at /<lang>/r/<slug>/manifest.webmanifest on every host
 * (proxy.ts skips paths with a file extension, so subdomains reach this route directly).
 */
export async function GET(request: Request, ctx: RouteContext<"/[lang]/r/[slug]/manifest.webmanifest">) {
  const { lang: raw, slug } = await ctx.params;
  const lang = isLocale(raw) ? raw : "ar";
  const menu = await getPublicMenu(slug);
  if (!menu) return new Response("Not found", { status: 404 });
  const r = menu.restaurant;

  // On the restaurant's own subdomain / custom domain the menu lives at "/<lang>".
  const host = (request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const onTenantHost = host.startsWith(`${r.slug}.`) || (r.customDomain && host === r.customDomain.toLowerCase());
  const startUrl = onTenantHost ? `/${lang}` : `/${lang}/r/${r.slug}`;
  const bg = TEMPLATE_BACKGROUND[r.theme.template];
  const dark = r.theme.mode === "dark";

  const icons = r.logoUrl
    ? [
        { src: r.logoUrl, sizes: "192x192", purpose: "any", ...iconType(r.logoUrl) },
        { src: r.logoUrl, sizes: "512x512", purpose: "any", ...iconType(r.logoUrl) },
      ]
    : [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }];

  const manifest = {
    id: startUrl,
    name: pick(r.name, lang),
    short_name: pick(r.name, lang).slice(0, 24),
    description: pick(r.tagline, lang) || pick(r.description, lang),
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    start_url: startUrl,
    scope: startUrl,
    display: "standalone",
    orientation: "portrait",
    background_color: dark ? bg.dark : bg.light,
    theme_color: r.theme.primary,
    icons,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
