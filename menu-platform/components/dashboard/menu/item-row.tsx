"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Copy, Loader2, MoreVertical, Pencil, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, pick } from "@/lib/i18n/config";
import type { LocalizedText, MenuItem } from "@/lib/data/types";
import { formatPrice } from "@/lib/format/price";
import { basePrice, isOnOffer } from "@/lib/menu/filters";
import type { ItemQuickPatch } from "@/lib/dashboard/schemas";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "../hooks";
import { FieldError, NumberField, Thumb, parseNumber } from "../ui";
import { DragHandle, type HandleProps } from "./sortable-list";

export interface ItemRowActions {
  onPatch: (item: MenuItem, patch: ItemQuickPatch) => Promise<boolean>;
  onDuplicate: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}

/** One item in the menu manager with inline quick actions. */
export function ItemRow({
  item,
  currency,
  handle,
  categoryName,
  actions,
  busy,
}: {
  item: MenuItem;
  currency: string;
  handle?: HandleProps;
  categoryName?: LocalizedText;
  actions: ItemRowActions;
  busy?: boolean;
}) {
  const t = useT();
  const { lang } = useI18n();
  const name = pick(item.name, lang) || t.editor.untitled;
  const editHref = `/${lang}/dashboard/items/${item.id}`;
  const soldOut = !item.isAvailable;
  const offer = isOnOffer(item);

  return (
    <div className={cn("flex items-center gap-1.5 rounded-2xl border bg-card p-2 pe-2.5 shadow-xs transition-colors sm:gap-2.5 sm:p-2.5", soldOut && "bg-muted/40")}>
      {handle ? <DragHandle handle={handle} /> : <span className="w-1" aria-hidden />}
      <Link href={editHref} tabIndex={-1} aria-hidden className="shrink-0">
        <Thumb
          src={item.imageUrl}
          blur={item.imageBlur}
          sizes="64px"
          className={cn("size-14 sm:size-16", soldOut && "opacity-55 grayscale")}
          fallback={<UtensilsCrossed className="size-5" aria-hidden />}
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start gap-1">
          <Link
            href={editHref}
            className="min-w-0 flex-1 rounded-md py-0.5 text-sm leading-snug font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-[0.95rem]"
          >
            <span className="line-clamp-2">{name}</span>
            {categoryName && <span className="block truncate text-xs font-normal text-muted-foreground">{pick(categoryName, lang)}</span>}
          </Link>
          {busy && <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
          <ItemMenu item={item} name={name} editHref={editHref} actions={actions} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PricePopover item={item} name={name} currency={currency} onPatch={actions.onPatch} />
          {offer && (
            <span className="inline-flex h-6 items-center rounded-full bg-amber-500/15 px-2 text-[0.7rem] font-semibold text-amber-800 dark:text-amber-300">
              {t.item.offerBadge}
            </span>
          )}
          {soldOut && (
            <span className="inline-flex h-6 items-center rounded-full bg-rose-500/12 px-2 text-[0.7rem] font-semibold text-rose-700 dark:text-rose-300">
              {t.item.soldOut}
            </span>
          )}
          <span className="ms-auto flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={item.isFeatured}
                  aria-label={fmt(item.isFeatured ? t.item.unfeature : t.item.feature, { name })}
                  onClick={() => void actions.onPatch(item, { isFeatured: !item.isFeatured })}
                  className="grid size-11 place-items-center rounded-xl outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <motion.span
                    key={String(item.isFeatured)}
                    initial={{ scale: 0.6, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="grid"
                  >
                    <Star
                      className={cn("size-5", item.isFeatured ? "fill-amber-400 text-amber-500" : "text-muted-foreground")}
                      aria-hidden
                    />
                  </motion.span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t.item.featured}</TooltipContent>
            </Tooltip>
            <span className="grid h-11 min-w-11 place-items-center">
              <Switch
                checked={item.isAvailable}
                onCheckedChange={(v) => void actions.onPatch(item, { isAvailable: v })}
                aria-label={fmt(t.item.toggleAvailable, { name })}
                className="data-checked:bg-emerald-600"
              />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ItemMenu({
  item,
  name,
  editHref,
  actions,
}: {
  item: MenuItem;
  name: string;
  editHref: string;
  actions: ItemRowActions;
}) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="-mt-1 size-10 shrink-0 rounded-xl" aria-label={`${t.common.more}: ${name}`}>
          <MoreVertical aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild className="min-h-11">
          <Link href={editHref}>
            <Pencil aria-hidden />
            {t.item.edit}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => actions.onDuplicate(item)}>
          <Copy aria-hidden />
          {t.item.duplicate}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="min-h-11" onSelect={() => actions.onDelete(item)}>
          <Trash2 aria-hidden />
          {t.item.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const toRaw = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

/** Tap the price to edit it (and the old price / size prices) without leaving the list. */
function PricePopover({
  item,
  name,
  currency,
  onPatch,
}: {
  item: MenuItem;
  name: string;
  currency: string;
  onPatch: ItemRowActions["onPatch"];
}) {
  const t = useT();
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [offer, setOffer] = useState(false);
  const [oldPrice, setOldPrice] = useState("");
  const [options, setOptions] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hasOptions = item.options.length > 0;

  const reset = () => {
    setPrice(toRaw(item.price));
    setOffer(item.oldPrice !== null);
    setOldPrice(toRaw(item.oldPrice));
    setOptions(Object.fromEntries(item.options.map((o) => [o.id, toRaw(o.price)])));
    setError(null);
  };

  const submit = async () => {
    const p = parseNumber(price);
    if (p === null || p < 0) return setError("price");
    const op = offer ? parseNumber(oldPrice) : null;
    if (offer && (op === null || op <= p)) return setError("oldPrice");
    const optionPrices: Array<{ id: string; price: number }> = [];
    for (const o of item.options) {
      const v = parseNumber(options[o.id] ?? "");
      if (v === null || v < 0) return setError("price");
      optionPrices.push({ id: o.id, price: v });
    }
    setError(null);
    setSaving(true);
    const okSave = await onPatch(item, { price: p, oldPrice: op, ...(hasOptions ? { optionPrices } : {}) });
    setSaving(false);
    if (okSave) setOpen(false);
  };

  const label = hasOptions ? `${t.item.from} ${formatPrice(basePrice(item), currency, lang)}` : formatPrice(item.price, currency, lang);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={fmt(t.item.editPrice, { name })}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-foreground/20 bg-background px-2 text-sm font-semibold tabular-nums outline-none hover:border-foreground/40 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span dir="auto">{label}</span>
          {isOnOffer(item) && item.oldPrice !== null && (
            <s className="text-xs font-medium text-muted-foreground">{formatPrice(item.oldPrice, currency, lang)}</s>
          )}
          <Pencil className="size-3 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 gap-3 p-3.5"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const input = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>("input");
          input?.focus();
          input?.select();
        }}
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="truncate text-sm font-semibold">{name}</p>
          {!hasOptions && (
            <label className="flex flex-col gap-1.5 text-xs font-medium">
              {t.item.price}
              <NumberField value={price} onChange={setPrice} suffix={currency} aria-label={t.item.price} invalid={error === "price"} />
            </label>
          )}
          {!hasOptions && (
            <>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm">
                {t.item.onOffer}
                <Switch checked={offer} onCheckedChange={setOffer} />
              </label>
              {offer && (
                <label className="flex flex-col gap-1.5 text-xs font-medium">
                  {t.item.oldPrice}
                  <NumberField value={oldPrice} onChange={setOldPrice} suffix={currency} aria-label={t.item.oldPrice} invalid={error === "oldPrice"} />
                </label>
              )}
            </>
          )}
          {hasOptions && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t.item.sizes}</span>
              {item.options.map((o) => (
                <label key={o.id} className="grid grid-cols-[1fr_7.5rem] items-center gap-2 text-sm">
                  <span className="truncate">{pick(o.name, lang)}</span>
                  <NumberField
                    value={options[o.id] ?? ""}
                    onChange={(v) => setOptions((s) => ({ ...s, [o.id]: v }))}
                    aria-label={`${t.item.price} — ${pick(o.name, lang)}`}
                    className="h-10 pe-2"
                  />
                </label>
              ))}
            </div>
          )}
          <FieldError error={error} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl lg:h-9" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" className="h-11 flex-1 rounded-xl lg:h-9" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              {t.common.done}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
