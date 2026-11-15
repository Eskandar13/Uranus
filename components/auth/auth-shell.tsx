import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { PLATFORM_NAME } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/dictionaries";
import { BRAND, BrandMark, BrandWordmark } from "./brand-mark";
import { LanguageSwitch } from "./language-switch";

/**
 * Frame for the login and password pages: a brand panel on large screens (start side) and a
 * centered form column with the language switch and a link back to the website.
 */
export function AuthShell({ lang, t, children }: { lang: Locale; t: Messages<"auth">; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <BrandPanel tagline={t.brandTagline} />

      <div className="relative flex min-h-dvh flex-col">
        {/* Soft brand glow behind the form on small screens */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70 lg:hidden"
          style={{
            background: `radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, ${BRAND.green} 16%, transparent), transparent)`,
          }}
        />
        <header className="relative flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8">
          <Link
            href={`/${lang}`}
            className="inline-flex h-11 items-center rounded-lg pe-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:invisible"
            aria-label={PLATFORM_NAME}
          >
            <BrandWordmark name={PLATFORM_NAME} size={30} />
          </Link>
          <nav className="flex items-center gap-1" aria-label={PLATFORM_NAME}>
            <Link
              href={`/${lang}`}
              className="hidden h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:inline-flex"
            >
              <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              {t.backToSite}
            </Link>
            <LanguageSwitch lang={lang} label={t.switchLanguage} ariaLabel={t.switchLanguageLabel} />
          </nav>
        </header>

        <main className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>

        <footer className="relative flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
          <Link
            href={`/${lang}`}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 font-medium hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:hidden"
          >
            <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
            {t.backToSite}
          </Link>
          <p className="inline-flex items-center gap-1.5">
            <Lock className="size-3" aria-hidden="true" />
            {t.secureNote}
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Decorative brand side: deep green, a QR-like tile pattern and a floating menu card. */
function BrandPanel({ tagline }: { tagline: string }) {
  const tiles = Array.from({ length: 48 }, (_, i) => i);
  return (
    <aside
      className="relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between xl:p-14"
      style={{ backgroundColor: BRAND.green, color: BRAND.cream }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-24 -top-24 grid grid-cols-8 gap-3 opacity-[0.09]"
      >
        {tiles.map((i) => (
          <span
            key={i}
            className="size-10 rounded-lg"
            style={{ backgroundColor: i % 7 === 3 ? BRAND.amber : BRAND.cream, opacity: (i * 37) % 5 === 0 ? 0.25 : 1 }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -start-40 size-[28rem] rounded-full blur-3xl"
        style={{ background: `color-mix(in oklab, ${BRAND.amber} 35%, transparent)` }}
      />

      <div className="relative flex items-center gap-3">
        <span className="rounded-xl bg-white/10 p-1.5 ring-1 ring-white/15">
          <BrandMark size={34} />
        </span>
        <span className="text-xl font-semibold tracking-tight">{PLATFORM_NAME}</span>
      </div>

      <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
        <div className="auth-float rounded-3xl bg-white/95 p-5 text-neutral-900 shadow-2xl shadow-black/30 ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-2xl" style={{ backgroundColor: BRAND.amber }} />
            <div className="flex-1 space-y-2">
              <span className="block h-3 w-2/3 rounded-full bg-neutral-900/80" />
              <span className="block h-2.5 w-1/3 rounded-full bg-neutral-900/20" />
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            {[56, 72, 48].map((w, i) => (
              <span
                key={w}
                className="h-7 rounded-full"
                style={{ width: w, backgroundColor: i === 0 ? BRAND.green : "rgb(0 0 0 / 0.06)" }}
              />
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-neutral-900/[0.04] p-2.5">
                <span className="size-12 shrink-0 rounded-xl bg-neutral-900/10" />
                <div className="flex-1 space-y-2">
                  <span className="block h-2.5 w-3/4 rounded-full bg-neutral-900/60" />
                  <span className="block h-2 w-1/2 rounded-full bg-neutral-900/15" />
                </div>
                <span className="h-6 w-12 rounded-full" style={{ backgroundColor: `color-mix(in oklab, ${BRAND.green} 18%, white)` }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="relative max-w-md text-3xl leading-snug font-semibold text-balance xl:text-4xl">{tagline}</p>
    </aside>
  );
}
