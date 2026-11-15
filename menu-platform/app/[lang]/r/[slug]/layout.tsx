import { Suspense, type ReactNode } from "react";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { MenuShell } from "@/components/menu/menu-shell";
import { MenuSkeleton } from "@/components/menu/menu-skeleton";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { getPublicMenu } from "@/lib/menu/queries";
import { shellProps } from "@/lib/menu/page-helpers";
import "@/components/menu/menu.css";

/**
 * No menus are prebuilt at build time: cache entries created during the build are served stale once
 * after the first owner edit following a deploy. Menus fill on the first visit instead (App Shell
 * instantly, then cached until an edit expires them). With Cache Components the list cannot be
 * empty, so a placeholder slug is returned (the page answers it with notFound()).
 */
export async function generateStaticParams() {
  return [{ slug: "__none__" }];
}

/**
 * Menu layout: one ThemeProvider (inside MenuShell) for the menu and its item pages, the
 * restaurant brand variables and font, and the "menu" dictionary. Params are read inside
 * <Suspense> so unknown slugs still get an instant shell.
 */
export default function MenuLayout({ children, params }: LayoutProps<"/[lang]/r/[slug]">) {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <MenuProviders params={params}>{children}</MenuProviders>
    </Suspense>
  );
}

async function MenuProviders({
  params,
  children,
}: {
  params: LayoutProps<"/[lang]/r/[slug]">["params"];
  children: ReactNode;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : "ar";
  const [menu, messages] = await Promise.all([getPublicMenu(slug), getDictionary(lang, "menu")]);
  if (!menu) {
    // The page calls notFound(); its not-found.tsx still needs the dictionary.
    return (
      <I18nProvider lang={lang} messages={{ menu: messages }}>
        {children}
      </I18nProvider>
    );
  }
  return (
    <I18nProvider lang={lang} messages={{ menu: messages }}>
      <MenuShell {...shellProps(menu.restaurant)}>{children}</MenuShell>
    </I18nProvider>
  );
}
