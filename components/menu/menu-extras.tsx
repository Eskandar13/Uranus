"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import useEmblaCarousel from "embla-carousel-react";
import { ChefHat, ChevronLeft, ChevronRight, Clock, Globe, Mail, MapPin, Phone, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, pick } from "@/lib/i18n/config";
import { DAY_KEYS, type MenuItem } from "@/lib/data/types";
import { PLATFORM_NAME } from "@/lib/env";
import { discountPercent } from "@/lib/format/price";
import { featuredItems, isOnOffer } from "@/lib/menu/filters";
import { dayKeyOf } from "@/lib/menu/hours";
import { buildSearchIndex, searchMenu } from "@/lib/search/search";
import { findMatchRanges, queryTokens } from "@/lib/search/normalize";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { useMenu } from "./menu-context";
import { useMenuShell } from "./menu-shell";
import { useNow } from "./hooks";
import { FacebookGlyph, InstagramGlyph, TiktokGlyph, WhatsappGlyph } from "./icons";
import { MenuImage } from "./menu-image";
import { ItemPrice } from "./price";

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  const ranges = findMatchRanges(text, tokens);
  if (ranges.length === 0) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let last = 0;
  ranges.forEach(([s, e], i) => {
    if (s > last) out.push(text.slice(last, s));
    out.push(
      <mark key={i} className="rounded-sm bg-(--brand)/25 px-0.5 text-inherit">
        {text.slice(s, e)}
      </mark>,
    );
    last = e;
  });
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function ResultRow({ item, tokens, onPick, index }: { item: MenuItem; tokens: string[]; onPick: (i: MenuItem) => void; index: number }) {
  const { lang } = useI18n();
  const { categoryById } = useMenu();
  const desc = pick(item.description, lang);
  const cat = categoryById.get(item.categoryId);
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.025 }}
    >
      <button
        type="button"
        onClick={() => onPick(item)}
        className="m-focus flex w-full items-center gap-3 rounded-(--r-card) p-2 text-start transition-colors hover:bg-(--m-surface-2) focus-visible:bg-(--m-surface-2)"
      >
        <span className={cn("relative size-14 shrink-0 overflow-hidden rounded-(--r-img) bg-(--m-surface-2)", !item.isAvailable && "opacity-60 grayscale")}>
          <MenuImage src={item.imageUrl} blur={item.imageBlur} alt="" sizes="56px" zoom={false} icon={cat?.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 font-semibold">
            <Highlight text={pick(item.name, lang)} tokens={tokens} />
          </span>
          {desc && (
            <span className="line-clamp-1 text-xs text-(--m-muted)">
              <Highlight text={desc} tokens={tokens} />
            </span>
          )}
          {cat && <span className="text-[0.7rem] text-(--m-muted)">{pick(cat.name, lang)}</span>}
        </span>
        <ItemPrice item={item} className="m-brand-text shrink-0 text-sm" />
      </button>
    </motion.li>
  );
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categories, openItem, recentSlugs, itemBySlug } = useMenu();
  const { portal } = useMenuShell();
  const { dir } = useI18n();
  const t = useMessages("menu").search;
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const index = useMemo(() => buildSearchIndex(categories), [categories]);
  const results = useMemo(() => searchMenu(index, deferred), [index, deferred]);
  const tokens = useMemo(() => queryTokens(deferred), [deferred]);
  const recent = recentSlugs.map((s) => itemBySlug.get(s)).filter((i): i is MenuItem => Boolean(i)).slice(0, 4);
  const suggested = useMemo(() => featuredItems(categories, 6), [categories]);

  const pickItem = (item: MenuItem) => {
    onClose();
    openItem(item.slug, "other");
  };
  const close = () => {
    onClose();
    setQuery("");
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && close()}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount container={portal}>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content forceMount dir={dir} aria-describedby={undefined} className="fixed inset-x-0 top-0 z-50 outline-none">
              <motion.div
                initial={{ opacity: 0, y: -24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.16 } }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                style={{ transformOrigin: dir === "rtl" ? "15% 0%" : "85% 0%" }}
                className="m-sheet mx-auto flex max-h-[100dvh] w-full max-w-2xl flex-col shadow-2xl sm:mt-4 sm:max-h-[85dvh] sm:rounded-[calc(var(--r-card)+0.25rem)]"
              >
                <DialogPrimitive.Title className="sr-only">{t.label}</DialogPrimitive.Title>
                <div className="flex items-center gap-2 border-b border-(--m-line) p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-(--m-muted)" aria-hidden />
                    <input
                      autoFocus
                      type="search"
                      inputMode="search"
                      enterKeyHint="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t.placeholder}
                      aria-label={t.placeholder}
                      className="h-12 w-full rounded-full border border-(--m-line) bg-(--m-surface-2) ps-11 pe-11 text-base text-(--m-fg) outline-none placeholder:text-(--m-muted) focus:border-(--brand) [&::-webkit-search-cancel-button]:hidden"
                    />
                    <AnimatePresence>
                      {query && (
                        <motion.button
                          type="button"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          onClick={() => setQuery("")}
                          aria-label={t.clear}
                          className="m-focus absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-(--m-muted)"
                        >
                          <X className="size-4" aria-hidden />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                  <DialogPrimitive.Close
                    aria-label={t.close}
                    className="m-press m-focus grid size-11 shrink-0 place-items-center rounded-full text-(--m-fg) hover:bg-(--m-surface-2)"
                  >
                    <X className="size-5" aria-hidden />
                  </DialogPrimitive.Close>
                </div>
                <div className="overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                  {tokens.length > 0 ? (
                    results.length > 0 ? (
                      <>
                        <p className="px-2 py-1.5 text-xs font-semibold text-(--m-muted)" aria-live="polite">
                          {results.length === 1 ? t.resultsOne : fmt(t.results, { n: results.length })}
                        </p>
                        <ul>
                          {results.map((r, i) => (
                            <ResultRow key={r.item.id} item={r.item} tokens={tokens} onPick={pickItem} index={i} />
                          ))}
                        </ul>
                      </>
                    ) : (
                      <div className="px-6 py-12 text-center" aria-live="polite">
                        <Search className="mx-auto size-10 text-(--m-muted)/50" aria-hidden />
                        <p className="mt-3 font-semibold">{fmt(t.none, { q: deferred.trim() })}</p>
                        <p className="mt-1 text-sm text-(--m-muted)">{t.noneHint}</p>
                      </div>
                    )
                  ) : (
                    <>
                      {recent.length > 0 && (
                        <>
                          <p className="px-2 pt-2 pb-1 text-xs font-semibold text-(--m-muted)">{t.recent}</p>
                          <ul>
                            {recent.map((item, i) => (
                              <ResultRow key={item.id} item={item} tokens={[]} onPick={pickItem} index={i} />
                            ))}
                          </ul>
                        </>
                      )}
                      {suggested.length > 0 && (
                        <>
                          <p className="px-2 pt-3 pb-1 text-xs font-semibold text-(--m-muted)">{t.suggested}</p>
                          <ul>
                            {suggested.map((item, i) => (
                              <ResultRow key={item.id} item={item} tokens={[]} onPick={pickItem} index={i} />
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Featured carousel (embla, RTL aware)                                */
/* ------------------------------------------------------------------ */

export function FeaturedCarousel() {
  const { categories, openItem, restaurant } = useMenu();
  const { lang, dir } = useI18n();
  const m = useMessages("menu");
  const t = m.featured;
  const items = useMemo(() => featuredItems(categories, 10), [categories]);
  const [emblaRef, api] = useEmblaCarousel({ direction: dir, align: "start", containScroll: "trimSnaps" });
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    const onInit = () => setSnaps(api.scrollSnapList());
    api.on("select", onSelect).on("reInit", onInit).on("reInit", onSelect).on("init", onInit);
    queueMicrotask(onInit);
    return () => {
      api.off("select", onSelect).off("reInit", onInit).off("reInit", onSelect).off("init", onInit);
    };
  }, [api]);
  if (items.length === 0) return null;
  const tpl = restaurant.theme.template;
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <section aria-roledescription="carousel" aria-labelledby="featured-title" className="mx-auto max-w-7xl pt-10 md:pt-14">
      <div className="flex items-end justify-between gap-3 px-4 md:px-8">
        <div>
          <p className="m-accent-text text-xs font-bold tracking-[0.2em] uppercase">{t.eyebrow}</p>
          <h2 id="featured-title" className={cn("text-xl md:text-2xl", tpl === "pop" ? "font-black" : tpl === "noir" ? "font-semibold" : "font-extrabold")}>
            {t.title}
          </h2>
        </div>
        <div className="hidden gap-2 md:flex">
          <button type="button" aria-label={t.prev} onClick={() => api?.scrollPrev()} className="m-press m-focus grid size-11 place-items-center rounded-full border border-(--m-line) bg-(--m-surface)">
            <Prev className="size-5" aria-hidden />
          </button>
          <button type="button" aria-label={t.next} onClick={() => api?.scrollNext()} className="m-press m-focus grid size-11 place-items-center rounded-full border border-(--m-line) bg-(--m-surface)">
            <Next className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <div ref={emblaRef} dir={dir} className="mt-4 overflow-hidden px-4 md:px-8">
        <ul className="-ms-3 flex touch-pan-y py-2">
          {items.map((item) => {
            const pct = isOnOffer(item) ? discountPercent(item.price, item.oldPrice) : null;
            const cat = categories.find((c) => c.id === item.categoryId);
            return (
              <li key={item.id} className="min-w-0 shrink-0 grow-0 basis-[84%] ps-3 sm:basis-[52%] lg:basis-[36%] xl:basis-[30%]">
                <button
                  type="button"
                  onClick={() => openItem(item.slug, "other")}
                  className="m-card m-focus group block aspect-[5/4] overflow-hidden text-white sm:aspect-[4/3]"
                >
                  <MenuImage src={item.imageUrl} blur={item.imageBlur} alt="" icon={cat?.icon} sizes="(min-width:1280px) 30vw, (min-width:640px) 52vw, 84vw" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden />
                  <span className="absolute start-3 top-3 flex gap-1.5">
                    {pct !== null ? (
                      <span className="rounded-full bg-(--brand-accent) px-2.5 py-1 text-xs font-extrabold text-(--brand-accent-contrast) shadow">
                        {m.item.offer} <bdi dir="ltr">{fmt(m.item.off, { n: pct })}</bdi>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-neutral-900 shadow">
                        <ChefHat className="size-3.5" aria-hidden />
                        {m.tags.chef_pick}
                      </span>
                    )}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-start">
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-lg leading-tight font-bold">{pick(item.name, lang)}</span>
                      <span className="line-clamp-1 text-xs opacity-80">{pick(item.description, lang)}</span>
                    </span>
                    <ItemPrice item={item} className="shrink-0 rounded-full bg-white/95 px-3 py-1 text-sm text-neutral-900" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {snaps.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {snaps.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={fmt(t.goTo, { n: i + 1 })}
              aria-current={i === selected ? "true" : undefined}
              onClick={() => api?.scrollTo(i)}
              className="m-focus grid h-6 w-6 place-items-center rounded-full"
            >
              <span className={cn("block h-1.5 rounded-full transition-all duration-300", i === selected ? "w-5 bg-(--brand)" : "w-1.5 bg-(--m-muted)/40")} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

export function MenuFooter() {
  const { restaurant } = useMenu();
  const { lang } = useI18n();
  const t = useMessages("menu").footer;
  const now = useNow();
  const today = now ? dayKeyOf(now, restaurant.timezone) : null;
  const c = restaurant.contact;
  const address = pick(c.address, lang);
  const hours = restaurant.openingHours;
  const hasHours = DAY_KEYS.some((d) => hours[d]);
  const socials = [
    c.instagram && { href: c.instagram, label: "Instagram", Icon: InstagramGlyph },
    c.facebook && { href: c.facebook, label: "Facebook", Icon: FacebookGlyph },
    c.tiktok && { href: c.tiktok, label: "TikTok", Icon: TiktokGlyph },
    c.whatsapp && { href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`, label: "WhatsApp", Icon: WhatsappGlyph },
    c.website && { href: c.website, label: "Website", Icon: Globe },
  ].filter(Boolean) as Array<{ href: string; label: string; Icon: React.ComponentType<{ className?: string }> }>;

  return (
    <footer className="mt-6 border-t border-(--m-line) bg-(--m-surface-2)/60 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-3 md:px-8">
        <div className="space-y-3">
          <h2 className="text-lg font-bold">{pick(restaurant.name, lang)}</h2>
          {pick(restaurant.description, lang) && <p className="text-sm leading-relaxed text-(--m-muted)">{pick(restaurant.description, lang)}</p>}
          {address && (
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="m-brand-text mt-0.5 size-4 shrink-0" aria-hidden />
              {c.mapsUrl ? (
                <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="m-focus underline-offset-4 hover:underline">
                  {address}
                </a>
              ) : (
                <span>{address}</span>
              )}
            </p>
          )}
          {c.phone && (
            // dir="ltr" only on the number: on the whole row it pushed the phone line to the
            // opposite side from the address/email in Arabic.
            <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="m-focus flex items-center gap-2 text-sm">
              <Phone className="m-brand-text size-4 shrink-0" aria-hidden />
              <span dir="ltr">{c.phone}</span>
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="m-focus flex items-center gap-2 text-sm">
              <Mail className="m-brand-text size-4 shrink-0" aria-hidden />
              <span dir="ltr">{c.email}</span>
            </a>
          )}
        </div>
        {hasHours && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Clock className="m-brand-text size-5" aria-hidden />
              {t.hours}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {DAY_KEYS.map((d) => {
                  const h = hours[d];
                  const isToday = d === today;
                  return (
                    <tr key={d} className={cn("transition-colors", isToday && "font-bold")} aria-current={isToday ? "date" : undefined}>
                      <th scope="row" className={cn("py-1.5 text-start font-medium", isToday && "m-brand-text font-bold")}>
                        {t.days[d]}
                        {isToday && <span className="ms-2 rounded-full bg-(--brand) px-2 py-0.5 text-[0.65rem] text-(--brand-contrast)">{t.today}</span>}
                      </th>
                      <td className="py-1.5 text-end tabular-nums text-(--m-muted)">
                        {!h || h.closed ? t.closed : <bdi dir="ltr">{`${h.open} – ${h.close}`}</bdi>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {socials.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-bold">{t.follow}</h2>
            <ul className="flex flex-wrap gap-2">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="m-press m-focus grid size-11 place-items-center rounded-full border border-(--m-line) bg-(--m-surface) transition-colors hover:bg-(--brand) hover:text-(--brand-contrast)"
                  >
                    <Icon className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="border-t border-(--m-line) px-4 py-5 text-center text-xs text-(--m-muted)">
        {fmt(t.poweredBy, { platform: PLATFORM_NAME })}
      </p>
    </footer>
  );
}
