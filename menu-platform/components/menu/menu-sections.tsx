"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowUpDown, Check, LayoutGrid, List, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, pick } from "@/lib/i18n/config";
import type { Category, ItemTag, MenuItem } from "@/lib/data/types";
import { discountPercent } from "@/lib/format/price";
import {
  applyFilters,
  availableFilters,
  isFiltering,
  isOnOffer,
  SORT_KEYS,
  type FilterKey,
  type FilterState,
  type SortKey,
} from "@/lib/menu/filters";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMenu, type ViewMode } from "./menu-context";
import { categoryIcon, TAG_ICONS } from "./icons";
import { MenuImage } from "./menu-image";
import { ItemPrice } from "./price";

type Cat = Category & { items: MenuItem[] };
export const sectionId = (c: { id: string }) => `cat-${c.id}`;
const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ------------------------------------------------------------------ */
/* Scroll spy                                                          */
/* ------------------------------------------------------------------ */

export function useScrollSpy(ids: string[]) {
  const key = ids.join("|");
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const lock = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const reduced = useReducedMotion();

  useEffect(() => {
    const els = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    let io: IntersectionObserver | null = null;
    const setup = () => {
      io?.disconnect();
      const offset = Number.parseFloat(getComputedStyle(els[0]).scrollMarginTop) || 120;
      const bottom = Math.max(0, window.innerHeight - offset - 2);
      io = new IntersectionObserver(
        (entries) => {
          if (lock.current) return;
          for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
        },
        { rootMargin: `-${offset}px 0px -${bottom}px 0px` },
      );
      els.forEach((el) => io!.observe(el));
    };
    setup();
    window.addEventListener("resize", setup);
    return () => {
      io?.disconnect();
      window.removeEventListener("resize", setup);
    };
  }, [key]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    lock.current = id;
    setActive(id);
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    const release = () => {
      lock.current = null;
      window.clearTimeout(timer.current);
    };
    window.addEventListener("scrollend", release, { once: true });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(release, 1100);
  };

  return { active: active && ids.includes(active) ? active : (ids[0] ?? null), scrollTo };
}

/* ------------------------------------------------------------------ */
/* Category showcase (photo cards)                                     */
/* ------------------------------------------------------------------ */

export function CategoryShowcase({ onSelect }: { onSelect: (id: string) => void }) {
  const { categories, restaurant } = useMenu();
  const { lang } = useI18n();
  const t = useMessages("menu").categories;
  const tpl = restaurant.theme.template;
  if (categories.length < 2) return null;
  return (
    <section aria-labelledby="showcase-title" className="mx-auto max-w-7xl pt-10 md:pt-14">
      <h2 id="showcase-title" className={cn("px-4 text-xl font-extrabold md:px-8 md:text-2xl", tpl === "noir" && "font-semibold")}>
        {tpl === "pop" ? <span className="m-highlight">{t.title}</span> : t.title}
      </h2>
      <motion.ul
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        className="no-scrollbar m-snap-x mt-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 md:grid md:grid-cols-4 md:overflow-visible md:px-8 lg:grid-cols-5 xl:grid-cols-6"
      >
        {categories.map((c) => {
          const Icon = categoryIcon(c.icon);
          const count = c.items.length;
          return (
            <motion.li
              key={c.id}
              variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
              className="w-[38%] max-w-44 min-w-32 shrink-0 md:w-auto md:max-w-none"
            >
              <button
                type="button"
                onClick={() => onSelect(sectionId(c))}
                className={cn(
                  "m-card m-focus group block aspect-[4/5] overflow-hidden",
                  tpl === "noir" && "aspect-[3/4]",
                )}
              >
                <MenuImage
                  src={c.imageUrl}
                  blur={c.imageBlur}
                  alt=""
                  icon={c.icon}
                  sizes="(min-width:1280px) 16vw, (min-width:768px) 22vw, 40vw"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" aria-hidden />
                <span className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-0.5 p-3 text-start text-white">
                  <span className="grid size-8 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className={cn("mt-1 text-base leading-tight font-bold", tpl === "pop" && "font-black")}>
                    {pick(c.name, lang)}
                  </span>
                  <span className="text-[0.7rem] opacity-80">{count === 1 ? t.countOne : fmt(t.count, { n: count })}</span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sticky category navigation                                          */
/* ------------------------------------------------------------------ */

export function CategoryPills({
  categories,
  active,
  onSelect,
}: {
  categories: Cat[];
  active: string | null;
  onSelect: (id: string) => void;
}) {
  const { lang } = useI18n();
  const t = useMessages("menu").categories;
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = scroller.current;
    const pill = active ? c?.querySelector<HTMLElement>(`[data-pill="${active}"]`) : null;
    if (!c || !pill) return;
    const cr = c.getBoundingClientRect();
    const pr = pill.getBoundingClientRect();
    const delta = pr.left + pr.width / 2 - (cr.left + cr.width / 2);
    if (Math.abs(delta) > 4) c.scrollBy({ left: delta, behavior: "smooth" });
  }, [active]);
  return (
    <nav
      aria-label={t.nav}
      className="m-glass sticky top-(--menu-header-h) z-30 border-b border-(--m-line) lg:hidden"
    >
      <motion.div ref={scroller} layoutScroll className="no-scrollbar flex h-(--menu-nav-h) items-center gap-1.5 overflow-x-auto px-3">
        {categories.map((c) => {
          const id = sectionId(c);
          const isActive = id === active;
          const Icon = categoryIcon(c.icon);
          return (
            <button
              key={c.id}
              type="button"
              data-pill={id}
              aria-current={isActive ? "true" : undefined}
              onClick={() => onSelect(id)}
              className={cn(
                "m-focus relative flex h-10 shrink-0 items-center gap-1.5 rounded-(--r-pill) px-3.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200",
                isActive ? "text-(--brand-contrast)" : "text-(--m-muted) hover:text-(--m-fg)",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="pill-indicator"
                  className="absolute inset-0 rounded-(--r-pill) bg-(--brand) shadow-[0_6px_16px_-8px_var(--brand)]"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  aria-hidden
                />
              )}
              <Icon className="relative size-4" aria-hidden />
              <span className="relative">{pick(c.name, lang)}</span>
            </button>
          );
        })}
      </motion.div>
    </nav>
  );
}

export function CategorySidebar({
  categories,
  active,
  onSelect,
}: {
  categories: Cat[];
  active: string | null;
  onSelect: (id: string) => void;
}) {
  const { lang } = useI18n();
  const t = useMessages("menu").categories;
  return (
    <nav aria-label={t.nav} className="sticky top-[calc(var(--menu-header-h)+1.25rem)] hidden max-h-[calc(100dvh-var(--menu-header-h)-2.5rem)] overflow-y-auto pb-6 lg:block">
      <ul className="flex flex-col gap-1">
        {categories.map((c) => {
          const id = sectionId(c);
          const isActive = id === active;
          const Icon = categoryIcon(c.icon);
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelect(id)}
                className={cn(
                  "m-focus relative flex min-h-11 w-full items-center gap-3 rounded-(--r-pill) px-3.5 py-2 text-start text-[0.95rem] font-semibold transition-colors",
                  isActive ? "text-(--brand-contrast)" : "text-(--m-muted) hover:bg-(--m-surface-2) hover:text-(--m-fg)",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="side-indicator"
                    className="absolute inset-0 rounded-(--r-pill) bg-(--brand)"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    aria-hidden
                  />
                )}
                <Icon className="relative size-[1.1rem] shrink-0" aria-hidden />
                <span className="relative flex-1 truncate">{pick(c.name, lang)}</span>
                <span className={cn("relative text-xs tabular-nums", isActive ? "opacity-80" : "opacity-60")}>
                  {c.items.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <motion.button
      layout="position"
      type="button"
      aria-pressed={active}
      aria-label={label}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={cn(
        "m-focus flex h-10 shrink-0 items-center gap-1.5 rounded-(--r-pill) border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200",
        active
          ? "border-transparent bg-(--brand) text-(--brand-contrast) shadow-[0_6px_18px_-10px_var(--brand)]"
          : "border-(--m-line) bg-(--m-surface) text-(--m-fg) hover:border-(--m-muted)",
      )}
    >
      {children}
    </motion.button>
  );
}

const FILTER_TAG: Record<FilterKey, ItemTag | null> = {
  offers: null,
  new: "new",
  popular: "popular",
  spicy: "spicy",
  vegetarian: "vegetarian",
};

export function FilterBar({
  filters,
  setFilters,
  keys,
  count,
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  keys: FilterKey[];
  count: number;
}) {
  const t = useMessages("menu").filters;
  const { view, setView } = useMenu();
  const filtering = isFiltering(filters);
  const barRef = useRef<HTMLDivElement>(null);
  // Publish the real bar height so category jumps / scroll-spy clear the sticky bar at lg+.
  useEffect(() => {
    const el = barRef.current;
    const root = el?.closest<HTMLElement>(".menu-root");
    if (!el || !root) return;
    const publish = () => {
      root.style.setProperty("--menu-filter-h", `${el.getBoundingClientRect().height}px`);
      window.dispatchEvent(new Event("resize"));
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sortLabel: Record<SortKey, string> = {
    recommended: t.recommended,
    "price-asc": t.priceAsc,
    "price-desc": t.priceDesc,
  };
  const toggle = (k: FilterKey) =>
    setFilters({
      ...filters,
      active: filters.active.includes(k) ? filters.active.filter((x) => x !== k) : [...filters.active, k],
    });
  return (
    <div ref={barRef} className="z-20 bg-(--m-bg)/90 py-3 backdrop-blur-md lg:sticky lg:top-(--menu-header-h)">
      <LayoutGroup id="filters">
        <div role="toolbar" aria-label={t.label} className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {keys.map((k) => {
            const tag = FILTER_TAG[k];
            const Icon = tag ? TAG_ICONS[tag] : null;
            const on = filters.active.includes(k);
            return (
              <Chip key={k} active={on} onClick={() => toggle(k)}>
                <AnimatePresence initial={false} mode="popLayout">
                  {on ? (
                    <motion.span key="on" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Check className="size-4" aria-hidden />
                    </motion.span>
                  ) : Icon ? (
                    <motion.span key="icon" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Icon className="size-4" aria-hidden />
                    </motion.span>
                  ) : (
                    <motion.span key="pct" className="text-xs font-black" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      %
                    </motion.span>
                  )}
                </AnimatePresence>
                {t[k]}
              </Chip>
            );
          })}
          <span className="mx-0.5 h-6 w-px shrink-0 bg-(--m-line)" aria-hidden />
          <DropdownMenu dir={undefined}>
            <DropdownMenuTrigger asChild>
              <motion.button
                layout="position"
                whileTap={{ scale: 0.93 }}
                type="button"
                aria-label={t.sortLabel}
                className={cn(
                  "m-focus flex h-10 shrink-0 items-center gap-1.5 rounded-(--r-pill) border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
                  filters.sort !== "recommended"
                    ? "border-transparent bg-(--brand) text-(--brand-contrast)"
                    : "border-(--m-line) bg-(--m-surface) text-(--m-fg)",
                )}
              >
                <ArrowUpDown className="size-4" aria-hidden />
                {filters.sort === "recommended" ? t.sort : sortLabel[filters.sort]}
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuRadioGroup value={filters.sort} onValueChange={(v) => setFilters({ ...filters, sort: v as SortKey })}>
                {SORT_KEYS.map((s) => (
                  <DropdownMenuRadioItem key={s} value={s} className="min-h-11">
                    {sortLabel[s]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Chip active={filters.availableOnly} onClick={() => setFilters({ ...filters, availableOnly: !filters.availableOnly })}>
            <span
              className={cn(
                "relative h-4 w-7 rounded-full transition-colors",
                filters.availableOnly ? "bg-(--brand-contrast)/35" : "bg-(--m-line)",
              )}
              aria-hidden
            >
              <motion.span
                className={cn("absolute top-0.5 size-3 rounded-full", filters.availableOnly ? "bg-(--brand-contrast)" : "bg-(--m-muted)")}
                animate={{ insetInlineStart: filters.availableOnly ? 14 : 2 }}
                transition={{ type: "spring", stiffness: 600, damping: 35 }}
              />
            </span>
            {t.availableOnly}
          </Chip>
        </div>
      </LayoutGroup>
      <div className="mt-2.5 flex min-h-9 items-center gap-3 text-sm">
        <AnimatePresence initial={false}>
          {filtering && (
            <motion.div
              key="count"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-3"
            >
              <span className="font-semibold text-(--m-fg)" aria-live="polite">
                {count === 1 ? t.resultsOne : fmt(t.results, { n: count })}
              </span>
              <button
                type="button"
                onClick={() => setFilters({ active: [], sort: "recommended", availableOnly: false })}
                className="m-press m-focus m-brand-text inline-flex h-9 items-center gap-1 rounded-full px-2 font-semibold"
              >
                <X className="size-4" aria-hidden />
                {t.clear}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <ViewToggle view={view} setView={setView} />
      </div>
    </div>
  );
}

function ViewToggle({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }) {
  const t = useMessages("menu").filters;
  const opts: Array<{ v: ViewMode; label: string; Icon: typeof List }> = [
    { v: "grid", label: t.grid, Icon: LayoutGrid },
    { v: "list", label: t.list, Icon: List },
  ];
  return (
    <div role="radiogroup" aria-label={t.view} className="ms-auto flex rounded-full border border-(--m-line) bg-(--m-surface) p-0.5">
      {opts.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={view === v}
          aria-label={label}
          title={label}
          onClick={() => setView(v)}
          className={cn(
            "m-focus relative grid h-10 w-11 place-items-center rounded-full transition-colors",
            view === v ? "text-(--brand-contrast)" : "text-(--m-muted)",
          )}
        >
          {view === v && (
            <motion.span layoutId="view-indicator" className="absolute inset-0 rounded-full bg-(--brand)" aria-hidden />
          )}
          <Icon className="relative size-[1.1rem]" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Item card                                                           */
/* ------------------------------------------------------------------ */

export function TagChips({ tags, max = 2, className }: { tags: ItemTag[]; max?: number; className?: string }) {
  const t = useMessages("menu").tags;
  if (tags.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {tags.slice(0, max).map((tag) => {
        const Icon = TAG_ICONS[tag];
        return (
          <span
            key={tag}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[0.68rem] font-semibold",
              tag === "spicy"
                ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                : tag === "vegetarian" || tag === "vegan" || tag === "gluten_free"
                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  : "bg-(--brand)/12 m-brand-text",
            )}
          >
            <Icon className="size-3" aria-hidden />
            {t[tag]}
          </span>
        );
      })}
    </span>
  );
}

export function ItemCard({ item, view, priority = false }: { item: MenuItem; view: ViewMode; priority?: boolean }) {
  const { openItem, restaurant } = useMenu();
  const { lang } = useI18n();
  const t = useMessages("menu").item;
  const name = pick(item.name, lang);
  const desc = pick(item.description, lang);
  const pct = isOnOffer(item) ? discountPercent(item.price, item.oldPrice) : null;
  const noir = restaurant.theme.template === "noir";
  const soldOut = !item.isAvailable;

  const image = (sizes: string, cls: string) => (
    <div className={cn("relative overflow-hidden", cls)}>
      <motion.div layoutId={`img-${item.id}`} className={cn("absolute inset-0", soldOut && "opacity-60 grayscale")}>
        <MenuImage src={item.imageUrl} blur={item.imageBlur} alt="" sizes={sizes} priority={priority} />
      </motion.div>
      {soldOut && <span className="m-ribbon">{t.soldOut}</span>}
      {pct !== null && !soldOut && (
        <span className="absolute end-2 top-2 rounded-full bg-(--brand-accent) px-2 py-0.5 text-[0.7rem] font-extrabold text-(--brand-accent-contrast) shadow-md">
          <bdi dir="ltr">{fmt(t.off, { n: pct })}</bdi>
        </span>
      )}
    </div>
  );

  if (view === "list") {
    return (
      <button
        type="button"
        data-view="list"
        onClick={() => openItem(item.slug, "grid")}
        aria-label={fmt(t.open, { name })}
        className={cn("m-card m-focus items-stretch gap-3 p-3", noir && "px-1 py-4")}
      >
        <span className={cn("flex min-w-0 flex-1 flex-col gap-1", soldOut && "opacity-70")}>
          <span className="flex items-baseline gap-2">
            <span className={cn("text-[1rem] leading-snug font-bold", noir ? "line-clamp-1 font-semibold" : "line-clamp-2")}>{name}</span>
            {noir && (
              <>
                <span className="m-leader" aria-hidden />
                <ItemPrice item={item} className="m-accent-text shrink-0 text-[0.95rem]" />
              </>
            )}
          </span>
          {desc && <span className="line-clamp-2 text-[0.8rem] leading-relaxed text-(--m-muted)">{desc}</span>}
          <TagChips tags={item.tags} className="mt-0.5" />
          {!noir && (
            <span className="mt-auto pt-1.5">
              <ItemPrice item={item} className="m-brand-text text-[0.95rem]" />
            </span>
          )}
        </span>
        {(item.imageUrl || !noir) &&
          image("112px", cn("size-24 shrink-0 self-center rounded-(--r-img) sm:size-28", noir && "size-20 sm:size-24"))}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-view="grid"
      onClick={() => openItem(item.slug, "grid")}
      aria-label={fmt(t.open, { name })}
      className="m-card m-focus flex-col overflow-hidden"
    >
      {image(
        "(min-width:1536px) 300px, (min-width:1024px) 26vw, (min-width:768px) 33vw, 50vw",
        "aspect-[4/3] w-full shrink-0",
      )}
      <span className={cn("flex flex-1 flex-col gap-1 p-3 sm:p-3.5", soldOut && "opacity-70")}>
        <span className={cn("line-clamp-2 text-[0.92rem] leading-snug font-bold sm:text-[1rem]", noir && "font-semibold")}>{name}</span>
        {desc && <span className="line-clamp-2 hidden text-[0.78rem] leading-relaxed text-(--m-muted) min-[400px]:block">{desc}</span>}
        <TagChips tags={item.tags} max={1} className="mt-0.5 hidden sm:flex" />
        <span className="mt-auto pt-2">
          <ItemPrice item={item} className={cn("text-[0.95rem]", noir ? "m-accent-text" : "m-brand-text")} />
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Sections + empty state                                              */
/* ------------------------------------------------------------------ */

function EmptyPlate() {
  return (
    <svg viewBox="0 0 200 140" className="mx-auto h-32 w-auto" aria-hidden>
      <ellipse cx="100" cy="122" rx="70" ry="8" fill="currentColor" opacity=".08" />
      <circle cx="100" cy="74" r="46" fill="var(--m-surface)" stroke="currentColor" strokeOpacity=".15" strokeWidth="2" />
      <circle cx="100" cy="74" r="32" fill="none" stroke="var(--brand)" strokeOpacity=".5" strokeWidth="2" strokeDasharray="4 6" />
      <path d="M38 40v26m-6-26v14a6 6 0 0 0 12 0V40M38 66v44" stroke="currentColor" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M162 40c-8 4-10 16-10 26h10v44" stroke="currentColor" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M90 34c-4-6 4-10 0-16M104 34c-4-6 4-10 0-16" stroke="var(--brand-accent)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".7" />
    </svg>
  );
}

function SectionTitle({ c, index }: { c: Cat; index: number }) {
  const { restaurant } = useMenu();
  const { lang } = useI18n();
  const t = useMessages("menu").categories;
  const tpl = restaurant.theme.template;
  const desc = pick(c.description, lang);
  const count = c.items.length;
  if (tpl === "noir") {
    return (
      <header className="mb-4">
        <div className="flex items-center gap-3">
          <span className="m-accent-text text-xs font-semibold tracking-[0.3em] tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <span className="h-px flex-1 bg-(--m-line)" aria-hidden />
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{pick(c.name, lang)}</h2>
        {desc && <p className="mt-1.5 max-w-2xl text-sm text-(--m-muted)">{desc}</p>}
      </header>
    );
  }
  return (
    <header className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-1">
      <h2 className={cn("text-2xl tracking-tight md:text-3xl", tpl === "pop" ? "font-black" : "font-extrabold")}>
        {tpl === "pop" ? <span className="m-highlight">{pick(c.name, lang)}</span> : pick(c.name, lang)}
      </h2>
      <span className="mb-1 rounded-full bg-(--m-surface-2) px-2.5 py-0.5 text-xs font-semibold text-(--m-muted)">
        {count === 1 ? t.countOne : fmt(t.count, { n: count })}
      </span>
      {desc && <p className="w-full max-w-2xl text-sm text-(--m-muted)">{desc}</p>}
    </header>
  );
}

export function useFilteredMenu(filters: FilterState) {
  const { categories } = useMenu();
  const filtered = useMemo(() => applyFilters(categories, filters), [categories, filters]);
  const keys = useMemo(() => availableFilters(categories), [categories]);
  const visible = filtered.filter((c) => c.visibleItems.length > 0);
  const count = visible.reduce((n, c) => n + c.visibleItems.length, 0);
  return { visible, keys, count };
}

export function MenuSections({
  visible,
  view,
  filtering,
  active,
  onSelect,
  onClear,
}: {
  visible: Array<Cat & { visibleItems: MenuItem[] }>;
  view: ViewMode;
  filtering: boolean;
  active: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const t = useMessages("menu").filters;
  const { dir } = useI18n();
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    const p = e.touches[0];
    if (!p || e.touches.length > 1) return;
    // Ignore swipes from the screen edges (system back gestures).
    if (p.clientX < 24 || p.clientX > window.innerWidth - 24) return;
    touch.current = { x: p.clientX, y: p.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    const p = e.changedTouches[0];
    if (!start || !p || window.innerWidth >= 1024) return;
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2.2 || Date.now() - start.t > 700) return;
    const idx = visible.findIndex((c) => sectionId(c) === active);
    const forward = dir === "rtl" ? dx > 0 : dx < 0;
    const next = visible[Math.min(visible.length - 1, Math.max(0, idx + (forward ? 1 : -1)))];
    if (next && sectionId(next) !== active) onSelect(sectionId(next));
  };

  if (visible.length === 0 && !filtering) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center text-(--m-fg)">
        <EmptyPlate />
        <h3 className="mt-4 text-lg font-bold">{t.soonTitle}</h3>
        <p className="mt-1 max-w-xs text-sm text-(--m-muted)">{t.soonBody}</p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center px-6 py-16 text-center text-(--m-fg)"
      >
        <EmptyPlate />
        <h3 className="mt-4 text-lg font-bold">{t.emptyTitle}</h3>
        <p className="mt-1 max-w-xs text-sm text-(--m-muted)">{t.emptyBody}</p>
        <button
          type="button"
          onClick={onClear}
          className="m-press m-focus mt-5 h-11 rounded-full bg-(--brand) px-6 text-sm font-bold text-(--brand-contrast)"
        >
          {t.clear}
        </button>
      </motion.div>
    );
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="flex flex-col gap-10 pb-10 md:gap-14">
      {visible.map((c, ci) => (
        <section key={c.id} id={sectionId(c)} aria-label={undefined} className="scroll-mt-(--menu-offset)">
          <SectionTitle c={c} index={ci} />
          <motion.ul
            layout
            className={cn(
              "grid",
              view === "grid"
                ? "grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-4"
                : "grid-cols-1 gap-3 md:grid-cols-2 md:gap-4",
            )}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {c.visibleItems.map((item, i) => (
                <motion.li
                  key={item.id}
                  layout="position"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "0px 0px -30px 0px" }}
                  exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
                  transition={{ duration: 0.38, ease: EASE, delay: Math.min(i, 6) * 0.03 }}
                  className="min-w-0"
                >
                  <ItemCard item={item} view={view} priority={ci === 0 && i < 2} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </section>
      ))}
    </div>
  );
}
