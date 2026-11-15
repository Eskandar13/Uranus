"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "motion/react";
import { ExternalLink, LayoutDashboard, LogOut, Menu, Moon, Plus, Store, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrandMark } from "@/components/auth/brand-mark";
import { LanguageSwitch, LanguageSwitchFallback } from "@/components/auth/language-switch";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

type NavKey = "restaurants" | "new";

/**
 * Agency admin frame: a sidebar on large screens (start side), a compact top bar with a sheet
 * menu on phones. `user` is a server-rendered slot (inside <Suspense>) with the signed-in admin.
 */
export function AdminShell({ platformName, user, children }: { platformName: string; user: ReactNode; children: ReactNode }) {
  const { lang, dir } = useI18n();
  const t = useMessages("admin");
  const [open, setOpen] = useState(false);

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-6">
      <Link
        href={`/${lang}/admin`}
        onClick={onNavigate}
        className="flex h-11 items-center gap-2.5 rounded-lg px-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <BrandMark size={30} />
        <span className="text-base font-semibold tracking-tight">{platformName}</span>
        <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase">
          {t.badge}
        </span>
      </Link>

      <nav aria-label={t.nav.label} className="flex-1">
        <Suspense fallback={<NavLinks active={null} onNavigate={onNavigate} />}>
          <ActiveNavLinks onNavigate={onNavigate} />
        </Suspense>
      </nav>

      <div className="space-y-3 border-t pt-4">
        {user}
        <div className="flex flex-wrap items-center gap-1">
          <ThemeToggle />
          <Suspense fallback={<LanguageSwitchFallback label={t.nav.switchLanguage} />}>
            <LanguageSwitch lang={lang} label={t.nav.switchLanguage} ariaLabel={t.nav.switchLanguageLabel} />
          </Suspense>
        </div>
        <form action={signOutAction.bind(null, lang)}>
          <Button type="submit" variant="ghost" className="h-11 w-full justify-start gap-3 px-3 text-muted-foreground hover:text-foreground">
            <LogOut className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            {t.nav.signOut}
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-muted/40">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e bg-background p-4 lg:block">{sidebar()}</aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-2 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={t.nav.openMenu}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
        <Link href={`/${lang}/admin`} className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1">
          <BrandMark size={26} />
          <span className="truncate font-semibold">{platformName}</span>
        </Link>
        <Button asChild size="icon" className="size-11 rounded-xl" aria-label={t.nav.newRestaurant}>
          <Link href={`/${lang}/admin/new`}>
            <Plus className="size-5" aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-[85vw] max-w-xs p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <SheetHeader className="sr-only">
            <SheetTitle>{t.title}</SheetTitle>
            <SheetDescription>{t.nav.label}</SheetDescription>
          </SheetHeader>
          {sidebar(() => setOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="lg:ps-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(2).join("/"); // "admin", "admin/new", "admin/<id>"
  const active: NavKey | null = rest === "admin/new" ? "new" : rest.startsWith("admin") ? "restaurants" : null;
  return <NavLinks active={active} onNavigate={onNavigate} />;
}

function NavLinks({ active, onNavigate }: { active: NavKey | null; onNavigate?: () => void }) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const reduce = useReducedMotion();
  const items: Array<{ key: NavKey | "dashboard" | "site"; href: string; label: string; icon: ReactNode; external?: boolean }> = [
    { key: "restaurants", href: `/${lang}/admin`, label: t.nav.restaurants, icon: <Store className="size-4" aria-hidden="true" /> },
    { key: "new", href: `/${lang}/admin/new`, label: t.nav.newRestaurant, icon: <Plus className="size-4" aria-hidden="true" /> },
    {
      key: "dashboard",
      href: `/${lang}/dashboard`,
      label: t.nav.openDashboard,
      icon: <LayoutDashboard className="size-4" aria-hidden="true" />,
    },
    {
      key: "site",
      href: `/${lang}`,
      label: t.nav.viewSite,
      icon: <ExternalLink className="size-4" aria-hidden="true" />,
      external: true,
    },
  ];
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <li key={item.key} className="relative">
            {isActive ? (
              <motion.span
                layoutId="admin-nav-active"
                className="absolute inset-0 rounded-lg bg-muted"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                aria-hidden="true"
              />
            ) : null}
            <Link
              href={item.href}
              onClick={onNavigate}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener" : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                isActive ? "text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ThemeToggle() {
  const t = useMessages("admin");
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 text-muted-foreground hover:text-foreground"
      aria-label={`${t.nav.darkMode} / ${t.nav.lightMode}`}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
    </Button>
  );
}

/** Signed-in admin (rendered by the server inside <Suspense>). */
export function AdminUserChip({ name, email }: { name: string | null; email: string }) {
  const t = useMessages("admin");
  const initials = (name || email).trim().slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
      <span
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background"
        aria-hidden="true"
      >
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name || t.nav.platformAdmin}</p>
        <p className="truncate text-xs text-muted-foreground" dir="ltr">
          <span className="sr-only">{t.nav.signedInAs} </span>
          {email}
        </p>
      </div>
    </div>
  );
}
