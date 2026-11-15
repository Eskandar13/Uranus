"use client";

import { useMemo, useState, useTransition, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import {
  Check,
  ChevronsUpDown,
  ExternalLink,
  Languages,
  LayoutDashboard,
  Loader2,
  LogOut,
  Moon,
  MoreHorizontal,
  Plus,
  QrCode,
  Settings,
  ShieldCheck,
  Sun,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, pick, type Locale } from "@/lib/i18n/config";
import { switchRestaurantAction } from "@/lib/dashboard/actions";
import type { DashboardUser, RestaurantSummary } from "@/lib/dashboard/context";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { callAction, useFeedback, useT } from "./hooks";
import { RestaurantAvatar } from "./ui";

type NavKey = "overview" | "menu" | "settings" | "qr";
interface NavItem {
  key: NavKey;
  href: string;
  icon: ComponentType<{ className?: string }>;
  match: (path: string) => boolean;
}

function useNav(lang: Locale): NavItem[] {
  return useMemo(() => {
    const base = `/${lang}/dashboard`;
    return [
      { key: "overview", href: base, icon: LayoutDashboard, match: (p) => p === base || p === `${base}/` },
      {
        key: "menu",
        href: `${base}/menu`,
        icon: UtensilsCrossed,
        match: (p) => p.startsWith(`${base}/menu`) || p.startsWith(`${base}/items`),
      },
      { key: "qr", href: `${base}/qr`, icon: QrCode, match: (p) => p.startsWith(`${base}/qr`) },
      { key: "settings", href: `${base}/settings`, icon: Settings, match: (p) => p.startsWith(`${base}/settings`) },
    ];
  }, [lang]);
}

/** Same page in the other language (swaps the first path segment). */
function useOtherLangHref(): string {
  const pathname = usePathname() ?? "/";
  const { lang } = useI18n();
  const other = lang === "ar" ? "en" : "ar";
  return pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`);
}

export interface ShellProps {
  platformName: string;
  user: DashboardUser;
  restaurants: RestaurantSummary[];
  active: RestaurantSummary | null;
  menuViewHref: string | null;
  signOutAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}

/**
 * Dashboard chrome. Desktop (lg+): sticky sidebar. Phone: top bar + thumb-friendly bottom
 * navigation with a central "add item" button.
 */
export function DashboardShell(props: ShellProps) {
  const { children } = props;
  return (
    <div className="dash-root min-h-dvh bg-muted/40 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] dark:bg-background">
      <Sidebar {...props} />
      <div className="flex min-w-0 flex-col">
        <MobileTopBar {...props} />
        <main id="dash-main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-32 outline-none sm:px-6 lg:px-10 lg:pt-8 lg:pb-14">
          {children}
        </main>
      </div>
      <BottomNav hasRestaurant={Boolean(props.active)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop sidebar                                                     */
/* ------------------------------------------------------------------ */

function Sidebar({ platformName, user, restaurants, active, menuViewHref, signOutAction }: ShellProps) {
  const t = useT();
  const { lang } = useI18n();
  const pathname = usePathname() ?? "";
  const nav = useNav(lang);
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-e bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex">
      <Link
        href={`/${lang}/dashboard`}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-lg font-extrabold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-sm" aria-hidden>
          <UtensilsCrossed className="size-4" />
        </span>
        {platformName}
      </Link>

      {active && <RestaurantSwitcher restaurants={restaurants} active={active} isAdmin={user.isPlatformAdmin} variant="sidebar" />}

      <nav aria-label={t.nav.main} className="flex flex-col gap-1">
        {nav.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive ? "text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="dash-side-pill"
                  className="absolute inset-0 rounded-xl bg-background shadow-sm ring-1 ring-foreground/8 dark:bg-sidebar-accent"
                  aria-hidden
                />
              )}
              <Icon className="relative size-4.5" />
              <span className="relative">{t.nav[item.key]}</span>
            </Link>
          );
        })}
        {active && (
          <Button asChild className="mt-2 h-10 justify-start gap-3 rounded-xl px-3">
            <Link href={`/${lang}/dashboard/items/new`}>
              <Plus aria-hidden />
              {t.nav.addItem}
            </Link>
          </Button>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {menuViewHref && (
          <a
            href={menuViewHref}
            target="_blank"
            rel="noopener"
            className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-sidebar-accent/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ExternalLink className="size-4.5 rtl:-scale-x-100" aria-hidden />
            {t.nav.viewMenu}
          </a>
        )}
        {user.isPlatformAdmin && (
          <Link
            href={`/${lang}/admin`}
            className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-sidebar-accent/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ShieldCheck className="size-4.5" aria-hidden />
            {t.nav.admin}
          </Link>
        )}
        <div className="my-2 flex items-center gap-1 px-1">
          <ThemeToggle />
          <LanguageLink />
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-background/60 p-2 dark:bg-transparent">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold uppercase" aria-hidden>
            {(user.displayName || user.email).slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.displayName || user.email}</span>
            <span className="block truncate text-xs text-muted-foreground" dir="ltr">
              {user.email}
            </span>
          </span>
          <form action={signOutAction}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" variant="ghost" size="icon" className="size-9 rounded-lg" aria-label={t.nav.signOut}>
                  <LogOut className="rtl:-scale-x-100" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.nav.signOut}</TooltipContent>
            </Tooltip>
          </form>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Phone chrome                                                        */
/* ------------------------------------------------------------------ */

function MobileTopBar({ user, restaurants, active, menuViewHref, signOutAction, platformName }: ShellProps) {
  const t = useT();
  const common = useMessages("common");
  const { lang } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const otherHref = useOtherLangHref();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md pt-[env(safe-area-inset-top)] supports-backdrop-filter:bg-background/70 lg:hidden">
      {active ? (
        <RestaurantSwitcher restaurants={restaurants} active={active} isAdmin={user.isPlatformAdmin} variant="topbar" />
      ) : (
        <span className="px-2 text-lg font-extrabold">{platformName}</span>
      )}
      <div className="ms-auto flex items-center gap-1">
        {menuViewHref && (
          <Button asChild variant="ghost" size="icon" className="size-11 rounded-xl">
            <a href={menuViewHref} target="_blank" rel="noopener" aria-label={t.nav.viewMenu}>
              <ExternalLink className="size-5 rtl:-scale-x-100" aria-hidden />
            </a>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11 rounded-xl" aria-label={t.nav.more}>
              <MoreHorizontal className="size-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-xs text-muted-foreground">{t.nav.signedInAs}</span>
              <span className="block truncate text-sm font-medium" dir="ltr">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11" onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun className="dark:hidden" aria-hidden />
              <Moon className="hidden dark:block" aria-hidden />
              {t.nav.toggleTheme}
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={() => router.push(otherHref)}>
              <Languages aria-hidden />
              {common.switchLanguage}
            </DropdownMenuItem>
            {user.isPlatformAdmin && (
              <DropdownMenuItem className="min-h-11" onSelect={() => router.push(`/${lang}/admin`)}>
                <ShieldCheck aria-hidden />
                {t.nav.admin}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <DropdownMenuItem asChild variant="destructive" className="min-h-11 w-full">
                <button type="submit">
                  <LogOut className="rtl:-scale-x-100" aria-hidden />
                  {t.nav.signOut}
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function BottomNav({ hasRestaurant }: { hasRestaurant: boolean }) {
  const t = useT();
  const { lang } = useI18n();
  const pathname = usePathname() ?? "";
  const nav = useNav(lang);
  const left = nav.slice(0, 2);
  const right = nav.slice(2);
  const renderItem = (item: NavItem) => {
    const isActive = item.match(pathname);
    const Icon = item.icon;
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[0.7rem] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {isActive && <motion.span layoutId="dash-bottom-pill" className="absolute inset-x-1.5 inset-y-1 rounded-2xl bg-muted" aria-hidden />}
        <Icon className="relative size-5" />
        <span className="relative">{t.nav[item.key]}</span>
      </Link>
    );
  };
  return (
    <nav
      aria-label={t.nav.main}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-backdrop-filter:bg-background/75 lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center gap-1">
        {left.map(renderItem)}
        {hasRestaurant ? (
          <Link
            href={`/${lang}/dashboard/items/new`}
            aria-label={t.nav.addItem}
            className="-mt-6 grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 outline-none ring-4 ring-background transition-transform active:scale-95 focus-visible:ring-ring/60"
          >
            <Plus className="size-6" aria-hidden />
          </Link>
        ) : (
          <span className="size-14 shrink-0" aria-hidden />
        )}
        {right.map(renderItem)}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function ThemeToggle() {
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl"
          aria-label={t.nav.toggleTheme}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4.5 dark:hidden" aria-hidden />
          <Moon className="hidden size-4.5 dark:block" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t.nav.toggleTheme}</TooltipContent>
    </Tooltip>
  );
}

function LanguageLink() {
  const common = useMessages("common");
  const href = useOtherLangHref();
  const { lang } = useI18n();
  return (
    <Button asChild variant="ghost" className="h-10 flex-1 justify-start gap-2 rounded-xl px-3 text-sm">
      <Link href={href} hrefLang={lang === "ar" ? "en" : "ar"}>
        <Languages className="size-4.5" aria-hidden />
        {common.switchLanguage}
      </Link>
    </Button>
  );
}

function RestaurantSwitcher({
  restaurants,
  active,
  isAdmin,
  variant,
}: {
  restaurants: RestaurantSummary[];
  active: RestaurantSummary;
  isAdmin: boolean;
  variant: "sidebar" | "topbar";
}) {
  const t = useT();
  const { lang } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const feedback = useFeedback();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const canSwitch = restaurants.length > 1 || isAdmin;
  const name = pick(active.name, lang);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) => `${r.name.ar} ${r.name.en} ${r.slug}`.toLowerCase().includes(q));
  }, [restaurants, query]);

  const trigger = (
    <span className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
      <RestaurantAvatar name={active.name} logoUrl={active.logoUrl} color={active.primary} size={variant === "sidebar" ? 36 : 34} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block truncate text-xs text-muted-foreground" dir="ltr">
          /{active.slug}
        </span>
      </span>
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        canSwitch && <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </span>
  );

  const triggerClass = cn(
    "flex items-center rounded-xl text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    variant === "sidebar" ? "w-full border bg-background p-2 shadow-xs hover:bg-muted/60 dark:bg-sidebar-accent/40" : "min-h-11 min-w-0 max-w-[62vw] p-1 pe-2 hover:bg-muted",
  );

  if (!canSwitch) return <div className={triggerClass}>{trigger}</div>;

  const choose = (r: RestaurantSummary) => {
    if (r.id === active.id) return;
    startTransition(async () => {
      const res = await callAction(() => switchRestaurantAction(lang, r.id));
      if (!feedback(res, fmt(t.nav.switched, { name: pick(r.name, lang) }))) return;
      if (pathname.includes("/dashboard/items/")) router.push(`/${lang}/dashboard/menu`);
      else router.refresh();
    });
  };

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger className={triggerClass} aria-label={`${t.nav.switchRestaurant}: ${name}`} disabled={pending}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-1.5rem)]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {isAdmin ? t.nav.allRestaurants : t.nav.yourRestaurants}
        </DropdownMenuLabel>
        {restaurants.length > 6 && (
          <div className="px-1 pb-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t.nav.findRestaurant}
              aria-label={t.nav.findRestaurant}
              className="h-10"
            />
          </div>
        )}
        <div className="max-h-80 overflow-y-auto">
          {filtered.map((r) => (
            <DropdownMenuItem key={r.id} className="min-h-12 gap-2.5" onSelect={() => choose(r)}>
              <RestaurantAvatar name={r.name} logoUrl={r.logoUrl} color={r.primary} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{pick(r.name, lang)}</span>
                <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                  /{r.slug}
                </span>
              </span>
              {r.id === active.id && <Check className="size-4" aria-hidden />}
            </DropdownMenuItem>
          ))}
          {filtered.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{t.nav.noMatch}</p>}
        </div>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11" onSelect={() => router.push(`/${lang}/admin`)}>
              <ShieldCheck aria-hidden />
              {t.nav.admin}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
