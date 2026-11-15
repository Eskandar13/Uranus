"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  BadgePercent,
  CircleSlash,
  Copy,
  ExternalLink,
  LayoutList,
  Palette,
  Plus,
  QrCode,
  Search,
  Tags,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmt, pick } from "@/lib/i18n/config";
import type { LocalizedText, Plan } from "@/lib/data/types";
import { patchItemAction } from "@/lib/dashboard/actions";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { callAction, copyText, useFeedback, useT } from "./hooks";
import { EmptyState, RestaurantAvatar, StatusDot, Thumb, inputClass } from "./ui";

export interface OverviewItem {
  id: string;
  name: LocalizedText;
  categoryName: LocalizedText;
  imageUrl: string | null;
  imageBlur: string | null;
  isAvailable: boolean;
}

export interface OverviewProps {
  restaurant: {
    id: string;
    name: LocalizedText;
    tagline: LocalizedText;
    slug: string;
    logoUrl: string | null;
    coverUrl: string | null;
    coverBlur: string | null;
    isActive: boolean;
    plan: Plan;
    primary: string;
  };
  userName: string | null;
  menuUrl: string;
  viewHref: string;
  stats: { categories: number; items: number; soldOut: number; offers: number };
  items: OverviewItem[];
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function Overview({ restaurant, userName, menuUrl, viewHref, stats, items }: OverviewProps) {
  const t = useT();
  const { lang } = useI18n();
  const base = `/${lang}/dashboard`;

  const statCards: Array<{ key: keyof OverviewProps["stats"]; icon: LucideIcon; tone: string; href: string }> = [
    { key: "categories", icon: LayoutList, tone: "from-sky-500/15 to-sky-500/5 text-sky-700 dark:text-sky-300", href: `${base}/menu` },
    { key: "items", icon: UtensilsCrossed, tone: "from-violet-500/15 to-violet-500/5 text-violet-700 dark:text-violet-300", href: `${base}/menu` },
    { key: "soldOut", icon: CircleSlash, tone: "from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300", href: "#sold-out" },
    { key: "offers", icon: BadgePercent, tone: "from-amber-500/20 to-amber-500/5 text-amber-800 dark:text-amber-300", href: `${base}/menu` },
  ];

  const shortcuts: Array<{ href: string; icon: LucideIcon; title: string; hint: string; primary?: boolean }> = [
    { href: `${base}/items/new`, icon: Plus, title: t.overview.addItem, hint: t.overview.addItemHint, primary: true },
    { href: `${base}/menu`, icon: Tags, title: t.overview.editPrices, hint: t.overview.editPricesHint },
    { href: `${base}/qr`, icon: QrCode, title: t.overview.downloadQr, hint: t.overview.downloadQrHint },
    { href: `${base}/settings?tab=branding`, icon: Palette, title: t.overview.branding, hint: t.overview.brandingHint },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.05 }}
      className="flex flex-col gap-5 lg:gap-6"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          {userName ? fmt(t.overview.greetingName, { name: userName }) : t.overview.greeting}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.overview.subtitle}</p>
      </motion.div>

      {/* Restaurant card */}
      <motion.section variants={fadeUp} className="relative overflow-hidden rounded-3xl border bg-card shadow-xs">
        <div className="relative h-28 sm:h-36">
          {restaurant.coverUrl ? (
            <Image
              src={restaurant.coverUrl}
              alt=""
              fill
              priority
              sizes="(min-width:1024px) 900px, 100vw"
              placeholder={restaurant.coverBlur ? "blur" : "empty"}
              blurDataURL={restaurant.coverBlur ?? undefined}
              className="object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${restaurant.primary}, color-mix(in oklab, ${restaurant.primary} 40%, #000))` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        </div>
        <div className="relative flex flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-5 xl:flex-row xl:items-end">
          <div className="flex min-w-0 items-start gap-3">
            <RestaurantAvatar
              name={restaurant.name}
              logoUrl={restaurant.logoUrl}
              color={restaurant.primary}
              size={76}
              className="-mt-10 rounded-2xl border-4 border-card bg-card shadow-md sm:-mt-12"
            />
            <div className="min-w-0 pt-2.5">
              <h2 className="truncate text-lg font-bold sm:text-xl">{pick(restaurant.name, lang)}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusDot active={restaurant.isActive} label={restaurant.isActive ? t.status.active : t.status.inactive} />
                <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-semibold text-muted-foreground">
                  {fmt(t.status.plan, { plan: t.status.plans[restaurant.plan] })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 xl:ms-auto xl:max-w-md">
            <span className="text-xs font-medium text-muted-foreground">{t.overview.menuLink}</span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 basis-48 truncate rounded-xl border bg-muted/60 px-3 py-2.5 text-start text-xs"
                title={menuUrl}
              >
                {menuUrl.replace(/^https?:\/\//, "")}
              </code>
              <CopyButton text={menuUrl} />
              <ViewButton href={viewHref} />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Stats */}
      <motion.ul variants={fadeUp} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className="group flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 outline-none transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className={cn("grid size-10 place-items-center rounded-xl bg-gradient-to-br", s.tone)}>
                <s.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-2xl font-bold tabular-nums">{stats[s.key]}</span>
                <span className="block text-sm text-muted-foreground">{t.overview.stats[s.key]}</span>
              </span>
            </Link>
          </li>
        ))}
      </motion.ul>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-6">
        {/* Shortcuts */}
        <motion.section variants={fadeUp} aria-labelledby="shortcuts-title" className="flex flex-col gap-3">
          <h2 id="shortcuts-title" className="text-base font-semibold">
            {t.overview.shortcuts}
          </h2>
          <ul className="grid grid-cols-2 gap-3">
            {shortcuts.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className={cn(
                    "group relative flex h-full min-h-28 flex-col justify-between gap-3 rounded-2xl border p-4 outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50",
                    s.primary ? "border-transparent bg-primary text-primary-foreground" : "bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 place-items-center rounded-xl",
                      s.primary ? "bg-primary-foreground/15" : "bg-muted",
                    )}
                  >
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="flex items-center gap-1 font-semibold">
                      {s.title}
                      <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-70 rtl:-scale-x-100" aria-hidden />
                    </span>
                    <span className={cn("block text-xs", s.primary ? "text-primary-foreground/75" : "text-muted-foreground")}>
                      {s.hint}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Sold out today */}
        <motion.div variants={fadeUp}>
          <SoldOutPanel restaurantId={restaurant.id} items={items} />
        </motion.div>
      </div>
    </motion.div>
  );
}

function ViewButton({ href }: { href: string }) {
  const t = useT();
  return (
    <Button asChild className="h-11 shrink-0 rounded-xl px-3 lg:h-10">
      <a href={href} target="_blank" rel="noopener">
        <ExternalLink className="rtl:-scale-x-100" aria-hidden />
        {t.nav.viewMenu}
      </a>
    </Button>
  );
}

function CopyButton({ text }: { text: string }) {
  const t = useT();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 shrink-0 rounded-xl px-3 lg:h-10"
      onClick={async () => {
        if (await copyText(text)) toast.success(t.common.linkCopied);
      }}
    >
      <Copy aria-hidden />
      <span className="max-sm:sr-only">{t.common.copyLink}</span>
    </Button>
  );
}

const PREVIEW_COUNT = 8;

function SoldOutPanel({ restaurantId, items: initial }: { restaurantId: string; items: OverviewItem[] }) {
  const t = useT();
  const { lang } = useI18n();
  const feedback = useFeedback();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  // Keep the order stable while toggling (sold-out first as loaded).
  const [order] = useState(() =>
    [...initial].sort((a, b) => Number(a.isAvailable) - Number(b.isAvailable)).map((i) => i.id),
  );

  const byId = useMemo(() => new Map(initial.map((i) => [i.id, i])), [initial]);
  const items = useMemo(() => {
    const known = order.map((id) => byId.get(id)).filter((i): i is OverviewItem => Boolean(i));
    const fresh = initial.filter((i) => !order.includes(i.id));
    return [...known, ...fresh].map((i) => (i.id in overrides ? { ...i, isAvailable: overrides[i.id] } : i));
  }, [order, byId, initial, overrides]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => `${i.name.ar} ${i.name.en} ${i.categoryName.ar} ${i.categoryName.en}`.toLowerCase().includes(q))
    : items;
  const visible = expanded || q ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const soldOutCount = items.filter((i) => !i.isAvailable).length;

  const toggle = (item: OverviewItem, available: boolean) => {
    setOverrides((o) => ({ ...o, [item.id]: available }));
    startTransition(async () => {
      const res = await callAction(() => patchItemAction(lang, restaurantId, item.id, { isAvailable: available }));
      const name = pick(item.name, lang);
      if (!feedback(res, fmt(available ? t.overview.markedAvailable : t.overview.markedSoldOut, { name }))) {
        setOverrides((o) => ({ ...o, [item.id]: !available }));
      }
    });
  };

  return (
    <section id="sold-out" aria-labelledby="sold-out-title" className="scroll-mt-24 rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 id="sold-out-title" className="text-base font-semibold">
            {t.overview.soldOutTitle}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.overview.soldOutBody}</p>
        </div>
        {soldOutCount > 0 && (
          <span className="inline-flex h-7 items-center rounded-full bg-rose-500/12 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {fmt(t.overview.soldOutCount, { n: soldOutCount })}
          </span>
        )}
      </div>
      {initial.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState icon={UtensilsCrossed} title={t.overview.noItems} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.overview.soldOutSearch}
              aria-label={t.overview.soldOutSearch}
              className={cn(inputClass, "ps-9 pe-10")}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label={t.common.clearSearch}
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <ul className="flex flex-col divide-y">
            {visible.map((item) => {
              const name = pick(item.name, lang);
              const switchId = `avail-${item.id}`;
              return (
                <li key={item.id} className="flex min-h-14 items-center gap-3 py-2">
                  <Thumb
                    src={item.imageUrl}
                    blur={item.imageBlur}
                    className={cn("size-11 transition", !item.isAvailable && "opacity-50 grayscale")}
                    sizes="44px"
                    fallback={<UtensilsCrossed className="size-4" aria-hidden />}
                  />
                  <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
                    <span className={cn("block truncate text-sm font-medium", !item.isAvailable && "text-muted-foreground line-through decoration-1")}>
                      {name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{pick(item.categoryName, lang)}</span>
                  </label>
                  <span
                    className={cn(
                      "hidden text-xs font-semibold sm:inline",
                      item.isAvailable ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
                    )}
                    aria-hidden
                  >
                    {item.isAvailable ? t.overview.available : t.overview.unavailable}
                  </span>
                  <span className="grid size-11 place-items-center">
                    <Switch
                      id={switchId}
                      checked={item.isAvailable}
                      onCheckedChange={(v) => toggle(item, v)}
                      aria-label={fmt(t.item.toggleAvailable, { name })}
                      className="data-checked:bg-emerald-600"
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          {q && filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{fmt(t.overview.noMatch, { q: query })}</p>
          )}
          {!q && filtered.length > PREVIEW_COUNT && (
            <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={() => setExpanded((v) => !v)}>
              {expanded ? t.overview.showLess : fmt(t.overview.showAll, { n: filtered.length })}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
