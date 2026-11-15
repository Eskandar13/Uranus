import { NextResponse, type NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy-session";

/**
 * Runs before every page request. Two jobs:
 *
 * 1. Language prefix: every page lives under /ar/... or /en/... . Requests without one are
 *    redirected using the NEXT_LOCALE cookie, then the browser's Accept-Language, then Arabic.
 *
 * 2. Which restaurant? (host-based routing; the same code serves every customer)
 *    - Platform hosts (localhost, *.netlify.app, ROOT_DOMAIN, www./app. + ROOT_DOMAIN):
 *        served as-is: /ar (landing), /ar/r/<slug> (menus), /ar/dashboard, /ar/admin, /ar/login
 *    - Restaurant subdomain  <slug>.ROOT_DOMAIN  (or <slug>.localhost for local testing):
 *        /ar/...  is rewritten internally to  /ar/r/<slug>/...
 *    - Any other host (a client's own domain, e.g. menu.client.com), only when ROOT_DOMAIN is set:
 *        /ar/...  is rewritten to  /ar/r/<host>/...  (the page resolves the host via custom_domain)
 */

type Loc = "ar" | "en";
const DEFAULT_LOCALE: Loc = "ar";
const LOCALE_COOKIE = "NEXT_LOCALE";

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").toLowerCase().replace(/^www\./, "");
const APP_SUBDOMAIN = (process.env.NEXT_PUBLIC_APP_SUBDOMAIN ?? "app").toLowerCase();
const EXTRA_PLATFORM_HOSTS = (process.env.PLATFORM_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const SUPABASE_ON = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Paths that belong to the platform app, never to a restaurant subdomain. */
const PLATFORM_SECTIONS = new Set(["dashboard", "admin", "login", "auth"]);

type HostKind = { kind: "platform" } | { kind: "tenant"; slug: string } | { kind: "domain"; domain: string };

function classifyHost(rawHost: string | null): HostKind {
  const host = (rawHost ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "[::1]") return { kind: "platform" };
  if (EXTRA_PLATFORM_HOSTS.includes(host)) return { kind: "platform" };
  if (/\.(netlify\.app|netlify\.live|vercel\.app)$/.test(host)) return { kind: "platform" };

  // Local subdomain testing: demo-cafe.localhost:3000
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length).split(".").pop()!;
    return sub === APP_SUBDOMAIN || sub === "www" ? { kind: "platform" } : { kind: "tenant", slug: sub };
  }

  if (ROOT_DOMAIN) {
    if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || host === `${APP_SUBDOMAIN}.${ROOT_DOMAIN}`) {
      return { kind: "platform" };
    }
    if (host.endsWith(`.${ROOT_DOMAIN}`)) {
      const sub = host.slice(0, -(ROOT_DOMAIN.length + 1)).split(".").pop()!;
      return { kind: "tenant", slug: sub };
    }
    return { kind: "domain", domain: host };
  }
  return { kind: "platform" };
}

/** Presence only: local-mode "session" cookie or a Supabase auth cookie (sb-<ref>-auth-token[.n]). */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name === "session" || (c.name.startsWith("sb-") && c.name.includes("-auth-token")));
}

function preferredLocale(request: NextRequest): Loc {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie === "ar" || cookie === "en") return cookie;
  const accept = request.headers.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (code === "ar" || code === "en") return code;
  }
  return DEFAULT_LOCALE;
}

function rememberLocale(response: NextResponse, request: NextRequest, locale: Loc) {
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/"); // ["", "ar", "r", "slug", ...]
  const first = segments[1] as Loc | undefined;
  const hasLocale = first === "ar" || first === "en";

  // 1. Add the language prefix when missing (same host, same rest of the path).
  if (!hasLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  const locale = first as Loc;
  const rest = "/" + segments.slice(2).join("/"); // "/" or "/item/x" ...
  const section = segments[2] ?? "";
  const host = classifyHost(request.headers.get("host"));

  // 2a. Platform host: serve normally (refresh Supabase session on private areas).
  if (host.kind === "platform") {
    // Optimistic check: no session cookie at all -> real redirect to login (authorization itself
    // still happens in lib/auth on the server).
    if ((section === "dashboard" || section === "admin") && !hasSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    if (SUPABASE_ON && (section === "dashboard" || section === "admin" || section === "login" || section === "auth")) {
      return rememberLocale(await refreshSupabaseSession(request), request, locale);
    }
    return rememberLocale(NextResponse.next(), request, locale);
  }

  // 2b. Restaurant host trying to open a platform section -> send to the platform host.
  if (PLATFORM_SECTIONS.has(section)) {
    if (ROOT_DOMAIN) {
      return NextResponse.redirect(new URL(`https://${APP_SUBDOMAIN}.${ROOT_DOMAIN}${pathname}${search}`));
    }
    // Local *.localhost testing without ROOT_DOMAIN: let platform sections through.
    if (SUPABASE_ON) return rememberLocale(await refreshSupabaseSession(request), request, locale);
    return rememberLocale(NextResponse.next(), request, locale);
  }

  // 2c. Rewrite to the restaurant's menu routes.
  const key = host.kind === "tenant" ? host.slug : encodeURIComponent(host.domain);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/r/${key}${rest === "/" ? "" : rest}`;
  return rememberLocale(NextResponse.rewrite(url), request, locale);
}

export const config = {
  // Skip Next internals, API routes, uploaded images and any file with an extension.
  matcher: ["/((?!_next/|api/|uploads/|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
