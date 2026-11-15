"use client";

import { createElement, useState, useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category, LocalizedText } from "@/lib/data/types";
import { saveCategoryAction } from "@/lib/dashboard/actions";
import { categoryInputSchema, issuesByPath, type CategoryInput } from "@/lib/dashboard/schemas";
import { categoryIcon } from "@/components/menu/icons";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { callAction, useFeedback, useT } from "../hooks";
import { ImageUploader } from "../image-uploader";
import { ResponsiveModal } from "../responsive-modal";
import { Field, LocalizedFields } from "../ui";

/** Curated icons (names understood by the public menu's categoryIcon()). */
export const CATEGORY_ICON_NAMES = [
  "coffee",
  "cup-soda",
  "glass-water",
  "citrus",
  "milk",
  "beer",
  "wine",
  "martini",
  "croissant",
  "egg",
  "sandwich",
  "hamburger",
  "pizza",
  "salad",
  "soup",
  "drumstick",
  "beef",
  "fish",
  "ham",
  "cooking-pot",
  "chef-hat",
  "cake",
  "dessert",
  "ice-cream",
  "donut",
  "cookie",
  "candy",
  "apple",
  "cherry",
  "grape",
  "popcorn",
  "leaf",
  "sprout",
  "flame",
  "sparkles",
  "utensils",
] as const;

const EMPTY: LocalizedText = { ar: "", en: "" };

function toInput(c: Category | null): CategoryInput {
  return {
    name: c?.name ?? EMPTY,
    description: c?.description ?? EMPTY,
    icon: c?.icon ?? null,
    imageUrl: c?.imageUrl ?? null,
    imageBlur: c?.imageBlur ?? null,
    isVisible: c?.isVisible ?? true,
  };
}

/**
 * Add / edit category (dialog on desktop, bottom sheet on phones). Mount it with a `key` so the
 * form resets for each category.
 */
export function CategoryDialog({
  open,
  onOpenChange,
  restaurantId,
  category,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  category: Category | null;
  onSaved: (saved: Category, created: boolean) => void;
}) {
  const t = useT();
  const { lang } = useI18n();
  const feedback = useFeedback();
  const [form, setForm] = useState<CategoryInput>(() => toInput(category));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    const parsed = categoryInputSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await callAction(() => saveCategoryAction(lang, restaurantId, category?.id ?? null, parsed.data));
      if (feedback(res, category ? t.category.updated : t.category.created) && res.ok) {
        onSaved(res.data, !category);
        onOpenChange(false);
      }
    });
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={category ? t.category.editTitle : t.category.newTitle}
      footer={
        <>
          <Button type="button" variant="outline" className="h-11 rounded-xl lg:h-9" onClick={() => onOpenChange(false)} disabled={pending}>
            {t.common.cancel}
          </Button>
          <Button type="button" className="h-11 min-w-28 rounded-xl lg:h-9" onClick={save} disabled={pending || uploading}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? t.common.saving : category ? t.common.saveChanges : t.category.create}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <LocalizedFields
          label={t.category.name}
          value={form.name}
          onChange={(v) => set("name", v)}
          errors={errors}
          errorKey="name"
          maxLength={80}
        />
        <LocalizedFields
          label={t.category.description}
          value={form.description}
          onChange={(v) => set("description", v)}
          errors={errors}
          errorKey="description"
          multiline
          optional
          maxLength={300}
        />
        <IconPicker value={form.icon} onChange={(v) => set("icon", v)} />
        <Field label={t.category.photo} optional>
          <ImageUploader
            restaurantId={restaurantId}
            kind="category"
            aspect="wide"
            label={t.category.photo}
            value={{ url: form.imageUrl, blur: form.imageBlur }}
            onChange={(v) => setForm((f) => ({ ...f, imageUrl: v.url, imageBlur: v.blur }))}
            onBusyChange={setUploading}
          />
        </Field>
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3">
          <span>
            <span className="block text-sm font-medium">{t.category.visible}</span>
            <span className="block text-xs text-muted-foreground">{t.category.visibleHint}</span>
          </span>
          <Switch checked={form.isVisible} onCheckedChange={(v) => set("isVisible", v)} />
        </label>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </ResponsiveModal>
  );
}

function IconPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const t = useT();
  const options: Array<string | null> = [null, ...CATEGORY_ICON_NAMES];
  return (
    <fieldset>
      <legend className="mb-2 text-[0.82rem] font-medium">{t.category.icon}</legend>
      <div role="radiogroup" aria-label={t.icons.label} className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
        {options.map((name) => {
          const selected = value === name;
          return (
            <button
              key={name ?? "none"}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name ?? t.category.noIcon}
              title={name ?? t.category.noIcon}
              onClick={() => onChange(name)}
              className={cn(
                "grid aspect-square min-h-11 place-items-center rounded-xl border outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "scale-105 border-primary bg-primary text-primary-foreground shadow-sm"
                  : "bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {name ? createElement(categoryIcon(name), { className: "size-5", "aria-hidden": true }) : <Ban className="size-4.5" aria-hidden />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
