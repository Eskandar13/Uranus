"use client";

import { useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { isOptimizableImage } from "@/lib/menu/image-url";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useTheme } from "next-themes";
import { Languages, Moon, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { otherLocale, pick } from "@/lib/i18n/config";
import { getCurrency } from "@/lib/format/price";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { useMenu } from "./menu-context";
import { languageSwitchUrl, useMounted } from "./hooks";
import { RollingText } from "./price";

type VTDocument = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

/** Dark/light toggle with a circular reveal (View Transitions) or a soft crossfade fallback. */
export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const reduced = useReducedMotion();
  return {
    isDark: resolvedTheme === "dark",
    toggle(e?: MouseEvent<HTMLElement>) {
      const next = resolvedTheme === "dark" ? "light" : "dark";
      const root = document.documentElement;
      const doc = document as VTDocument;
      if (reduced) {
        setTheme(next);
        return;
      }
      if (!doc.startViewTransition) {
        root.classList.add("m-theme-fade");
        setTheme(next);
        window.setTimeout(() => root.classList.remove("m-theme-fade"), 380);
        return;
      }
      const rect = e?.currentTarget.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : 0;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.classList.add("m-vt");
      const vt = doc.startViewTransition(() => {
        root.classList.toggle("dark", next === "dark");
        root.classList.toggle("light", next === "light");
        root.style.colorScheme = next;
        flushSync(() => setTheme(next));
      });
      vt.ready
        .then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 520, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
          );
        })
        .catch(() => {});
      vt.finished.finally(() => root.classList.remove("m-vt"));
    },
  };
}

function HeaderButton({
  label,
  onClick,
  children,
  solid,
  className,
}: {
  label: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  solid: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "m-press m-focus relative grid h-11 min-w-11 place-items-center rounded-full px-2.5 text-sm font-semibold transition-colors duration-300",
        solid
          ? "text-(--m-fg) hover:bg-(--m-surface-2)"
          : "bg-black/30 text-white backdrop-blur-md hover:bg-black/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MenuHeader({ onSearch, overHero = true }: { onSearch: () => void; overHero?: boolean }) {
  const { restaurant, currency, setCurrency } = useMenu();
  const { lang } = useI18n();
  const m = useMessages("menu");
  const t = m.header;
  const router = useRouter();
  const mounted = useMounted();
  const { isDark, toggle } = useThemeToggle();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(!overHero);
  const [switching, setSwitching] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => {
    const next = !overHero || v > 72;
    if (next !== scrolled) setScrolled(next);
  });
  const bgOpacity = useTransform(scrollY, [24, 96], overHero ? [0, 1] : [1, 1]);

  const name = pick(restaurant.name, lang);
  const secondary = restaurant.secondaryCurrency;
  const canSwitchCurrency = Boolean(secondary && restaurant.exchangeRate && secondary !== restaurant.currency);
  const nextCurrency = currency === restaurant.currency ? secondary! : restaurant.currency;
  const target = otherLocale(lang);

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]"
      style={{ paddingInline: "max(0.75rem, env(safe-area-inset-left)) max(0.75rem, env(safe-area-inset-right))" }}
    >
      <motion.div
        aria-hidden
        style={{ opacity: bgOpacity }}
        className="m-glass pointer-events-none absolute inset-0 border-b border-(--m-line)"
      />
      <div className="relative mx-auto flex h-14 max-w-7xl items-center gap-1.5">
        <a
          href="#menu"
          className="m-focus sr-only rounded-full bg-(--brand) px-4 py-2 text-(--brand-contrast) focus:not-sr-only focus:absolute focus:start-0"
        >
          {m.a11y.skipToMenu}
        </a>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={t.toTop}
          className={cn(
            "m-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1 pe-2 text-start transition-opacity duration-300",
            scrolled ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          tabIndex={scrolled ? 0 : -1}
        >
          {restaurant.logoUrl ? (
            <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-(--m-surface) ring-1 ring-(--m-line)">
              <Image src={restaurant.logoUrl} unoptimized={!isOptimizableImage(restaurant.logoUrl)} alt="" fill sizes="36px" className="object-cover" />
            </span>
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-(--brand) text-sm font-bold text-(--brand-contrast)">
              {name.slice(0, 1)}
            </span>
          )}
          <motion.span
            className="truncate text-[0.95rem] font-bold text-(--m-fg)"
            animate={{ y: scrolled ? 0 : 6 }}
            transition={{ duration: 0.25 }}
          >
            {name}
          </motion.span>
        </button>

        <HeaderButton label={t.search} onClick={onSearch} solid={scrolled}>
          <Search className="size-5" aria-hidden />
        </HeaderButton>

        {canSwitchCurrency && (
          <HeaderButton
            label={t.currencyLabel.replace("{code}", getCurrency(nextCurrency).code)}
            onClick={() => setCurrency(nextCurrency)}
            solid={scrolled}
            className="text-xs tracking-wide"
          >
            <RollingText text={getCurrency(currency).symbol[lang] || currency} />
          </HeaderButton>
        )}

        <HeaderButton
          label={t.switchLanguageLabel}
          solid={scrolled}
          onClick={() => {
            setSwitching(true);
            router.push(languageSwitchUrl(target), { scroll: false });
          }}
          className="gap-1"
        >
          <span className="relative inline-grid place-items-center">
            <AnimatePresence initial={false} mode="popLayout">
              {switching ? (
                <motion.span
                  key="switching"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1, rotate: 180 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <Languages className="size-5" aria-hidden />
                </motion.span>
              ) : (
                <motion.span
                  key="label"
                  lang={target}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="px-0.5 text-[0.82rem] font-bold"
                >
                  {t.switchLanguage}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </HeaderButton>

        <HeaderButton label={isDark ? t.themeToLight : t.themeToDark} onClick={(e) => toggle(e)} solid={scrolled}>
          <AnimatePresence initial={false} mode="popLayout">
            {mounted && (
              <motion.span
                key={isDark ? "moon" : "sun"}
                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                transition={{ duration: 0.3 }}
                className="grid place-items-center"
              >
                {isDark ? <Moon className="size-5" aria-hidden /> : <Sun className="size-5" aria-hidden />}
              </motion.span>
            )}
          </AnimatePresence>
        </HeaderButton>
      </div>
    </header>
  );
}
