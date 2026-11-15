"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CircleCheck,
  CirclePause,
  Copy,
  ExternalLink,
  Loader2,
  MoreVertical,
  PencilLine,
  Plus,
  Power,
  PowerOff,
  Search,
  Settings2,
  Store,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { fmt, pick } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { DeleteRestaurantDialog, DuplicateDialog, ToggleActiveDialog, useEditMenu } from "./restaurant-dialogs";
import { formatDate, RestaurantAvatar } from "./shared";
import type { RestaurantRow } from "./types";

type StatusFilter = "all" | "active" | "suspended";

export function RestaurantsList({ rows, menuUrlPattern }: { rows: RestaurantRow[]; menuUrlPattern: string }) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.isActive).length,
      suspended: rows.filter((r) => !r.isActive).length,
      items: rows.reduce((n, r) => n + r.itemCount, 0),
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "active" && !r.isActive) return false;
      if (status === "suspended" && r.isActive) return false;
      if (!q) return true;
      return [r.nameAr, r.nameEn, r.slug, r.customDomain ?? "", ...r.owners].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, query, status]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<UtensilsCrossed className="size-7" aria-hidden="true" />}
        title={t.list.emptyTitle}
        body={t.list.emptyBody}
        action={
          <Button asChild className="h-11">
            <Link href={`/${lang}/admin/new`}>
              <Plus className="size-4" aria-hidden="true" />
              {t.nav.newRestaurant}
            </Link>
          </Button>
        }
      />
    );
  }

  const statCards = [
    { label: t.list.stats.total, value: stats.total, icon: <Store className="size-4" aria-hidden="true" /> },
    { label: t.list.stats.active, value: stats.active, icon: <CircleCheck className="size-4 text-emerald-600" aria-hidden="true" /> },
    { label: t.list.stats.suspended, value: stats.suspended, icon: <CirclePause className="size-4 text-amber-600" aria-hidden="true" /> },
    { label: t.list.stats.items, value: stats.items, icon: <UtensilsCrossed className="size-4" aria-hidden="true" /> },
  ];
  const numberFmt = new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-latn" : "en");

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className="rounded-2xl border bg-background p-4 shadow-xs"
          >
            <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {s.icon}
              {s.label}
            </dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">{numberFmt.format(s.value)}</dd>
          </motion.div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.list.searchPlaceholder}
            aria-label={t.list.searchLabel}
            className="h-11 bg-background ps-10 pe-11 text-base [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t.list.clearFilters}
              className="absolute inset-y-0 end-0 inline-flex w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none rounded-e-lg"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <ToggleGroup
          type="single"
          value={status}
          onValueChange={(v) => v && setStatus(v as StatusFilter)}
          variant="outline"
          spacing={0}
          aria-label={t.list.statusLabel}
          className="w-full bg-background sm:w-auto"
        >
          {(["all", "active", "suspended"] as const).map((s) => (
            <ToggleGroupItem key={s} value={s} className="h-11 flex-1 px-4 sm:flex-none">
              {t.list[s]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {fmt(t.list.showing, { shown: filtered.length, total: rows.length })}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-7" aria-hidden="true" />}
          title={t.list.noResultsTitle}
          body={t.list.noResultsBody}
          action={
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              {t.list.clearFilters}
            </Button>
          }
        />
      ) : (
        <motion.ul layout={!reduce} className="space-y-3">
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.map((r) => (
              <motion.li
                key={r.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <RestaurantCard row={r} menuUrlPattern={menuUrlPattern} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

function RestaurantCard({ row, menuUrlPattern }: { row: RestaurantRow; menuUrlPattern: string }) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const name = pick({ ar: row.nameAr, en: row.nameEn }, lang);
  const otherName = pick({ ar: row.nameAr, en: row.nameEn }, lang === "ar" ? "en" : "ar");
  const [dialog, setDialog] = useState<null | "duplicate" | "toggle" | "delete">(null);
  const edit = useEditMenu();
  const settingsHref = `/${lang}/admin/${row.id}`;

  return (
    <article
      className={cn(
        "group relative flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border bg-background p-4 shadow-xs transition-shadow hover:shadow-md sm:flex-nowrap",
        !row.isActive && "bg-muted/40",
      )}
    >
      <RestaurantAvatar name={name} logoUrl={row.logoUrl} color={row.primary} size={52} className={cn(!row.isActive && "opacity-60 grayscale")} />

      <div className="min-w-0 flex-1 basis-40">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-semibold">
            <Link
              href={settingsHref}
              className="rounded-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:after:hidden"
            >
              {name}
            </Link>
          </h3>
          <Badge variant={row.isActive ? "secondary" : "outline"} className={cn(row.isActive ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            <span className={cn("size-1.5 rounded-full", row.isActive ? "bg-emerald-500" : "bg-amber-500")} aria-hidden="true" />
            {row.isActive ? t.status.active : t.status.suspended}
          </Badge>
          <Badge variant="outline">{t.plans[row.plan]}</Badge>
        </div>
        {otherName && otherName !== name ? (
          <p className="truncate text-sm text-muted-foreground" dir="auto">
            {otherName}
          </p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span dir="ltr" className="font-mono">/{row.slug}</span>
          {row.customDomain ? (
            <span dir="ltr" className="font-mono">
              {row.customDomain}
            </span>
          ) : null}
          <span>{fmt(t.list.items, { n: row.itemCount })}</span>
          <span className="hidden sm:inline">{fmt(t.list.created, { date: formatDate(row.createdAt, lang) })}</span>
        </p>
      </div>

      <div className="order-last w-full min-w-0 text-xs sm:order-none sm:w-52 sm:shrink-0">
        <p className="sr-only">{t.list.columns.owners}</p>
        {row.owners.length > 0 ? (
          <ul className="space-y-0.5">
            {row.owners.slice(0, 2).map((email) => (
              <li key={email} className="truncate text-muted-foreground" dir="ltr">
                {email}
              </li>
            ))}
            {row.owners.length > 2 ? <li className="text-muted-foreground">+{row.owners.length - 2}</li> : null}
          </ul>
        ) : (
          <p className="text-muted-foreground/70 italic">{t.list.noOwner}</p>
        )}
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-1 ms-auto">
        <Button
          variant="outline"
          className="hidden h-10 gap-2 md:inline-flex"
          onClick={() => edit.open(row.id)}
          disabled={edit.pending}
          aria-busy={edit.pending}
        >
          {edit.pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PencilLine className="size-4" aria-hidden="true" />}
          {t.actions.editMenu}
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label={fmt(t.actions.label, { name })}>
              <MoreVertical className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild className="min-h-10">
              <a href={row.publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                {t.actions.openMenu}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-10" onSelect={() => edit.open(row.id)} disabled={edit.pending}>
              <PencilLine className="size-4" aria-hidden="true" />
              {t.actions.editMenu}
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="min-h-10">
              <Link href={settingsHref}>
                <Settings2 className="size-4" aria-hidden="true" />
                {t.actions.settings}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-10" onSelect={() => setDialog("duplicate")}>
              <Copy className="size-4" aria-hidden="true" />
              {t.actions.duplicate}
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-10" onSelect={() => setDialog("toggle")}>
              {row.isActive ? <PowerOff className="size-4" aria-hidden="true" /> : <Power className="size-4" aria-hidden="true" />}
              {row.isActive ? t.actions.suspend : t.actions.activate}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="min-h-10" onSelect={() => setDialog("delete")}>
              <Trash2 className="size-4" aria-hidden="true" />
              {t.actions.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {dialog === "duplicate" ? (
        <DuplicateDialog restaurant={row} open onOpenChange={(o) => !o && setDialog(null)} menuUrlPattern={menuUrlPattern} />
      ) : null}
      {dialog === "toggle" ? <ToggleActiveDialog restaurant={row} open onOpenChange={(o) => !o && setDialog(null)} /> : null}
      {dialog === "delete" ? <DeleteRestaurantDialog restaurant={row} open onOpenChange={(o) => !o && setDialog(null)} /> : null}
    </article>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center rounded-3xl border border-dashed bg-background px-6 py-14 text-center"
    >
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{icon}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </motion.div>
  );
}
