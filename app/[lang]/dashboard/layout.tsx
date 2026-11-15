import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { DashboardProviders } from "@/components/dashboard/providers";
import { ShellError } from "@/components/dashboard/shell-error";
import { DashboardShell } from "@/components/dashboard/shell";
import { ShellSkeleton } from "@/components/dashboard/skeletons";
import { signOutAction } from "@/lib/auth/actions";
import { getDashboardContext, menuLinks } from "@/lib/dashboard/context";
import { PLATFORM_NAME } from "@/lib/env";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import "@/components/dashboard/dashboard.css";

/** The dashboard blocks on the session (cookies); that's expected. */
export const instant = false;

export async function generateMetadata({ params }: LayoutProps<"/[lang]/dashboard">): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "ar";
  const t = await getDictionary(lang, "dashboard");
  return {
    title: { default: t.meta.title, template: `%s · ${t.meta.title} · ${PLATFORM_NAME}` },
    robots: { index: false, follow: false },
  };
}

/**
 * Restaurant owner dashboard: providers (own theme storage "dash-theme", common + dashboard
 * dictionaries) and the shell (sidebar / phone bars). The session is read inside <Suspense>.
 */
export default async function DashboardLayout({ children, params }: LayoutProps<"/[lang]/dashboard">) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : "ar";
  const [common, dashboard] = await Promise.all([getDictionary(lang, "common"), getDictionary(lang, "dashboard")]);
  return (
    <DashboardProviders lang={lang} messages={{ common, dashboard }}>
      <Suspense fallback={<ShellSkeleton />}>
        <ShellLoader lang={lang}>{children}</ShellLoader>
      </Suspense>
    </DashboardProviders>
  );
}

async function ShellLoader({ lang, children }: { lang: Locale; children: ReactNode }) {
  let ctx: Awaited<ReturnType<typeof getDashboardContext>>;
  try {
    ctx = await getDashboardContext(lang);
  } catch (err) {
    // Redirects (signed out) must pass; a data failure gets the friendly screen with a retry.
    unstable_rethrow(err);
    console.error("[dashboard layout]", err);
    return <ShellError />;
  }
  const active = ctx.restaurant ? (ctx.restaurants.find((r) => r.id === ctx.restaurant!.id) ?? null) : null;
  const activeSummary =
    active ??
    (ctx.restaurant
      ? {
          id: ctx.restaurant.id,
          slug: ctx.restaurant.slug,
          name: ctx.restaurant.name,
          logoUrl: ctx.restaurant.logoUrl,
          isActive: ctx.restaurant.isActive,
          primary: ctx.restaurant.theme.primary,
        }
      : null);
  return (
    <DashboardShell
      platformName={PLATFORM_NAME}
      user={ctx.user}
      restaurants={ctx.restaurants}
      active={activeSummary}
      menuViewHref={ctx.restaurant ? (await menuLinks(ctx.restaurant, lang)).view : null}
      signOutAction={signOutAction.bind(null, lang)}
    >
      {children}
    </DashboardShell>
  );
}
