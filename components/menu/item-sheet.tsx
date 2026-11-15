"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Drawer } from "vaul";
import { Flame, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, otherLocale, pick } from "@/lib/i18n/config";
import type { MenuItem } from "@/lib/data/types";
import { discountPercent } from "@/lib/format/price";
import { isOnOffer, similarItems } from "@/lib/menu/filters";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { useMenu } from "./menu-context";
import { useMenuShell } from "./menu-shell";
import { menuShareUrl, useMediaQuery } from "./hooks";
import { MenuImage } from "./menu-image";
import { ItemPrice } from "./price";
import { TagChips } from "./menu-sections";
import { shareLink } from "./hero";

/* ------------------------------------------------------------------ */
/* Details (shared by the sheet and the shareable item page)           */
/* ------------------------------------------------------------------ */

export function ItemDetails({
  item,
  layoutImageId,
  onSimilar,
  similarHref,
  imageSizes = "(min-width:768px) 480px, 100vw",
  wide = false,
  titleSlot,
}: {
  item: MenuItem;
  layoutImageId?: string;
  onSimilar?: (item: MenuItem) => void;
  similarHref?: (item: MenuItem) => string;
  imageSizes?: string;
  /** Two-column layout (dialog / item page on wide screens). */
  wide?: boolean;
  /** Replaces the default <h2> (e.g. a Drawer.Title or an <h1>). */
  titleSlot?: (name: string) => React.ReactNode;
}) {
  const { categories, restaurant, categoryById } = useMenu();
  const { lang } = useI18n();
  const m = useMessages("menu");
  const t = m.item;
  const [optionId, setOptionId] = useState<string | null>(item.options[0]?.id ?? null);
  const option = item.options.find((o) => o.id === optionId) ?? null;
  const name = pick(item.name, lang);
  const otherName = item.name[otherLocale(lang)]?.trim();
  const desc = pick(item.description, lang);
  const pct = isOnOffer(item) ? discountPercent(item.price, item.oldPrice) : null;
  const similar = similarItems(item, categories, 8);
  const category = categoryById.get(item.categoryId);

  const share = () =>
    shareLink({
      title: `${name} · ${pick(restaurant.name, lang)}`,
      text: desc || name,
      url: menuShareUrl(item.slug),
      copied: t.linkCopied,
    });

  return (
    // minmax(0, …) + min-w-0: without them a grid column grows to its content's min width, and the
    // horizontal "similar items" row (8 × 128px) pushed the details column past the dialog,
    // hiding the photo and adding a sideways scrollbar on laptops/desktops.
    <div className={cn(wide && "md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-start")}>
      <div className={cn("relative", wide && "md:sticky md:top-0")}>
        <div className={cn("relative aspect-[4/3] w-full overflow-hidden bg-(--m-surface-2)", wide ? "md:aspect-[4/5]" : "rounded-(--r-card)")}>
          <motion.div layoutId={layoutImageId} className={cn("absolute inset-0", !item.isAvailable && "grayscale")}>
            <MenuImage src={item.imageUrl} blur={item.imageBlur} alt={name} sizes={imageSizes} priority zoom={false} icon={category?.icon} />
          </motion.div>
          {pct !== null && (
            <span className="absolute start-3 top-3 rounded-full bg-(--brand-accent) px-3 py-1 text-sm font-extrabold text-(--brand-accent-contrast) shadow-lg">
              {t.offer} <bdi dir="ltr">{fmt(t.off, { n: pct })}</bdi>
            </span>
          )}
          {!item.isAvailable && (
            <span className="absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-3 py-2 text-center text-sm font-semibold text-white backdrop-blur">
              {t.unavailable}
            </span>
          )}
        </div>
      </div>

      <div className={cn("flex min-w-0 flex-col gap-4 pt-5", wide && "md:px-7 md:pt-7 md:pb-7")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {category && <p className="m-brand-text text-xs font-bold tracking-wide uppercase">{pick(category.name, lang)}</p>}
            {titleSlot ? (
              titleSlot(name)
            ) : (
              <h2 className="mt-0.5 text-2xl leading-tight font-extrabold text-balance md:text-3xl">{name}</h2>
            )}
            {otherName && otherName !== name && (
              <p lang={otherLocale(lang)} dir="auto" className="mt-1 text-sm text-(--m-muted)">
                {otherName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={share}
            aria-label={t.share}
            title={t.share}
            className="m-press m-focus grid size-11 shrink-0 place-items-center rounded-full border border-(--m-line) bg-(--m-surface) text-(--m-fg)"
          >
            <Share2 className="size-[1.1rem]" aria-hidden />
          </button>
        </div>

        {(item.tags.length > 0 || item.calories) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <TagChips tags={item.tags} max={7} />
            {item.calories ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-(--m-surface-2) px-2 text-[0.68rem] font-semibold text-(--m-muted)">
                <Flame className="size-3" aria-hidden />
                {fmt(t.kcal, { n: item.calories })}
              </span>
            ) : null}
          </div>
        )}

        {desc && <p className="text-[0.95rem] leading-relaxed text-pretty text-(--m-fg)/85">{desc}</p>}

        {item.options.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-(--m-muted)" id={`opt-${item.id}`}>
              {t.size}
            </p>
            <div role="radiogroup" aria-labelledby={`opt-${item.id}`} className="flex flex-wrap gap-1 rounded-(--r-pill) bg-(--m-surface-2) p-1">
              {item.options.map((o) => {
                const on = o.id === optionId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setOptionId(o.id)}
                    className={cn(
                      "m-focus relative min-h-11 flex-1 rounded-(--r-pill) px-3 text-sm font-semibold transition-colors",
                      on ? "text-(--brand-contrast)" : "text-(--m-muted) hover:text-(--m-fg)",
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId={`opt-ind-${item.id}`}
                        className="absolute inset-0 rounded-(--r-pill) bg-(--brand) shadow-sm"
                        transition={{ type: "spring", stiffness: 520, damping: 38 }}
                        aria-hidden
                      />
                    )}
                    <span className="relative">{pick(o.name, lang)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-(--r-card) border border-(--m-line) bg-(--m-surface) px-4 py-3">
          <ItemPrice item={item} option={option} showFrom={false} className="m-brand-text text-2xl" />
          {!item.isAvailable && (
            <span className="rounded-full bg-(--m-surface-2) px-3 py-1 text-xs font-bold text-(--m-muted)">{t.soldOut}</span>
          )}
        </div>

        {similar.length > 0 && (
          <div className="mt-2">
            <h3 className="mb-3 text-base font-bold">{t.similar}</h3>
            <ul className="no-scrollbar m-snap-x -mx-5 flex gap-3 overflow-x-auto px-5 pb-2 md:-mx-0 md:px-0">
              {similar.map((s) => {
                const inner = (
                  <>
                    <span className="relative block aspect-square w-full overflow-hidden rounded-(--r-img) bg-(--m-surface-2)">
                      <MenuImage src={s.imageUrl} blur={s.imageBlur} alt="" sizes="128px" />
                    </span>
                    <span className="mt-1.5 line-clamp-1 block text-[0.8rem] font-semibold">{pick(s.name, lang)}</span>
                    <ItemPrice item={s} className="m-brand-text text-[0.78rem]" />
                  </>
                );
                const cls = "m-press m-focus block w-32 rounded-(--r-img) text-start";
                return (
                  <li key={s.id} className="shrink-0">
                    {similarHref ? (
                      <a href={similarHref(s)} className={cls}>
                        {inner}
                      </a>
                    ) : (
                      <button type="button" className={cls} onClick={() => onSimilar?.(s)}>
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet: vaul drawer on phones, centered dialog on >= 768px           */
/* ------------------------------------------------------------------ */

export function ItemSheet() {
  const { openSlug, itemBySlug, closeItem, openItem, openOrigin } = useMenu();
  const { portal } = useMenuShell();
  const { lang, dir } = useI18n();
  const t = useMessages("menu").item;
  const desktop = useMediaQuery("(min-width: 768px)");
  const item = openSlug ? (itemBySlug.get(openSlug) ?? null) : null;
  // Keep the last item rendered while the sheet animates out.
  const [shown, setShown] = useState<MenuItem | null>(item);
  if (item && item !== shown) setShown(item);
  const open = Boolean(item);
  const onOpenChange = (o: boolean) => {
    if (!o) closeItem();
  };
  const onSimilar = (s: MenuItem) => openItem(s.slug, "other");

  if (desktop) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <AnimatePresence>
          {open && shown && (
            <DialogPrimitive.Portal forceMount container={portal}>
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content
                forceMount
                dir={dir}
                aria-describedby={undefined}
                className="fixed inset-0 z-50 grid place-items-center p-6 outline-none"
                onClick={(e) => {
                  if (e.target === e.currentTarget) closeItem();
                }}
              >
                <motion.div
                  key={shown.id}
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.16 } }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="m-sheet relative max-h-[88dvh] w-full max-w-4xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-[calc(var(--r-card)+0.25rem)] shadow-2xl"
                >
                  <ItemDetails
                    key={shown.id}
                    item={shown}
                    wide
                    layoutImageId={openOrigin === "grid" ? `img-${shown.id}` : undefined}
                    onSimilar={onSimilar}
                    imageSizes="(min-width:1024px) 460px, 50vw"
                    titleSlot={(name) => (
                      <DialogPrimitive.Title className="mt-0.5 text-3xl leading-tight font-extrabold text-balance">{name}</DialogPrimitive.Title>
                    )}
                  />
                  <DialogPrimitive.Close
                    aria-label={t.close}
                    className="m-press m-focus absolute end-3 top-3 grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
                  >
                    <X className="size-5" aria-hidden />
                  </DialogPrimitive.Close>
                </motion.div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
        </AnimatePresence>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal container={portal}>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/55" />
        <Drawer.Content
          dir={dir}
          aria-describedby={undefined}
          className="m-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-[1.75rem] outline-none"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex justify-center pt-2.5 pb-1.5" aria-hidden>
            <span className="h-1.5 w-11 rounded-full bg-(--m-muted)/40" />
          </div>
          {shown && (
            <div key={shown.id} className="overflow-y-auto overscroll-contain px-5 pb-6">
              <ItemDetails
                item={shown}
                onSimilar={onSimilar}
                titleSlot={(name) => (
                  <Drawer.Title className="mt-0.5 text-2xl leading-tight font-extrabold text-balance">{name}</Drawer.Title>
                )}
              />
            </div>
          )}
          <Drawer.Close
            aria-label={t.close}
            lang={lang}
            className="m-press m-focus absolute end-3 top-3 grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
          >
            <X className="size-5" aria-hidden />
          </Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
