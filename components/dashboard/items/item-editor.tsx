"use client";

import { createElement, useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, pick } from "@/lib/i18n/config";
import { ITEM_TAGS, type Category, type ItemTag, type LocalizedText, type MenuItem } from "@/lib/data/types";
import { discountPercent, formatPrice } from "@/lib/format/price";
import { brandVars } from "@/lib/menu/color";
import { saveItemAction } from "@/lib/dashboard/actions";
import { issuesByPath, itemInputSchema, type ItemInput } from "@/lib/dashboard/schemas";
import { categoryIcon, TAG_ICONS } from "@/components/menu/icons";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { callAction, useFeedback, useT, useUnsavedGuard } from "../hooks";
import { ImageUploader } from "../image-uploader";
import { Field, FieldError, LocalizedFields, NumberField, PageHeader, SaveBar, SectionCard, parseNumber } from "../ui";

interface OptionRow {
  key: string;
  id?: string;
  name: LocalizedText;
  price: string;
}

interface ItemForm {
  categoryId: string;
  name: LocalizedText;
  description: LocalizedText;
  price: string;
  onOffer: boolean;
  oldPrice: string;
  imageUrl: string | null;
  imageBlur: string | null;
  options: OptionRow[];
  tags: ItemTag[];
  calories: string;
  isAvailable: boolean;
  isFeatured: boolean;
}

const EMPTY: LocalizedText = { ar: "", en: "" };
const raw = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
let keySeq = 0;
const newKey = () => `opt-${++keySeq}-${Math.random().toString(36).slice(2, 7)}`;

function toForm(item: MenuItem | null, categoryId: string): ItemForm {
  return {
    categoryId: item?.categoryId ?? categoryId,
    name: item?.name ?? EMPTY,
    description: item?.description ?? EMPTY,
    price: raw(item?.price),
    onOffer: item?.oldPrice != null,
    oldPrice: raw(item?.oldPrice),
    imageUrl: item?.imageUrl ?? null,
    imageBlur: item?.imageBlur ?? null,
    options: (item?.options ?? []).map((o) => ({ key: o.id || newKey(), id: o.id, name: o.name, price: raw(o.price) })),
    tags: item?.tags ?? [],
    calories: raw(item?.calories),
    isAvailable: item?.isAvailable ?? true,
    isFeatured: item?.isFeatured ?? false,
  };
}

/** Form state -> the payload validated by itemInputSchema (NaN makes zod report "price"). */
function toInput(f: ItemForm): ItemInput {
  const options = f.options.map((o) => ({ id: o.id, name: o.name, price: parseNumber(o.price) ?? Number.NaN }));
  const hasOptions = options.length > 0;
  const price = hasOptions
    ? Math.min(...options.map((o) => (Number.isFinite(o.price) ? o.price : Number.POSITIVE_INFINITY)))
    : (parseNumber(f.price) ?? Number.NaN);
  return {
    categoryId: f.categoryId,
    name: f.name,
    description: f.description,
    price: Number.isFinite(price) ? price : Number.NaN,
    oldPrice: !hasOptions && f.onOffer ? (parseNumber(f.oldPrice) ?? Number.NaN) : null,
    imageUrl: f.imageUrl,
    imageBlur: f.imageBlur,
    options,
    tags: f.tags,
    calories: f.calories ? (parseNumber(f.calories) ?? Number.NaN) : null,
    isAvailable: f.isAvailable,
    isFeatured: f.isFeatured,
  };
}

export interface EditorBrand {
  primary: string;
  accent: string;
  fontFamily: string;
  radius: "sharp" | "soft" | "round";
}

/** Full-page item editor (create when `item` is null). */
export function ItemEditor({
  restaurantId,
  currency,
  categories,
  item,
  defaultCategoryId,
  brand,
}: {
  restaurantId: string;
  currency: string;
  categories: Category[];
  item: MenuItem | null;
  defaultCategoryId: string | null;
  brand: EditorBrand;
}) {
  const t = useT();
  const { lang } = useI18n();
  const router = useRouter();
  const feedback = useFeedback();
  const startCategory =
    (defaultCategoryId && categories.some((c) => c.id === defaultCategoryId) ? defaultCategoryId : categories[0]?.id) ?? "";
  const [baseline, setBaseline] = useState<ItemForm>(() => toForm(item, startCategory));
  const [form, setForm] = useState<ItemForm>(baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [saving, startSaving] = useTransition();
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  useUnsavedGuard(dirty && !saving && !leaving, t.common.leaveConfirm);

  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const menuHref = `/${lang}/dashboard/menu`;

  const save = () => {
    if (uploading) return;
    const payload = toInput(form);
    const parsed = itemInputSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error));
      feedback({ ok: false, error: "invalid" });
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    setErrors({});
    startSaving(async () => {
      const res = await callAction(() => saveItemAction(lang, restaurantId, item?.id ?? null, parsed.data));
      if (!feedback(res, item ? t.editor.saved : t.editor.created) || !res.ok) return;
      if (item) {
        setBaseline(form);
      } else {
        setLeaving(true);
        router.push(`${menuHref}?category=${res.data.categoryId}`);
      }
    });
  };

  if (categories.length === 0) {
    return (
      <div>
        <PageHeader title={t.editor.newTitle} backHref={menuHref} backLabel={t.editor.backToMenu} />
        <SectionCard>
          <p className="text-sm text-muted-foreground">{t.editor.noCategories}</p>
          <Button className="mt-4 h-11 rounded-xl" onClick={() => router.push(menuHref)}>
            {t.editor.goToMenu}
          </Button>
        </SectionCard>
      </div>
    );
  }

  const hasOptions = form.options.length > 0;

  return (
    <div>
      <PageHeader
        title={item ? pick(form.name, lang) || t.editor.editTitle : t.editor.newTitle}
        subtitle={item ? t.editor.editTitle : undefined}
        backHref={menuHref}
        backLabel={t.editor.backToMenu}
      />
      <form
        id="item-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-6"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title={t.editor.photo}>
            <ImageUploader
              restaurantId={restaurantId}
              kind="item"
              label={t.editor.photo}
              value={{ url: form.imageUrl, blur: form.imageBlur }}
              onChange={(v) => setForm((f) => ({ ...f, imageUrl: v.url, imageBlur: v.blur }))}
              onBusyChange={setUploading}
              className="max-w-md"
            />
          </SectionCard>

          <SectionCard title={t.editor.details} bodyClassName="flex flex-col gap-5">
            <LocalizedFields
              label={t.editor.name}
              value={form.name}
              onChange={(v) => set("name", v)}
              errors={errors}
              errorKey="name"
              maxLength={120}
              placeholder={{ ar: t.editor.namePlaceholderAr, en: t.editor.namePlaceholderEn }}
            />
            <LocalizedFields
              label={t.editor.description}
              value={form.description}
              onChange={(v) => set("description", v)}
              errors={errors}
              errorKey="description"
              multiline
              optional
              maxLength={600}
              placeholder={{ ar: "", en: t.editor.descriptionPlaceholder }}
            />
            <Field label={t.editor.category} htmlFor="item-category" error={errors.categoryId}>
              <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
                <SelectTrigger id="item-category" className="h-11 w-full rounded-xl text-base data-[size=default]:h-11 lg:text-sm">
                  <SelectValue placeholder={t.editor.chooseCategory} />
                </SelectTrigger>
                <SelectContent position="popper">
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="min-h-10">
                      {createElement(categoryIcon(c.icon), { "aria-hidden": true })}
                      {pick(c.name, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </SectionCard>

          <SectionCard title={t.editor.pricing} description={fmt(t.editor.currencyNote, { code: currency })} bodyClassName="flex flex-col gap-5">
            {!hasOptions && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.editor.price} htmlFor="item-price" error={errors.price}>
                  <NumberField
                    id="item-price"
                    value={form.price}
                    onChange={(v) => set("price", v)}
                    suffix={currency}
                    invalid={Boolean(errors.price)}
                    describedBy={errors.price ? "item-price-error" : undefined}
                    placeholder="0"
                  />
                </Field>
                <div className="flex flex-col gap-3">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 sm:mt-6">
                    <span>
                      <span className="block text-sm font-medium">{t.editor.onOffer}</span>
                      <span className="block text-xs text-muted-foreground">{t.editor.onOfferHint}</span>
                    </span>
                    <Switch checked={form.onOffer} onCheckedChange={(v) => set("onOffer", v)} />
                  </label>
                </div>
                <AnimatePresence initial={false}>
                  {form.onOffer && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden sm:col-span-2"
                    >
                      <Field label={t.editor.oldPrice} htmlFor="item-old-price" error={errors.oldPrice} className="sm:max-w-[calc(50%-0.5rem)]">
                        <NumberField
                          id="item-old-price"
                          value={form.oldPrice}
                          onChange={(v) => set("oldPrice", v)}
                          suffix={currency}
                          invalid={Boolean(errors.oldPrice)}
                          describedBy={errors.oldPrice ? "item-old-price-error" : undefined}
                        />
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <OptionsEditor
              options={form.options}
              onChange={(options) => set("options", options)}
              currency={currency}
              errors={errors}
            />
          </SectionCard>

          <SectionCard title={t.editor.tags} description={t.editor.tagsHint}>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t.editor.tags}>
              {ITEM_TAGS.map((tag) => {
                const on = form.tags.includes(tag);
                const Icon = TAG_ICONS[tag];
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("tags", on ? form.tags.filter((x) => x !== tag) : [...form.tags, tag])}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
                      on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:border-foreground/30",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {t.tags[tag]}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title={t.editor.availability} bodyClassName="flex flex-col gap-3">
            <ToggleRow label={t.editor.available} hint={t.editor.availableHint} checked={form.isAvailable} onChange={(v) => set("isAvailable", v)} />
            <ToggleRow label={t.editor.featured} hint={t.editor.featuredHint} checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} />
            <Field label={t.editor.calories} htmlFor="item-calories" error={errors.calories} optional className="sm:max-w-60">
              <NumberField
                id="item-calories"
                integer
                value={form.calories}
                onChange={(v) => set("calories", v)}
                suffix={t.editor.caloriesUnit}
                invalid={Boolean(errors.calories)}
              />
            </Field>
          </SectionCard>
        </div>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-8">
          <div>
            <h2 className="text-sm font-semibold">{t.editor.preview}</h2>
            <p className="text-xs text-muted-foreground">{t.editor.previewHint}</p>
          </div>
          <PreviewCard form={form} currency={currency} brand={brand} />
        </aside>

        <div className="xl:col-span-2">
          <SaveBar
            dirty={dirty || !item}
            saving={saving || uploading}
            form="item-form"
            onDiscard={item ? () => {
              setForm(baseline);
              setErrors({});
            } : undefined}
            saveLabel={item ? undefined : t.editor.create}
            alwaysVisible
          />
          {uploading && <span className="sr-only">{t.image.uploading}</span>}
        </div>
      </form>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Sizes / options repeater                                            */
/* ------------------------------------------------------------------ */

function OptionsEditor({
  options,
  onChange,
  currency,
  errors,
}: {
  options: OptionRow[];
  onChange: (next: OptionRow[]) => void;
  currency: string;
  errors: Record<string, string>;
}) {
  const t = useT();
  const update = (key: string, patch: Partial<OptionRow>) => onChange(options.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...options];
    const [row] = next.splice(idx, 1);
    next.splice(idx + dir, 0, row);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-[0.82rem] font-medium">{t.editor.sizes}</h3>
        <p className="text-xs text-muted-foreground">{options.length > 0 ? t.editor.sizesPriceNote : t.editor.sizesHint}</p>
      </div>
      {options.length > 0 && (
        <Reorder.Group axis="y" values={options} onReorder={onChange} className="flex flex-col gap-2">
          {options.map((o, idx) => (
            <OptionItem
              key={o.key}
              row={o}
              idx={idx}
              count={options.length}
              currency={currency}
              errors={errors}
              onUpdate={(patch) => update(o.key, patch)}
              onMove={(d) => move(idx, d)}
              onRemove={() => onChange(options.filter((x) => x.key !== o.key))}
            />
          ))}
        </Reorder.Group>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11 self-start rounded-xl border-dashed"
        onClick={() => onChange([...options, { key: newKey(), name: { ar: "", en: "" }, price: "" }])}
        disabled={options.length >= 20}
      >
        <Plus aria-hidden />
        {t.editor.addSize}
      </Button>
    </div>
  );
}

function OptionItem({
  row,
  idx,
  count,
  currency,
  errors,
  onUpdate,
  onMove,
  onRemove,
}: {
  row: OptionRow;
  idx: number;
  count: number;
  currency: string;
  errors: Record<string, string>;
  onUpdate: (patch: Partial<OptionRow>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const controls = useDragControls();
  const nameError = errors[`options.${idx}.name.ar`] ?? errors[`options.${idx}.name`];
  const priceError = errors[`options.${idx}.price`];
  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={controls}
      className="flex items-start gap-1.5 rounded-xl border bg-background p-2"
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="mt-1.5 grid h-9 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground/70 hover:bg-muted max-sm:hidden"
        aria-hidden
        tabIndex={-1}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1fr_8.5rem]">
        <input
          dir="rtl"
          lang="ar"
          value={row.name.ar}
          onChange={(e) => onUpdate({ name: { ...row.name, ar: e.target.value } })}
          placeholder={`${t.editor.sizeName} (${t.common.arabic})`}
          aria-label={`${t.editor.sizeName} (${t.common.arabic})`}
          aria-invalid={Boolean(nameError) || undefined}
          maxLength={60}
          className="h-11 rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive lg:h-10 lg:text-sm dark:bg-input/30"
        />
        <input
          dir="ltr"
          lang="en"
          value={row.name.en}
          onChange={(e) => onUpdate({ name: { ...row.name, en: e.target.value } })}
          placeholder={`${t.editor.sizeName} (${t.common.english})`}
          aria-label={`${t.editor.sizeName} (${t.common.english})`}
          aria-invalid={Boolean(nameError) || undefined}
          maxLength={60}
          className="h-11 rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive lg:h-10 lg:text-sm dark:bg-input/30"
        />
        <NumberField
          value={row.price}
          onChange={(v) => onUpdate({ price: v })}
          suffix={currency}
          aria-label={t.editor.sizePrice}
          invalid={Boolean(priceError)}
          className="lg:h-10"
        />
        <div className="sm:col-span-3">
          <FieldError error={nameError ?? priceError} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5 sm:flex-row">
        <Button type="button" variant="ghost" size="icon" className="size-10 rounded-lg" onClick={() => onMove(-1)} disabled={idx === 0} aria-label={t.editor.moveUp}>
          <ChevronUp aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-10 rounded-lg" onClick={() => onMove(1)} disabled={idx === count - 1} aria-label={t.editor.moveDown}>
          <ChevronDown aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-10 rounded-lg text-destructive" onClick={onRemove} aria-label={t.editor.removeSize}>
          <Trash2 aria-hidden />
        </Button>
      </div>
    </Reorder.Item>
  );
}

/* ------------------------------------------------------------------ */
/* Live preview (roughly the public menu card)                         */
/* ------------------------------------------------------------------ */

const RADIUS: Record<EditorBrand["radius"], string> = { sharp: "6px", soft: "14px", round: "22px" };

function PreviewCard({ form, currency, brand }: { form: ItemForm; currency: string; brand: EditorBrand }) {
  const t = useT();
  const { lang } = useI18n();
  const input = toInput(form);
  const name = pick(form.name, lang) || t.editor.untitled;
  const desc = pick(form.description, lang);
  const hasOptions = form.options.length > 0;
  const price = Number.isFinite(input.price) ? input.price : 0;
  const old = input.oldPrice !== null && Number.isFinite(input.oldPrice) ? input.oldPrice : null;
  const pct = old !== null ? discountPercent(price, old) : null;
  const soldOut = !form.isAvailable;
  const style = {
    ...brandVars(brand.primary, brand.accent),
    fontFamily: brand.fontFamily,
    "--r": RADIUS[brand.radius],
  } as CSSProperties;

  return (
    <motion.article
      layout
      style={style}
      className="overflow-hidden rounded-(--r) border bg-card shadow-sm"
      aria-label={t.editor.preview}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {form.imageUrl ? (
          // Preview of any URL (including local uploads) at small size.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.imageUrl} alt="" className={cn("absolute inset-0 size-full object-cover", soldOut && "opacity-60 grayscale")} />
        ) : (
          <div
            className="absolute inset-0 grid place-items-center"
            style={{ background: "radial-gradient(120% 90% at 20% 10%, color-mix(in oklab, var(--brand) 30%, transparent), transparent 60%), radial-gradient(90% 80% at 90% 100%, color-mix(in oklab, var(--brand-accent) 26%, transparent), transparent 60%)" }}
          >
            <UtensilsCrossed className="size-10 opacity-30" aria-hidden />
          </div>
        )}
        {soldOut && (
          <span className="absolute start-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-bold text-white">{t.item.soldOut}</span>
        )}
        {pct !== null && !soldOut && (
          <span
            className="absolute end-2 top-2 rounded-full px-2 py-0.5 text-[0.7rem] font-extrabold shadow-md"
            style={{ background: "var(--brand-accent)", color: "var(--brand-accent-contrast)" }}
          >
            -{pct}%
          </span>
        )}
        {form.isFeatured && (
          <span className="absolute start-2 bottom-2 rounded-full bg-amber-400 px-2 py-0.5 text-[0.7rem] font-bold text-amber-950 shadow">★ {t.item.featured}</span>
        )}
      </div>
      <div className={cn("flex flex-col gap-1.5 p-3.5", soldOut && "opacity-70")}>
        <h3 className="line-clamp-2 text-base leading-snug font-bold">{name}</h3>
        {desc && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {form.tags.slice(0, 3).map((tag) => {
              const Icon = TAG_ICONS[tag];
              return (
                <span
                  key={tag}
                  className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[0.68rem] font-semibold"
                  style={{ background: "color-mix(in oklab, var(--brand) 12%, transparent)", color: "var(--brand-ink-light)" }}
                >
                  <Icon className="size-3" aria-hidden />
                  {t.tags[tag]}
                </span>
              );
            })}
          </div>
        )}
        <p className="mt-1 flex items-baseline gap-1.5 tabular-nums">
          {hasOptions && form.options.length > 1 && <span className="text-xs opacity-70">{t.item.from}</span>}
          <span className="text-[0.95rem] font-bold dark:hidden" style={{ color: "var(--brand-ink-light)" }}>
            {formatPrice(price, currency, lang)}
          </span>
          <span className="hidden text-[0.95rem] font-bold dark:inline" style={{ color: "var(--brand-ink-dark)" }}>
            {formatPrice(price, currency, lang)}
          </span>
          {old !== null && pct !== null && <s className="text-xs opacity-55">{formatPrice(old, currency, lang)}</s>}
        </p>
        {hasOptions && (
          <ul className="mt-1 flex flex-wrap gap-1">
            {form.options.map((o) => (
              <li key={o.key} className="rounded-full border px-2 py-0.5 text-[0.7rem]">
                {pick(o.name, lang) || "—"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.article>
  );
}
