"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages, Menu, X } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/dictionaries";
import { LogoMark } from "./logo-mark";

/** Swap the first path segment (/ar <-> /en), keeping the rest of the path. */
function switchPath(pathname: string, to: Locale): string {
  const parts = pathname.split("/");
  if (parts[1] === "ar" || parts[1] === "en") parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join("/") || `/${to}`;
}

export function SiteHeader({
  lang,
  name,
  nav,
}: {
  lang: Locale;
  name: string;
  nav: Messages<"landing">["nav"];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const other: Locale = lang === "ar" ? "en" : "ar";
  const links = [
    { href: "#demos", label: nav.demos },
    { href: "#features", label: nav.features },
    { href: "#how", label: nav.how },
    { href: "#faq", label: nav.faq },
  ];

  return (
    <header className="lp-header">
      <div className="lp-wrap">
        <div className="lp-header-row">
          <Link href={`/${lang}`} className="lp-logo lp-display" aria-label={`${name} - ${nav.homeLabel}`}>
            <LogoMark />
            <span>{name}</span>
          </Link>
          <nav className="lp-nav" aria-label={name}>
            {links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="lp-header-actions">
            <Link
              href={switchPath(pathname, other)}
              hrefLang={other}
              lang={other}
              className="lp-lang"
              aria-label={nav.switchLabel}
            >
              <Languages size={18} aria-hidden="true" />
              {nav.switchTo}
            </Link>
            <Link href={`/${lang}/login`} className="lp-btn lp-btn-primary lp-btn-sm lp-login-sm">
              {nav.login}
            </Link>
            <button
              type="button"
              className="lp-burger"
              aria-expanded={open}
              aria-controls="lp-mobile-nav"
              aria-label={open ? nav.closeMenu : nav.openMenu}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="lp-mobile-nav" className="lp-mobile-nav" aria-label={name}>
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <Link href={`/${lang}/login`} onClick={() => setOpen(false)}>
              {nav.login}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
