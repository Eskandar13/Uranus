import { Suspense } from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { AdminShell, AdminUserChip } from "@/components/admin/admin-shell";
import { UserChipSkeleton } from "@/components/admin/admin-skeletons";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { requirePlatformAdmin } from "@/lib/auth";
import { PLATFORM_NAME } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n/config";

/** The admin blocks on the session (pages check it inside <Suspense>). */
export const instant = false;

export async function generateMetadata({ params }: LayoutProps<"/[lang]/admin">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "admin");
  return { title: { default: t.title, template: `%s · ${t.title}` }, robots: { index: false, follow: false } };
}

/**
 * Agency admin layout: its own shell (sidebar / mobile sheet) and theme (shares "dash-theme"
 * with the owner dashboard). The shell is static; the signed-in admin streams into it and every
 * page re-checks requirePlatformAdmin() itself.
 */
export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  const { lang: raw } = await params;
  const lang = isLocale(raw) ? raw : "ar";
  const [admin, auth, common] = await Promise.all([
    getDictionary(lang, "admin"),
    getDictionary(lang, "auth"),
    getDictionary(lang, "common"),
  ]);
  return (
    <I18nProvider lang={lang} messages={{ admin, auth, common }}>
      <ThemeProvider attribute="class" storageKey="dash-theme" defaultTheme="light" enableSystem disableTransitionOnChange>
        <AdminShell
          platformName={PLATFORM_NAME}
          user={
            <Suspense fallback={<UserChipSkeleton />}>
              <SignedInAdmin lang={lang} />
            </Suspense>
          }
        >
          {children}
        </AdminShell>
      </ThemeProvider>
    </I18nProvider>
  );
}

async function SignedInAdmin({ lang }: { lang: Locale }) {
  const user = await requirePlatformAdmin(lang);
  return <AdminUserChip name={user.displayName} email={user.email} />;
}
