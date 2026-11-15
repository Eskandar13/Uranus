"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/** Swap the first path segment (/ar <-> /en), keeping the rest of the path. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split("/");
  if (parts[1] === "ar" || parts[1] === "en") parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join("/") || `/${to}`;
}

/**
 * Language toggle for the private areas. Keeps the current path and query string
 * (e.g. the login "?next=").
 * Uses usePathname: on routes with unknown dynamic params, render it inside <Suspense>.
 */
export function LanguageSwitch({
  lang,
  label,
  ariaLabel,
  className,
}: {
  lang: Locale;
  label: string;
  ariaLabel: string;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const other: Locale = lang === "ar" ? "en" : "ar";
  const href = switchLocalePath(pathname, other);
  return (
    <Link
      href={href}
      hrefLang={other}
      lang={other}
      aria-label={ariaLabel}
      onClick={(e) => {
        const search = window.location.search;
        if (!search || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.push(`${href}${search}`);
      }}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <Languages className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

/** Same control without the pathname hook (Suspense fallback). */
export function LanguageSwitchFallback({ label, className }: { label: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      <Languages className="size-4" />
      <span>{label}</span>
    </span>
  );
}
